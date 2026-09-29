/**
 * AI Agent #3 — 대화형 맞춤 추천.
 *
 * AI가 하는 일
 *   1) 다섯 답변에서 허용된 추천 조건만 뽑는다
 *   2) 코드가 고른 후보를 설명하는 이유를 쓴다
 *
 * 코드가 하는 일
 *   1) 사용자 선택에 맞춰 다섯 질문과 자연스러운 연결 문장을 고른다
 *   2) 마감·내 액션·이미 참여한 액션을 제외한다
 *   3) 지역과 카테고리를 단계적으로 완화한다
 *   4) 고정 점수로 상위 3개를 고른다
 *
 * AI가 실패해도 고정 질문과 코드 추천은 계속 동작합니다.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { callStructuredAI } from '@/lib/openai';
import { getRecommendCandidates, getMyCreatedActions } from '@/lib/queries/actions';
import {
  getFollowing,
  getParticipatedActions,
  getProfile,
} from '@/lib/queries/profiles';
import {
  rankActions,
  scoreAction,
  fallbackReason,
  type ScoringProfile,
  type ActionScoringMetadata,
  type ScoringAnswers,
} from '@/lib/utils/scoring';
import { sameProvince, totalGroupSize } from '@/lib/utils/discover-ranking';
import {
  extractAdaptiveAnswers,
  extractAnswersFromDialogue,
  getQuestionOptions,
  getQuestionReply,
  getRecommendationReply,
  getRemainingQuestionKeys,
  shouldRecommendNow,
  analyzeUserContext,
  validateHarmfulSkillInput,
  formatSummaryChips,
  resolveUnifiedCategories,
  ALL_15_SKILLS,
  CHEERING_OR_CASUAL_REGEX,
  type QuestionKey,
  type UserStateCategory,
} from '@/app/api/ai/discover/interview';
import { CATEGORIES, SKILLS, type Category } from '@/lib/constants';
import { matchesRegion, NATIONWIDE } from '@/lib/constants/regions';
import { formatDate, formatTime, isWeekend } from '@/lib/utils/date';

const CHAT_PROMPT_VERSION = 'discover-chat-v8-chip-zero-assumption';
const RECOMMEND_PROMPT_VERSION = 'discover-recommend-v10-truth-grounding';
const MAX_USER_TURNS = 15;
const PARTICIPATION_MODES = [
  '시간을 내서',
  '물건으로',
  '직접 행동으로',
  '내 재능으로',
] as const;

const ChatMessageSchema = z.object({
  role: z.enum(['assistant', 'user']),
  content: z.string().trim().min(1).max(300),
});

const ChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).max(MAX_USER_TURNS * 2).default([]),
});

const ConversationSchema = z.object({
  reply: z.string().trim().min(1).max(1000),
  question_key: z
    .enum([
      'opening',
      'categories',
      'target_groups',
      'difficulty',
      'skills',
      'activity_types',
      'participation_modes',
      'talent_preference',
      'activity_type',
      'vibe_preference',
      'group_size',
      'field_preference',
      'travel_range',
      'time_pref',
      'participation_mode',
    ])
    .nullable()
    .catch(null)
    .default(null),
  enough: z.boolean().catch(false).default(false),
  options: z.array(z.string().trim().min(1).max(50)).max(25).catch([]).default([]),
  categories: z.array(z.string()).catch([]).default([]),
  participation_mode: z.enum(PARTICIPATION_MODES).nullable().catch(null).default(null),
});

const RecommendationSchema = z.object({
  topActionIds: z.array(z.string()).max(3).default([]),
  reasons: z.record(z.string(), z.string()).catch({}).default({}),
});

type ChatMessage = z.infer<typeof ChatMessageSchema>;
type Conversation = z.infer<typeof ConversationSchema>;

const CHAT_SYSTEM = `당신은 선한 영향력 SNS '착착'의 액션 추천 전문 AI 에이전트 '착착 Discover'입니다.
모든 사용자는 로그인된 정회원입니다. 사용자의 활동 이력과 프로필 상태에 맞춰 깊이 공감하고, 최적의 액션을 찾기 위해 대화를 이끌어갑니다.
반드시 JSON 형식으로만 답하세요.

[핵심 서비스 규칙 (절대 위반 금지)]
1. 영어 'Action'을 절대 쓰지 말고 반드시 한글 '액션'으로 표기하세요.
2. '봉사', '봉사활동', '봉사자', '수혜자' 단어를 일체 사용하지 마세요. (나눔, 함께하기, 활동, 크루 등으로 순화)
3. 활동 지역 옵션에 '비대면/온라인'은 절대 넣지 마세요. (지역은 1곳 단일 선택 또는 전국/상관없음)
4. 사용자가 언제 방문했는지(접속 여부)를 추측하는 발언("오랜만에 오셨네요", "그동안 잘 지내셨나요" 등)은 절대 하지 마세요.
5. 지난 특정 액션 제목을 일일이 언급하며 "참여는 즐거우셨나요?" 같은 사적인 감상을 묻지 마세요.
6. 없는 사실이나 사용자 정보를 추측하거나 임의로 지어내지 마세요. 프로필에 재능이 없는 사용자(나눌수있는재능이 비어있거나 '등록된 재능 없음')에게 절대 "프로필에 재능이 있다"고 말하거나 임의의 재능(청소·정리, 요리 등)을 지어내지 마세요.
7. 말풍선(reply) 본문에 선택지 항목이나 예시 목록(불릿 기호 -, •, * 등)을 절대 나열하지 마세요. 모든 선택지는 화면 하단 선택 버튼(options)으로만 노출됩니다. 말풍선에는 질문과 다정한 안내 멘트(1~2문장)만 간결하게 작성하세요.
8. 재능(skills) 질문의 options 배열 및 멘트:
   - 프로필에 재능이 실제로 등록되어 있는 사용자에게 처음 물을 때만 2지선다 ["예, 그럴게요 👍", "아니요, 다른 재능으로 할게요 🔄"]를 제공하고, 멘트는 "프로필에 [{userSkills}] 재능이 있다고 알려주셨는데, 이 재능을 살릴 수 있는 액션을 찾아볼까요?"로 작성하세요.
   - 프로필에 등록된 재능이 없는 사용자(신규가입자 등) 또는 사용자가 "다른 재능으로 할게요"를 선택한 경우:
     ★ 절대로 "프로필에 재능이 있다"고 말하지 마세요!
     ★ 반드시 "{nickname}님이 활용할 수 있는 재능을 아래 선택지에서 골라주세요"라고 안내하고, options는 사전 정의된 ${SKILLS.length + 1}종 목록 ${JSON.stringify([...SKILLS, '기타'])}을 정확히 제공하세요.
9. question_key는 반드시 시스템이 제공한 '남은질문' 배열에 존재하는 키 중에서만 선택해야 합니다. 남은질문에 없는 질문 키(예: 난이도에서 '기초 체력 필요'나 '누구나 참여가능'을 선택하여 재능 질문이 생략된 상황에서 "skills")를 반환하는 것은 엄격히 금지됩니다.

[질문 순서 및 분기 제어 시나리오 (우선순위 0~5)]
대화는 아래 우선순위에 따라 순서대로 진행합니다. 이미 파악되었거나 스킵 조건에 해당하는 질문은 절대 반복하지 마세요.

0. 오프닝 및 지역/시간 상시 확인 (모든 유저 공통):
   - 프로필에 지역과 시간이 등록되어 있는 경우:
     - 멘트: "안녕하세요, {nickname}님! 😊 {nickname}님에게 딱 맞는 액션을 찾기 위해 프로필에 등록된 기본 조건을 확인해 봤어요.\n\n📍 활동 지역 : {profileRegion}\n⏰ 선호 시간 : {profileTimesSummary}\n\n이 조건 그대로 액션을 찾아드릴까요?"
     - options: ["네, 이 조건으로 찾을게요 👍", "이번엔 다른 조건으로 찾을래요 🔄"]
   - 프로필에 지역이나 시간이 없는 경우 (신규가입자 등):
     - 첫 질문 (지역 확인):
       - 멘트: "안녕하세요, {nickname}님! 만나서 반가워요. 😊 {nickname}님에게 딱 맞는 액션을 찾아드리기 위해 활동하실 지역과 시간을 먼저 확인하고 싶어요.\n\n먼저, 이번에 어느 지역에서 활동하고 싶으세요?"
       - options: ["활동할 지역 선택하기 📍", "지역 상관없이 전국 액션 볼래요 🌏"]
     - 지역 선택 후 시간대가 미확인된 경우:
       ★ 반드시 다음 질문으로 선호 시간대(time_pref)를 물어보세요!
       - 멘트: "보통 언제 참여하기 편하신가요? (복수 선택 가능)"
       - options: ["주말 오전", "주말 오후", "평일 낮", "평일 저녁", "시간 상관없음"]

1. 카테고리 (categories) - 분야 선택:
   - 프로필 관심 분야나 과거 활동 이력이 있는 경우 ({unifiedCategories}):
     - 멘트: "{nickname}님의 프로필 관심분야와 지난 활동들을 살펴보니 [{unifiedCategories}] 분야에 주로 관심과 경험이 있으시네요. 이번에도 이 분야 위주로 찾아드릴까요?" (프로필만 있는 경우 "프로필 관심 분야인 [{profileCategories}]", 활동 이력만 있는 경우 "지난 활동들을 살펴보니 [{historyCategories}]")
     - options: ["같은 분야로 찾을래요 👍", "새로운 분야에 도전해볼래요 ✨"]
     - ("새로운 분야" 선택 시: ["동물", "환경", "지역사회", "아동·청소년", "노인", "장애", "교육", "기타", "상관없음"])
   - 활동 이력도 없고 프로필 관심 분야도 없는 신규 회원인 경우:
     - 멘트: "어떤 분야의 액션에 가장 관심이 가시나요?"
     - options: ["동물", "환경", "지역사회", "아동·청소년", "노인", "장애", "교육", "기타", "상관없음"]

2. 활동 성격 및 분위기 (target_groups):
   - 멘트: "{nickname}님은 어떤 분위기의 활동이 더 끌리시나요? 사람들과 도란도란 소통하고 정을 나누는 활동이 좋으세요, 아니면 땀 흘리고 손발을 맞춰 집중하는 활동이 좋으세요?"
   - options: ["교류·교육·소통형", "육체·과업·집중형", "상관없음"]

3. 난이도 (difficulty) & 재능 (skills) [★ 조건부 분기]:
   - 멘트: "액션에 따라 난이도가 다를 수 있어요. 어떤 스타일을 원하세요?"
   - options: ["누구나 참여가능", "기초 체력 필요", "전문지식/자격/재능 활용", "상관없음"]
   - [필수 규칙] 사용자가 '누구나 참여가능' 또는 '기초 체력 필요'를 선택한 경우:
     ★ 절대로 재능(skills) 질문을 하지 마세요! question_key를 "skills"로 반환하지 마세요!
     ★ 재능 질문을 완전히 생략하고 즉시 4번 활동 환경(activity_types) 질문으로 전진해야 합니다! (question_key: "activity_types")
   - 사용자가 '전문지식/자격/재능 활용'을 선택한 경우에만 재능(skills) 질문으로 이동합니다.
     - 프로필에 등록된 재능이 있는 경우: "프로필에 [{userSkills}] 재능이 있다고 알려주셨는데, 이 재능을 살릴 수 있는 액션을 찾아볼까요?" (options: ["예, 그럴게요 👍", "아니요, 다른 재능으로 할게요 🔄"])
     - 프로필에 등록된 재능이 없는 경우(신규가입자 등) 또는 '다른 재능으로 할게요' 선택 시: "전문지식이나 재능을 나눌 수 있다니 정말 멋져요! 😊 {nickname}님이 활용할 수 있는 재능을 아래 선택지에서 골라주세요." (options: ${SKILLS.length + 1}종 재능 목록)

4. 활동 환경 (activity_types):
   - 멘트: 직전에 사용자가 재능을 선택한 경우 "알려주신 재능을 살릴 수 있는 액션으로 함께 찾아볼게요! ✨"를 앞머리에 붙이고, "어떤 환경에서 활동하고 싶으세요?"라고 질문하세요. (재능 중 하나만 임의로 골라 대표로 지정하지 마세요)
   - options: ["실내 활동", "실외 활동", "상관없음"]

5. 모임 규모 (participation_modes) 및 추천 전환:
   - 멘트: "함께하는 크루의 규모는 어느 정도가 편하세요?"
   - options: ["10명 이내 소그룹", "10~20명 중그룹", "20명 이상 대그룹", "상관없음"]
   - 주요 선호 조건이 충분히 파악되었거나 사용자가 추천을 요청하면 "enough": true로 설정하여 추천 단계로 넘기세요.

[대화 태도 및 맞장구 규칙]
- 직전 답변 내용과 1:1로 일치하는 따뜻하고 풍부한 공감 리액션(1~2문장)을 먼저 건네고, 이어서 다음 순서의 질문을 자연스럽게 하세요.
- 사용자가 질문형으로 되물으면 친절히 설명한 후 선택을 유도하세요.

[응답 형식 (반드시 JSON)]
{"reply":"사용자 응답에 대한 맞장구 공감 + 다음 질문 텍스트","question_key":"categories","enough":false,"options":["..."]}`;

const RECOMMEND_SYSTEM = `당신은 선한 영향력 SNS '착착'의 액션 추천 전문 AI 에이전트입니다.
프로젝트의 '콘텐츠 자동 분류·색인 시스템'에 의해 생성된 각 액션의 7대 AI 색인 메타데이터와 사용자의 대화 및 성향을 비교하여 가장 부합하는 최적의 액션 3개를 선정합니다.
반드시 JSON 형식으로만 답하세요.

핵심 규칙:
1. 영어 'Action' 단어를 절대 쓰지 말고 한글 '액션'으로 표현하세요. '봉사', '봉사활동', '봉사자', '수혜자' 단어를 일체 사용하지 마세요.
2. 주어진 후보 목록의 actionId 중에서만 topActionIds로 최대 3개를 선정하세요.
3. 없는 사실이나 사용자가 말하지 않은 취향을 추측하거나 지어내지 마세요.

형식:
{"topActionIds":["actionId1", "actionId2", "actionId3"]}`;

function extractSkillsAnswer(messages: ChatMessage[]): string[] | null {
  const userText = messages
    .filter((message) => message.role === 'user')
    .map((message) => message.content)
    .join(' ');

  if (userText.includes('재능 없음')) return [];
  if (userText.includes('아직 모르겠음')) return null;

  const cleanText = userText
    .replace(/교류·교육·소통형/g, '')
    .replace(/전문지식\/자격\/재능 활용/g, '');

  const selected = ALL_15_SKILLS.filter((skill) => {
    if (skill === '기타') return false;
    const words = skill.split(/[·\s]+/).filter((word) => word.length >= 2);
    return words.some((word) => cleanText.includes(word));
  });
  return selected.length > 0 ? [...selected] : null;
}

function fallbackConversation({
  messages,
  nickname,
  answers,
  profileSkills,
  selectedSkills,
  fieldReferenceCategories,
  hasHistory,
  profileCategories,
  questionKey,
  userState,
  knownFacts,
  pastActivitySummary,
}: {
  messages: ChatMessage[];
  nickname: string;
  answers: ReturnType<typeof extractAdaptiveAnswers>;
  profileSkills: readonly string[];
  selectedSkills: readonly string[];
  fieldReferenceCategories: Category[];
  hasHistory: boolean;
  profileCategories: string[];
  questionKey: QuestionKey | null;
  userState?: UserStateCategory;
  knownFacts?: string[];
  pastActivitySummary?: string;
}): Conversation {
  const userText = messages
    .filter((message) => message.role === 'user')
    .map((message) => message.content)
    .join(' ');

  const mentionedCategories = CATEGORIES.filter((category) =>
    userText.includes(category),
  );
  let categories: string[] = mentionedCategories;
  if (categories.length === 0 && userText.includes('비슷')) {
    categories = fieldReferenceCategories;
  } else if (categories.length === 0 && userText.includes('새로운')) {
    categories = CATEGORIES.filter(
      (category) => !fieldReferenceCategories.includes(category),
    );
  } else if (categories.length === 0) {
    categories = profileCategories.filter((category) => category !== '전체');
  }

  let participationMode: (typeof PARTICIPATION_MODES)[number] | null = null;
  if (userText.includes('물품') || userText.includes('물건')) {
    participationMode = '물건으로';
  } else if (userText.includes('몸') || userText.includes('움직')) {
    participationMode = '직접 행동으로';
  } else if (userText.includes('시간')) {
    participationMode = '시간을 내서';
  } else if (/재능.*활용|내 재능으로/.test(userText)) {
    participationMode = '내 재능으로';
  }

  if (questionKey) {
    return {
      reply: getQuestionReply(questionKey, {
        nickname,
        answers,
        profileSkills,
        selectedSkills,
        fieldReferenceCategories,
        hasHistory,
        userState,
        knownFacts,
        pastActivitySummary,
        profileCategories: profileCategories ?? [],
      }),
      question_key: questionKey,
      enough: false,
      options: getQuestionOptions(questionKey, SKILLS, userState, true, {
        hasHistory,
        answers,
        profileSkills,
        profileCategories: profileCategories ?? [],
      }),
      categories,
      participation_mode: participationMode,
    };
  }

  return {
    reply: getRecommendationReply({
      nickname,
      answers,
      selectedSkills,
      fieldReferenceCategories,
    }),
    question_key: null,
    enough: true,
    options: [],
    categories,
    participation_mode: participationMode,
  };
}

function allowedCategories(values: string[]): Category[] {
  return values.filter((value): value is Category =>
    (CATEGORIES as readonly string[]).includes(value),
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const parsed = ChatRequestSchema.safeParse(
    await request.json().catch(() => ({})),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: '대화 내용을 확인해주세요.' },
      { status: 400 },
    );
  }

  const messages = parsed.data.messages;
  const userTurnCount = messages.filter(
    (message) => message.role === 'user',
  ).length;

  const [profile, participatedHistory, createdActions, following] = await Promise.all([
    getProfile(supabase, user.id, user.id),
    getParticipatedActions(supabase, user.id, user.id),
    getMyCreatedActions(supabase, user.id),
    getFollowing(supabase, user.id, user.id),
  ]);

  if (!profile) {
    return NextResponse.json(
      { error: '프로필을 먼저 완성해주세요.' },
      { status: 400 },
    );
  }

  // 호스트한 액션 중 DRAFT나 CANCELLED가 아닌 활동 포함
  const validCreatedActions = createdActions.filter(
    (a) => a.status !== 'DRAFT' && a.status !== 'CANCELLED',
  );
  // 전체 과거 활동 (참여 + 호스트)
  const allPastActions = [...participatedHistory, ...validCreatedActions];

  // {통합분야} 도출: 프로필 관심분야와 과거 활동 빈도 패턴 분석
  const {
    unifiedCategories,
    primaryHistoryCategories,
    hasHistory,
  } = resolveUnifiedCategories({
    profileCategories: profile.categories,
    pastActions: allPastActions,
    maxCount: 3,
  });

  const fieldReferenceCategories = allowedCategories(unifiedCategories);
  const historyCategories = primaryHistoryCategories;
  const history = allPastActions;

  const historyActionIds = history.map((action) => action.id);
  const { data: pastMetasData } = historyActionIds.length > 0
    ? await supabase
        .from('action_ai_metadata')
        .select('action_id, categories, activity_types, target_groups, participation_modes, skills, keywords, difficulty')
        .in('action_id', historyActionIds)
    : { data: [] };

  const pastMetaMap = new Map((pastMetasData ?? []).map((m) => [m.action_id, m]));

  const userContext = analyzeUserContext({
    profile,
    history,
    pastMetas: pastMetasData ?? [],
  });

  const userAnswers = messages
    .filter((message) => message.role === 'user')
    .map((message) => message.content);
  const adaptiveAnswers = {
    ...extractAdaptiveAnswers(userAnswers),
    ...extractAnswersFromDialogue(messages),
  };
  if (
    adaptiveAnswers.selectedSkill === 'profile' &&
    profile.skills &&
    profile.skills.length > 0 &&
    (!adaptiveAnswers.selectedSkills || adaptiveAnswers.selectedSkills.length === 0)
  ) {
    adaptiveAnswers.selectedSkills = profile.skills;
    adaptiveAnswers.selectedSkill = 'profile';
    adaptiveAnswers.talentPreference = 'use';
  }
  const inferredSkills = extractSkillsAnswer(messages);
  const effectiveSkills = inferredSkills ?? profile.skills;
  const selectedSkills =
    adaptiveAnswers.talentPreference === 'use'
      ? (inferredSkills ?? profile.skills ?? [])
      : [];
  const remainingQuestionKeys = getRemainingQuestionKeys({
    answers: adaptiveAnswers,
    userState: userContext.state,
    hasRegionAndTime: userContext.hasRegionAndTime,
    hasHistory,
    profileSkills: profile.skills ?? [],
  });
  const fallbackQuestionKey = remainingQuestionKeys[0] ?? null;

  // Turn 0: 첫 진입 시 프로필 기본 조건(지역 1곳, 선호 시간대 복수) 상시 확인 (Zero-Assumption)
  if (userTurnCount === 0) {
    const openingKey: QuestionKey = 'opening';
    const openingReply = getQuestionReply(openingKey, {
      nickname: profile.nickname,
      answers: adaptiveAnswers,
      profileSkills: profile.skills ?? [],
      selectedSkills,
      fieldReferenceCategories,
      hasHistory,
      userState: userContext.state,
      knownFacts: userContext.knownFacts,
      pastActivitySummary: userContext.pastActivitySummary,
      profileRegion: userContext.profileRegion,
      profileTimesSummary: userContext.profileTimesSummary,
      hasRegionAndTime: userContext.hasRegionAndTime,
    });
    const openingOptions = getQuestionOptions(
      openingKey,
      SKILLS,
      userContext.state,
      userContext.hasRegionAndTime,
    );

    return NextResponse.json({
      done: false,
      reply: openingReply,
      options: openingOptions,
      relaxation: [],
      items: null,
      isLastQuestion: false,
    });
  }

  let conversation: Conversation;
  let isAiSuccess = false;
  try {
    const rawProfileSkills = profile.skills ?? [];
    const profileSkillsStr = rawProfileSkills.length > 0 ? rawProfileSkills.join(', ') : '없음';
    const rawProfileCats = (profile.categories ?? []).filter((c) => c !== '전체');
    const profileCatsStr = rawProfileCats.length > 0 ? rawProfileCats.join(', ') : '없음';
    const historyCatsStr = historyCategories.length > 0 ? historyCategories.join(', ') : '없음';
    const unifiedCatsStr = unifiedCategories.length > 0 ? unifiedCategories.join(', ') : '없음';
    const dynamicSystem = CHAT_SYSTEM
      .replace(/\{userSkills\}/g, profileSkillsStr)
      .replace(/\{profileCategories\}/g, profileCatsStr)
      .replace(/\{historyCategories\}/g, historyCatsStr)
      .replace(/\{unifiedCategories\}/g, unifiedCatsStr);

    conversation = await callStructuredAI({
      agent: 'DISCOVER',
      promptVersion: CHAT_PROMPT_VERSION,
      system: dynamicSystem,
      temperature: 0.7,
      user: JSON.stringify({
        사용자: profile.nickname,
        사용자상태: userContext.state,
        상태설명: userContext.stateLabel,
        이미알고있는사실: userContext.knownFacts,
        프로필: {
          관심카테고리: profile.categories,
          활동지역: userContext.profileRegion,
          선호시간대: userContext.profileTimesSummary,
          나눌수있는재능: rawProfileSkills.length > 0 ? rawProfileSkills : '등록된 재능 없음 (신규가입자)',
          자기소개: profile.bio,
        },
        지난활동: history.slice(0, 3).map((action) => {
          const meta = pastMetaMap.get(action.id);
          return {
            제목: action.title,
            카테고리: action.category,
            활동환경: meta?.activity_types?.[0] ?? null,
            모임성격: meta?.target_groups?.[0] ?? null,
            인원규모: meta?.participation_modes?.[0] ?? null,
            활용재능: meta?.skills ?? [],
          };
        }),
        사용자답변수: userTurnCount,
        남은질문: remainingQuestionKeys,
        대화: messages,
      }),
      schema: ConversationSchema,
      userId: user.id,
    });
    isAiSuccess = true;
  } catch {
    conversation = fallbackConversation({
      messages,
      nickname: profile.nickname,
      answers: adaptiveAnswers,
      profileSkills: profile.skills ?? [],
      selectedSkills,
      fieldReferenceCategories,
      hasHistory,
      profileCategories: profile.categories,
      questionKey: fallbackQuestionKey,
      userState: userContext.state,
      knownFacts: userContext.knownFacts,
      pastActivitySummary: userContext.pastActivitySummary,
    });
  }

  let chosenQuestionKey: QuestionKey = fallbackQuestionKey ?? 'categories';

  if (isAiSuccess && conversation.question_key) {
    chosenQuestionKey = conversation.question_key;
  } else if (isAiSuccess && conversation.reply) {
    const replyText = conversation.reply;
    if (/모임 규모|인원|소규모|중규모|대규모|크루의 규모/.test(replyText)) {
      chosenQuestionKey = 'participation_modes';
    } else if (/난이도|문턱|어떤 스타일을 원하세요|체력/.test(replyText)) {
      chosenQuestionKey = 'difficulty';
    } else if (/환경|실내|실외|야외|어떤 환경/.test(replyText)) {
      chosenQuestionKey = 'activity_types';
    } else if (/분위기|스타일|성격|교류|소통|과업|집중/.test(replyText)) {
      chosenQuestionKey = 'target_groups';
    } else if (/분야|카테고리|관심사|비슷한 분야|새로운 분야/.test(replyText)) {
      chosenQuestionKey = 'categories';
    } else if (/장소|지역|이동 범위|거리|집 근처/.test(replyText)) {
      chosenQuestionKey = 'travel_range';
    } else if (/시간|주말|평일|오전|오후|저녁|낮/.test(replyText)) {
      chosenQuestionKey = 'time_pref';
    } else if (/재능|기술|특기|어떤 재능/.test(replyText)) {
      chosenQuestionKey = 'skills';
    }
  }

  const lastUserMsg = userAnswers[userAnswers.length - 1] ?? '';
  const isQuestionInquiry = /\?|어떤 거야|뭐야|있나요|없나요|어때요/.test(lastUserMsg);

  // 1. AI가 반환한 question_key가 남은 질문 축에 없으면, 남은 질문 중 첫 번째로 즉시 강제 보정 (사용자의 질문형 되묻기 제외)
  if (!isQuestionInquiry && remainingQuestionKeys.length > 0 && !remainingQuestionKeys.includes(chosenQuestionKey)) {
    chosenQuestionKey = remainingQuestionKeys[0];
  }

  // 2. 재능 질문 맥락에서의 입력 검증 (가드레일 & 기타 선택)
  // 재능 질문 맥락은 '직전 어시스턴트 질문이 실제로 재능에 대한 질문'이었고, '이번 턴에서 재능 질문 단계가 유효할 때'만 해당함
  const assistantMessages = messages.filter((m) => m.role === 'assistant');
  const lastAssistantMsg = assistantMessages[assistantMessages.length - 1]?.content ?? '';

  // 직전 어시스턴트 질문이 다른 축(환경, 모임 규모, 성격, 난이도 등)을 묻는 질문이었는지 판별
  const isOtherQuestionAsked =
    /어떤 환경|실내.*실외|실외.*실내|날씨.*걱정|실내 활동|야외 활동|모임 규모|인원 규모|소규모|대규모|소그룹|중그룹|대그룹|어떤 분위기|도란도란|소통하고|땀 흘리|과업|난이도|어떤 스타일을 원하세요|어느 지역|선호 시간/.test(lastAssistantMsg);

  // 이번 턴 이전의 답변들만 분석하여, 이미 재능 질문이 완료되었는지 확인
  const priorUserAnswers = userAnswers.slice(0, -1);
  const priorAdaptive = extractAdaptiveAnswers(priorUserAnswers);
  const skillAlreadyDecided =
    Boolean(priorAdaptive.selectedSkills && priorAdaptive.selectedSkills.length > 0) ||
    priorAdaptive.selectedSkill === 'profile' ||
    priorAdaptive.talentPreference === 'any';

  const lastAssistantAskedSkill =
    !isOtherQuestionAsked &&
    !skillAlreadyDecided &&
    /어떤 재능|새로운 재능|활용할 수 있는 재능|나눌 수 있는 재능|프로필에.*재능이 있다고 알려주셨는데|재능을 살릴 수 있는 액션을 찾아볼까요|아래 선택지에서 골라주세요/.test(lastAssistantMsg);

  const isSkillContext =
    lastAssistantAskedSkill &&
    !skillAlreadyDecided &&
    (adaptiveAnswers.difficultyPreference === 'expert' || remainingQuestionKeys.includes('skills'));

  if (isSkillContext && lastUserMsg) {
    const harmfulCheck = validateHarmfulSkillInput(lastUserMsg);
    if (harmfulCheck.isHarmful) {
      return NextResponse.json({
        done: false,
        reply: harmfulCheck.reason,
        options: getQuestionOptions('skills', SKILLS, userContext.state, userContext.hasRegionAndTime, {
          hasHistory,
          hasRegionAndTime: userContext.hasRegionAndTime,
          answers: adaptiveAnswers,
          profileSkills: profile.skills ?? [],
        }),
        questionKey: 'skills',
        answeredCount: userTurnCount,
        maxQuestions: MAX_USER_TURNS,
      });
    }

    const isProfileConfirm = /예.*그럴|그럴게|그럴께|네.*그럴|그대로 살릴|그대로 활용|프로필 재능|기존 재능/.test(lastUserMsg);
    const isNewSkillRequest = /아니요|다른 재능|새로운 재능|새 재능/.test(lastUserMsg);
    const isSkipSkill = /특별한 재능 없이|재능.*상관|부담 없이|상관없음/.test(lastUserMsg);
    const isKnownSkill = ALL_15_SKILLS.some((s) => lastUserMsg.includes(s));

    if (isProfileConfirm) {
      // 프로필 재능 그대로 활용 확정 ➔ 재능 바인딩 후 다음 질문으로 정상 진행
      adaptiveAnswers.selectedSkill = 'profile';
      adaptiveAnswers.selectedSkills = profile.skills ?? [];
      adaptiveAnswers.talentPreference = 'use';
    } else if (isNewSkillRequest) {
      // 새로운 재능 선택 요청 ➔ 16종 선택지 노출
      return NextResponse.json({
        done: false,
        reply: `새로운 재능을 펼치고 싶으시군요! 멋져요 ✨\n${profile.nickname}님이 활용할 수 있는 재능을 아래 선택지에서 골라주세요!`,
        options: [...ALL_15_SKILLS],
        questionKey: 'skills',
        answeredCount: userTurnCount,
        maxQuestions: MAX_USER_TURNS,
      });
    } else if (!isKnownSkill && !isSkipSkill) {
      const isCheering = /파이팅|화이팅|힘내|응원/.test(lastUserMsg);
      const promptLead = isCheering
        ? `'${lastUserMsg.trim()}' 응원 말씀 정말 감사해요! 힘이 팍팍 나네요! 💪😊`
        : `말씀해 주셔서 감사해요! 😊`;
      return NextResponse.json({
        done: false,
        reply: `${promptLead}\n이번 액션에서 ${profile.nickname}님이 활용할 수 있는 재능을 아래 선택지에서 골라주세요! 특정 재능에 상관없이 참여하고 싶으시다면 '기타'를 선택해주시면 됩니다.`,
        options: [...ALL_15_SKILLS],
        questionKey: 'skills',
        answeredCount: userTurnCount,
        maxQuestions: MAX_USER_TURNS,
      });
    }
  }

  const recommendNow =
    shouldRecommendNow({
      userTurnCount,
      enough: conversation.enough,
      remainingKeysCount: remainingQuestionKeys.length,
    }) || remainingQuestionKeys.length === 0;

  if (!recommendNow && chosenQuestionKey) {
    const fallback = fallbackConversation({
      messages,
      nickname: profile.nickname,
      answers: adaptiveAnswers,
      profileSkills: profile.skills ?? [],
      selectedSkills,
      fieldReferenceCategories,
      hasHistory,
      profileCategories: profile.categories,
      questionKey: chosenQuestionKey,
      userState: userContext.state,
      knownFacts: userContext.knownFacts,
      pastActivitySummary: userContext.pastActivitySummary,
    });

    let reply =
      isAiSuccess && conversation.reply ? conversation.reply : fallback.reply;

    const hasProfileSkills = (profile.skills ?? []).length > 0;
    const rawProfileCatsForReply = (profile.categories ?? []).filter((c) => c !== '전체');

    // 1) 재능(skills) 질문인 경우:
    // AI의 프로필 재능 거짓말/할루시네이션을 원천 차단하고,
    // 프로필 재능 유무 및 '다른 재능' 선택 여부에 따라 검증된 fallback.reply를 100% 강제 적용
    if (chosenQuestionKey === 'skills') {
      reply = fallback.reply;
    }

    // 2) 프로필에 재능이 없는 사용자인데 말풍선에 "프로필에 재능이 있다"는 문구가 포함된 경우 즉시 안전한 문구로 교체
    if (!hasProfileSkills && /프로필에.*재능/.test(reply)) {
      reply = fallback.reply;
    }

    // 3) 카테고리(categories/field_preference) 질문인 경우:
    // AI가 지난 활동 카테고리나 프로필 관심분야를 누락하고 엉뚱한 질문을 하는 것을 방지하고,
    // 옵션([같은 분야로 찾을래요], [새로운 분야에 도전해볼래요] 등)과 100% 일치하는 맞춤 멘트 강제 적용!
    if (
      (chosenQuestionKey === 'categories' || chosenQuestionKey === 'field_preference') &&
      adaptiveAnswers.fieldPreference !== 'new'
    ) {
      if (hasHistory) {
        reply = fallback.reply;
      } else if (rawProfileCatsForReply.length > 0) {
        reply = fallback.reply;
      }
    }

    // 만약 AI가 이미 답변된 질문 축을 되묻거나, 남은 질문 축과 불일치하는 질문을 냈다면, 다음 남은 질문의 안내로 교체
    const isMismatchedReply =
      isAiSuccess &&
      !isQuestionInquiry &&
      (
        (conversation.question_key && !remainingQuestionKeys.includes(conversation.question_key)) ||
        (chosenQuestionKey !== conversation.question_key) ||
        (/재능|기술|특기|어떤 재능/.test(reply) && (chosenQuestionKey === 'activity_types' || chosenQuestionKey === 'activity_type')) ||
        (chosenQuestionKey === 'time_pref' && !/시간|언제|주말|평일|오전|오후|저녁|낮/.test(reply))
      );

    if (isMismatchedReply) {
      reply = fallback.reply;
    }

    // "위 16종 선택지" 등 옛 표현을 "아래 선택지"로 보정
    reply = reply.replace(/위\s*16종\s*선택지에서\s*골라주세요/g, '아래 선택지에서 골라주세요');

    // 말풍선 본문에서 불릿 기호(-, •, * 등)나 번호 목록(1., 1) 등) 옵션 나열 목록 제거 (중복 노출 방지)
    if (/(\n\s*[-•*]\s*|\n\s*\d+[.)]\s*)/.test(reply)) {
      reply = reply.split(/\n\s*[-•*]\s*|\n\s*\d+[.)]\s*/)[0].trim();
    }

    const options = getQuestionOptions(
      chosenQuestionKey,
      SKILLS,
      userContext.state,
      userContext.hasRegionAndTime,
      {
        hasHistory,
        hasRegionAndTime: userContext.hasRegionAndTime,
        answers: adaptiveAnswers,
        profileSkills: profile.skills ?? [],
        profileCategories: profile.categories ?? [],
      },
    );

    const isLastQuestion = remainingQuestionKeys.length === 1;
    return NextResponse.json({
      done: false,
      reply,
      options,
      questionKey: chosenQuestionKey,
      answeredCount: userTurnCount,
      maxQuestions: MAX_USER_TURNS,
      isLastQuestion,
    });
  }

  const targetRegions = adaptiveAnswers.selectedRegion
    ? [adaptiveAnswers.selectedRegion]
    : profile.regions;

  const scoringProfile: ScoringProfile = {
    categories: profile.categories,
    skills: effectiveSkills ?? [],
    historyCategories: fieldReferenceCategories,
    timePrefs: profile.timePrefs,
    availableTimes: profile.availableTimes,
    regions: targetRegions,
    followingIds: following.map((person) => person.id),
  };

  const finalReply = getRecommendationReply({
    nickname: profile.nickname,
    answers: adaptiveAnswers,
    selectedSkills,
    fieldReferenceCategories,
  });

  // 사용자가 대화에서 '같은 분야' 또는 프로필 관심 분야를 확인하고 수락한 경우 (familiar) 카테고리 자동 설정
  if (
    adaptiveAnswers.fieldPreference === 'familiar' &&
    (!adaptiveAnswers.selectedCategories ||
      adaptiveAnswers.selectedCategories.length === 0 ||
      adaptiveAnswers.selectedCategories.includes('상관없음'))
  ) {
    if (fieldReferenceCategories && fieldReferenceCategories.length > 0) {
      adaptiveAnswers.selectedCategories = [...fieldReferenceCategories];
      adaptiveAnswers.selectedCategory = fieldReferenceCategories[0];
    } else {
      const validCats = (profile.categories ?? []).filter((c) => c !== '전체');
      if (validCats.length > 0) {
        adaptiveAnswers.selectedCategories = validCats;
        adaptiveAnswers.selectedCategory = validCats[0];
      }
    }
  }

  // 사용자가 대화에서 명시적으로 카테고리를 선택한 경우 이를 최우선으로 반영 (복수 카테고리 지원)
  let filterCategories: string[] = [];
  if (adaptiveAnswers.selectedCategories && adaptiveAnswers.selectedCategories.length > 0) {
    filterCategories = adaptiveAnswers.selectedCategories.filter((c) => c !== '상관없음');
  } else if (adaptiveAnswers.selectedCategory && adaptiveAnswers.selectedCategory !== '상관없음') {
    filterCategories = [adaptiveAnswers.selectedCategory];
  } else {
    filterCategories = allowedCategories(conversation.categories);
    if (filterCategories.length === 0) {
      const fallback = fallbackConversation({
        messages,
        nickname: profile.nickname,
        answers: adaptiveAnswers,
        profileSkills: profile.skills ?? [],
        selectedSkills,
        fieldReferenceCategories,
        hasHistory,
        profileCategories: profile.categories,
        questionKey: null,
        userState: userContext.state,
        knownFacts: userContext.knownFacts,
        pastActivitySummary: userContext.pastActivitySummary,
      });
      filterCategories = allowedCategories(fallback.categories);
    }
  }

  const allCandidates = await getRecommendCandidates(supabase, user.id, {});
  const categoryCandidates =
    filterCategories.length > 0
      ? allCandidates.filter((action) => {
          const actionCats = [action.category, ...(action.categories ?? [])];
          return filterCategories.some((c) => (actionCats as string[]).includes(c));
        })
      : allCandidates;

  const hasRegionFilter =
    targetRegions.length > 0 &&
    !targetRegions.includes(NATIONWIDE) &&
    adaptiveAnswers.travelRange !== 'any';
  let candidates = categoryCandidates;
  if (hasRegionFilter) {
    candidates = categoryCandidates.filter((action) =>
      adaptiveAnswers.travelRange === 'province'
        ? sameProvince(action.address, targetRegions)
        : matchesRegion(action.address, targetRegions),
    );
  }
  const relaxation: string[] = [];
  const RELAXATION_MESSAGE =
    '원하시는 조건에 딱 맞는 액션이 많지 않아, 조건을 넓혀 가장 가까운 액션으로 추천해 드렸어요.';

  if (candidates.length === 0 && hasRegionFilter) {
    candidates = categoryCandidates;
    relaxation.push(RELAXATION_MESSAGE);
  }

  if (candidates.length === 0 && filterCategories.length > 0) {
    candidates = allCandidates;
    relaxation.push(RELAXATION_MESSAGE);
  }

  if (candidates.length === 0) {
    return NextResponse.json({
      done: true,
      reply: finalReply,
      options: [],
      relaxation,
      items: [],
    });
  }

  const candidateIds = candidates.map((candidate) => candidate.id);
  const metadataByAction: Record<string, ActionScoringMetadata> = {};
  const [{ data: metas }, { data: actionItems }] = await Promise.all([
    supabase
      .from('action_ai_metadata')
      .select(
        'action_id, categories, activity_types, target_groups, participation_modes, skills, keywords, difficulty',
      )
      .in('action_id', candidateIds),
    supabase
      .from('action_items')
      .select('action_id, type, name, min_required, max_allowed, gender_requirement')
      .in('action_id', candidateIds),
  ]);

  const itemsByAction = new Map<
    string,
    Array<{ type: string; name?: string; min_required: number; max_allowed: number | null; gender_requirement?: string }>
  >();
  for (const item of actionItems ?? []) {
    const items = itemsByAction.get(item.action_id) ?? [];
    items.push(item);
    itemsByAction.set(item.action_id, items);
  }

  // 0순위 성별 하드 필터링: 사용자 성별과 모집 성별 검증
  const userGender = profile.gender;
  if (userGender) {
    const genderFiltered = candidates.filter((action) => {
      const items = itemsByAction.get(action.id) ?? [];
      const personItems = items.filter((it) => it.type === 'PERSON');
      if (personItems.length === 0) return true;
      return personItems.some(
        (it) => !it.gender_requirement || it.gender_requirement === 'ANY' || it.gender_requirement === userGender,
      );
    });
    if (genderFiltered.length > 0) {
      candidates = genderFiltered;
    }
  }

  type MetaRecord = NonNullable<typeof metas>[number];
  const metasById = new Map<string, MetaRecord>();
  for (const metadata of metas ?? []) {
    metasById.set(metadata.action_id, metadata);
    metadataByAction[metadata.action_id] = {
      categories: metadata.categories ?? [],
      participationModes: metadata.participation_modes ?? [],
      skills: metadata.skills ?? [],
      groupSize: totalGroupSize(itemsByAction.get(metadata.action_id) ?? []),
      targetGroups: metadata.target_groups ?? [],
      difficulty: metadata.difficulty ?? null,
      activityTypes: metadata.activity_types ?? [],
      keywords: metadata.keywords ?? [],
    };
  }
  for (const candidateId of candidateIds) {
    metadataByAction[candidateId] ??= {
      categories: [],
      participationModes: [],
      skills: [],
      groupSize: totalGroupSize(itemsByAction.get(candidateId) ?? []),
      targetGroups: [],
      difficulty: null,
      activityTypes: [],
      keywords: [],
    };
  }

  const participationMode = conversation.participation_mode ?? null;
  const resolvedSkills =
    adaptiveAnswers.selectedSkills && adaptiveAnswers.selectedSkills.length > 0
      ? adaptiveAnswers.selectedSkills
      : (adaptiveAnswers.selectedSkill === 'profile'
          ? (profile.skills ?? [])
          : (adaptiveAnswers.selectedSkill ? [adaptiveAnswers.selectedSkill] : selectedSkills));
  const resolvedSkill = resolvedSkills[0] ?? null;
  const resolvedCategory =
    adaptiveAnswers.selectedCategory && adaptiveAnswers.selectedCategory !== '상관없음'
      ? adaptiveAnswers.selectedCategory
      : (filterCategories.length === 1 ? filterCategories[0] : null);

  const scoringAnswers: ScoringAnswers = {
    participationMode,
    category: resolvedCategory,
    categories: filterCategories,
    range: relaxation.length > 0 ? 'any' : null,
    talentPreference:
      adaptiveAnswers.talentPreference === 'new_skill'
        ? 'use'
        : (adaptiveAnswers.talentPreference ?? null),
    groupSizePreference: adaptiveAnswers.groupSizePreference ?? null,
    fieldPreference: null,
    travelRange: adaptiveAnswers.travelRange ?? null,
    targetGroupPreference: adaptiveAnswers.vibePreference ?? null,
    difficultyPreference: adaptiveAnswers.difficultyPreference ?? null,
    activityTypePreference: adaptiveAnswers.activityType ?? null,
    selectedSkill: resolvedSkill,
    selectedSkills: resolvedSkills,
    userKeywords: adaptiveAnswers.userKeywords ?? [],
    userTimePreferences: adaptiveAnswers.timePreferences ?? [],
    selectedRegion: adaptiveAnswers.selectedRegion ?? null,
  };

  // 1) 서버 코드 100점 만점 랭킹 계산으로 Top 3 확정 (환각 및 점수 역전 원천 차단)
  const codeRanked = rankActions(
    candidates,
    scoringProfile,
    scoringAnswers,
    metadataByAction,
    3,
  );

  // 조건 완화(Relaxation) 안내 검사: 사용자가 선택한 핵심 조건에 부합하는 액션이 top 3에 없는 경우 종합 안내
  let isConditionRelaxed = relaxation.length > 0;

  if (!isConditionRelaxed) {
    if (scoringAnswers.targetGroupPreference === 'task') {
      const hasTask = codeRanked.some((it) => it.matched.includes('과업·집중형 활동'));
      if (!hasTask) isConditionRelaxed = true;
    } else if (scoringAnswers.targetGroupPreference === 'social') {
      const hasSocial = codeRanked.some((it) => it.matched.includes('교류·소통형 활동'));
      if (!hasSocial) isConditionRelaxed = true;
    }

    const userRequestedSpecificSkills =
      scoringAnswers.selectedSkills &&
      scoringAnswers.selectedSkills.length > 0 &&
      !scoringAnswers.selectedSkills.includes('기타');
    if (userRequestedSpecificSkills) {
      const hasSkillMatch = codeRanked.some((it) =>
        it.matched.some((m) => m.includes('재능 활용')),
      );
      if (!hasSkillMatch) isConditionRelaxed = true;
    }

    if (scoringAnswers.activityTypePreference === 'outdoor') {
      const hasOutdoor = codeRanked.some((it) =>
        it.matched.includes('야외 활동') || it.matched.includes('실내외 병행 활동'),
      );
      if (!hasOutdoor) isConditionRelaxed = true;
    } else if (scoringAnswers.activityTypePreference === 'indoor') {
      const hasIndoor = codeRanked.some((it) =>
        it.matched.includes('실내 활동') || it.matched.includes('실내외 병행 활동'),
      );
      if (!hasIndoor) isConditionRelaxed = true;
    }
  }

  if (isConditionRelaxed) {
    relaxation.push(RELAXATION_MESSAGE);
  }

  const uniqueRelaxation = Array.from(new Set(relaxation));

  const userSelectedSkills =
    scoringAnswers.selectedSkills && scoringAnswers.selectedSkills.length > 0
      ? scoringAnswers.selectedSkills.filter((s) => s !== '기타')
      : (scoringAnswers.selectedSkill && scoringAnswers.selectedSkill !== '기타' ? [scoringAnswers.selectedSkill] : []);

  // 2) 선정된 Top 3 후보에 대해 AI가 개인화 맞춤 추천 이유(reason) 서술
  const candidateSummaries = codeRanked.map((item) => {
    const action = item.action;
    const meta = metasById.get(action.id);
    const scheduleStr = action.activityStartAt
      ? `${formatDate(action.activityStartAt)} ${formatTime(action.activityStartAt)} (${isWeekend(action.activityStartAt) ? '주말' : '평일'})`
      : '일정 미정';
    const rawItems = itemsByAction.get(action.id) ?? [];
    const recruitmentItems = rawItems
      .filter((it) => it.name && it.name.trim().length > 0)
      .map((it) => (it.type === 'PERSON' ? `${it.name}(모집)` : `${it.name}(물품)`));

    const actionSkills = meta?.skills ?? [];
    const matchedUserSkills = actionSkills.filter((s) => userSelectedSkills.includes(s));
    const isSocialAction = (meta?.target_groups ?? []).some((g) => /교류|교육|소통/.test(g));
    const isTaskAction = (meta?.target_groups ?? []).some((g) => /과업|육체|집중/.test(g));
    const actualVibeDescription =
      isSocialAction && isTaskAction
        ? '교류·소통과 육체적 작업이 함께 있는 복합 활동'
        : isSocialAction
          ? '사람과의 대화, 상담, 정서적 유대가 중심인 교류·소통형 활동'
          : isTaskAction
            ? '작업, 땀 흘리기, 결과물 완성이 중심인 육체·과업·집중형 활동'
            : '일반 활동';

    return {
      actionId: action.id,
      title: action.title,
      category: action.category,
      address: action.address,
      activityTypes: meta?.activity_types ?? [],
      targetGroups: meta?.target_groups ?? [],
      actualVibeDescription,
      isSocialAction,
      isTaskAction,
      participationModes: meta?.participation_modes ?? [],
      matchedUserSkills,
      actionRequiresSkills: actionSkills,
      recruitmentItems,
      actualSchedule: scheduleStr,
      matchedReasons: item.matched,
    };
  });

  const reasonsMap: Record<string, string> = {};

  try {
    const aiRec = await callStructuredAI({
      agent: 'DISCOVER',
      promptVersion: RECOMMEND_PROMPT_VERSION,
      system: `당신은 선한 영향력 SNS '착착'의 액션 추천 전문 AI 에이전트입니다.
선정된 각 액션에 대해 사용자의 성향과 대화 내용을 바탕으로 왜 이 액션이 사용자에게 꼭 맞는지 1~2문장의 다정하고 구체적인 추천 이유(reason)를 작성하세요.
영어 'Action'이나 '봉사/봉사활동/수혜자' 단어를 절대 쓰지 말고 한글 '액션'으로 서술하세요.

[필수 작성 규칙 및 사실 검증 원칙 - 절대 위반 금지]

1. ★★★ [재능 날조 및 사용자 미보유 재능 언급 절대 금지]:
   - 오직 이 액션의 'matchedUserSkills'에 재능명이 들어있을 때만 "사용자님의 [재능명] 재능을 살려..."라고 작성할 수 있습니다.
   - ★ [매우 중요] 'matchedUserSkills'가 빈 배열([])인 액션의 경우:
     사용자가 선택한 재능과 이 액션의 요구 재능이 일치하지 않는 상태입니다. 액션 정보(actionRequiresSkills)에 적힌 다른 재능(예: 미술·공예, 요리, 운전 등)을 사용자가 가지고 있다고 절대 거짓 서술하지 마세요!
     (위반 금지 예시: 교육·멘토링을 선택한 사용자에게 액션이 네일아트라고 해서 "미술·공예 재능을 활용하여 네일아트를 해보세요"라고 권유하는 것은 심각한 날조입니다.)
     이 경우 재능에 대한 언급은 일체 하지 말고, 액션의 분야(노인 복지 등), 따뜻한 대화/정서적 교류, 활동의 보람 등 액션 본연의 특성으로만 진솔하게 추천 이유를 작성하세요.

2. ★★★ [활동 성격 왜곡 및 '육체적 재능' 날조 절대 금지]:
   - '교류·소통형'이나 '육체·과업·집중형'은 활동의 '분위기/진행 방식'이지 '재능'이 아닙니다! "육체적인 재능", "집중적인 재능" 같은 해괴한 표현은 절대 사용하지 마세요.
   - 말벗, 대화, 상담, 멘토링 같은 소통형 액션을 '육체적인 활동', '몸 쓰는 활동'이라고 사실과 다르게 왜곡하지 마세요. (어르신 댁을 방문해 대화하고 혈압 재는 활동은 육체 활동이 아닌 따뜻한 소통 활동입니다.)
   - 사용자가 희망한 활동 성격(예: 육체·과업형)과 액션의 실제 성격(actualVibeDescription: 소통형)이 다를 경우(조건 완화 등으로 추천된 경우), 액션을 육체형으로 둔갑시키지 말고 "원하시던 몸 쓰는 활동은 아니지만, 어르신과 차 한잔 나누며 따뜻한 이야기를 전할 수 있는 액션이에요"처럼 정직하게 안내하거나, 액션 본연의 소통 가치를 서술하세요.

3. [세부 모집 항목(recruitmentItems) 역할 타겟팅]:
   - 액션의 recruitmentItems 중 사용자가 실제로 선택한 재능(matchedUserSkills)이나 역할에 부합하는 세부 파트가 있을 때만 구체적 파트명을 언급하세요.

4. [조건 완화 솔직한 안내 및 '상관없음' 규칙]:
   - 사용자가 환경이나 규모를 '상관없음'으로 선택한 경우에는, '실내에서 진행되지만', '비록 ~이지만' 같은 변명조 문구를 절대 쓰지 마세요.

5. [일정 날조 엄격 금지]:
   - actualSchedule에 나와 있는 평일/주말 요일을 절대 반대로 지어내지 마세요.

반드시 JSON 형식으로만 답하세요:
{"reasons": {"actionId1": "추천 이유 1", "actionId2": "추천 이유 2", ...}}`,
      temperature: 0.3,
      user: JSON.stringify({
        사용자닉네임: profile.nickname,
        사용자선택조건: {
          관심분야: scoringAnswers.categories ?? [scoringAnswers.category],
          선택재능: userSelectedSkills.length > 0 ? userSelectedSkills : ['선택하지 않음 / 재능 상관없음'],
          희망활동성격:
            scoringAnswers.targetGroupPreference === 'social'
              ? '교류·교육·소통형'
              : scoringAnswers.targetGroupPreference === 'task'
                ? '육체·과업·집중형'
                : '상관없음',
          활동환경:
            scoringAnswers.activityTypePreference === 'indoor'
              ? '실내'
              : scoringAnswers.activityTypePreference === 'outdoor'
                ? '실외'
                : '상관없음',
          모임규모: scoringAnswers.groupSizePreference ?? '상관없음',
        },
        선정된액션목록: candidateSummaries,
      }),
      schema: z.object({
        reasons: z.record(z.string(), z.string()).catch({}).default({}),
      }),
      userId: user.id,
    });

    Object.assign(reasonsMap, aiRec.reasons);
  } catch {
    // AI 실패 시 기본 이유(fallbackReason) 사용
  }

  const topItems = codeRanked.map((item) => {
    let reason = reasonsMap[item.action.id]?.trim();
    const meta = metasById.get(item.action.id);
    const isSocial = (meta?.target_groups ?? []).some((g) => /교류|교육|소통/.test(g));
    const isTask = (meta?.target_groups ?? []).some((g) => /과업|육체|집중/.test(g));
    const matchedSkills = (meta?.skills ?? []).filter((s) => userSelectedSkills.includes(s));

    if (reason) {
      // 1) '육체적인 재능', '집중적인 재능' 같은 해괴한 합성어 감지 시 fallbackReason으로 대체
      if (/육체적.*재능|집중적.*재능/.test(reason)) {
        reason = fallbackReason(item);
      }

      // 2) 순수 소통형 액션인데 '육체적', '몸 쓰는' 단어가 들어간 거짓말 감지 시 fallbackReason으로 대체
      if (isSocial && !isTask && /육체|몸\s*쓰는|땀\s*흘리는/.test(reason)) {
        reason = fallbackReason(item);
      }

      // 3) 사용자가 선택하지 않은 다른 재능을 사용자가 발휘한다고 날조한 경우 감지 시 fallbackReason으로 대체
      if (userSelectedSkills.length > 0 && matchedSkills.length === 0) {
        const unownedSkills = ALL_15_SKILLS.filter((s) => !userSelectedSkills.includes(s) && s !== '기타');
        const hasUnownedSkillMention = unownedSkills.some((s) => reason.includes(s) && reason.includes('재능'));
        if (hasUnownedSkillMention || /재능을\s*(활용|발휘|살려)/.test(reason)) {
          reason = fallbackReason(item);
        }
      }

      // 4) 사용자가 활동 환경을 '상관없음'으로 선택했거나 환경 제약이 없는 경우, 불필요한 변명 멘트 제거
      if (scoringAnswers.activityTypePreference === 'any' || !scoringAnswers.activityTypePreference) {
        reason = reason
          .replace(/(실내|야외|실외)에서\s*진행되지만,?\s*/g, '')
          .replace(/원하시던\s*(실내|실외|야외)[^,]*아니지만,?\s*/g, '')
          .replace(/비록\s*(실내|실외|야외)[^,]*지만,?\s*/g, '')
          .trim();
      }

      // 5) 일정 날조 검증
      if (item.action.activityStartAt) {
        const isWk = isWeekend(item.action.activityStartAt);
        // 평일 액션인데 주말을 지어낸 경우
        if (!isWk && (reason.includes('주말') || reason.includes('토요일') || reason.includes('일요일'))) {
          reason = fallbackReason(item);
        } else if (isWk && (reason.includes('평일') || /월요일|화요일|수요일|목요일|금요일/.test(reason))) {
          // 주말 액션인데 평일을 지어낸 경우
          reason = fallbackReason(item);
        }
      } else {
        // 일정이 미정인 액션인데 특정 요일/주말을 지어낸 경우
        if (reason.includes('주말') || reason.includes('평일') || /월요일|화요일|수요일|목요일|금요일|토요일|일요일/.test(reason)) {
          reason = fallbackReason(item);
        }
      }
    }
    return {
      action: item.action,
      score: item.score,
      reason: reason || fallbackReason(item),
    };
  });

  return NextResponse.json({
    done: true,
    reply: finalReply,
    options: [],
    relaxation: uniqueRelaxation,
    items: topItems,
    summaryChips: formatSummaryChips(messages),
  });
}
