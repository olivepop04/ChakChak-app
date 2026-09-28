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
import { getRecommendCandidates } from '@/lib/queries/actions';
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
  ALL_15_SKILLS,
  CHEERING_OR_CASUAL_REGEX,
  type QuestionKey,
  type UserStateCategory,
} from '@/app/api/ai/discover/interview';
import { CATEGORIES, SKILLS, type Category } from '@/lib/constants';
import { matchesRegion, NATIONWIDE } from '@/lib/constants/regions';
import { formatDate, formatTime, isWeekend } from '@/lib/utils/date';

const CHAT_PROMPT_VERSION = 'discover-v3-zero-assumption';
const RECOMMEND_PROMPT_VERSION = 'discover-recommend-v4-anti-hallucination';
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
6. 없는 사실이나 사용자 정보를 추측하거나 임의로 지어내지 마세요.
7. 말풍선(reply) 본문에 선택지 항목이나 예시 목록(불릿 기호 -, •, * 등)을 절대 나열하지 마세요. 모든 선택지는 화면 하단 선택 버튼(options)으로만 노출됩니다. 말풍선에는 질문과 다정한 안내 멘트(1~2문장)만 간결하게 작성하세요.
8. 재능(skills) 질문의 options 배열:
   - 프로필에 재능이 있는 사용자에게 처음 물을 때는 반드시 2지선다 ["예, 그럴게요 👍", "아니요, 다른 재능으로 할게요 🔄"]를 제공하세요.
   - 프로필에 재능이 없거나 사용자가 "다른 재능으로 할게요"를 선택한 경우에만 사전 정의된 16종 목록 ['사진 촬영', '영상 촬영·편집', '디자인', '글쓰기', 'SNS 홍보', '요리', '운전', '교육·멘토링', '통역·번역', '컴퓨터·IT', '원예·식물관리', '청소·정리', '미술·공예', '음악·공연', '수리·시공', '기타']을 정확히 제공하세요. 말풍선 멘트에는 절대 "위 16종"이라고 하지 말고, 반드시 "{nickname}님이 활용할 수 있는 재능을 아래 선택지에서 골라주세요"라고 안내하세요.
9. question_key는 반드시 시스템이 제공한 '남은질문' 배열에 존재하는 키 중에서만 선택해야 합니다. 남은질문에 없는 질문 키(예: 난이도에서 '기초 체력 필요'나 '누구나 참여가능'을 선택하여 재능 질문이 생략된 상황에서 "skills")를 반환하는 것은 엄격히 금지됩니다.

[질문 순서 및 분기 제어 시나리오 (우선순위 0~5)]
대화는 아래 우선순위에 따라 순서대로 진행합니다. 이미 파악되었거나 스킵 조건에 해당하는 질문은 절대 반복하지 마세요.

0. 오프닝 및 지역/시간 상시 확인 (모든 유저 공통):
   - 프로필에 지역과 시간이 등록되어 있는 경우:
     - 멘트: "안녕하세요, {nickname}님! 😊 {nickname}님에게 딱 맞는 액션을 찾기 위해 프로필에 등록된 기본 조건을 확인해 봤어요.\n\n📍 활동 지역 : {profileRegion}\n⏰ 선호 시간 : {profileTimesSummary}\n\n이 조건 그대로 액션을 찾아드릴까요?"
     - options: ["네, 이 조건으로 찾을게요 👍", "이번엔 다른 조건으로 찾을래요 🔄"]
   - 프로필에 지역이나 시간이 없는 경우:
     - 멘트: "안녕하세요, {nickname}님! 만나서 반가워요. 😊 {nickname}님에게 딱 맞는 액션을 찾아드리기 위해 활동하실 지역과 시간을 먼저 확인하고 싶어요.\n\n먼저, 이번에 어느 지역에서 활동하고 싶으세요?"
     - options: ["활동할 지역 선택하기 📍", "지역 상관없이 전국 액션 볼래요 🌏"]

1. 카테고리 (categories) - 분야 선택:
   - 과거 활동 이력 카테고리가 있는 경우:
     - 멘트: "{nickname}님의 지난 활동들을 살펴보니 [{historyCategories}] 분야에 주로 참여하셨네요. 이번에도 비슷한 분야로 찾아드릴까요?"
     - options: ["같은 분야로 찾을래요", "새로운 분야에 도전해볼래요"]
     - ("새로운 분야" 선택 시: ["동물", "환경", "지역사회", "아동·청소년", "노인", "장애", "교육", "기타", "상관없음"])
   - 활동 이력이 없는 경우:
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
     - 프로필 재능이 있는 경우: "프로필에 [{userSkills}] 재능이 있다고 알려주셨는데, 이 재능을 살릴 수 있는 액션을 찾아볼까요?" (options: ["예, 그럴게요 👍", "아니요, 다른 재능으로 할게요 🔄"])
     - 프로필 재능이 없거나 '다른 재능으로 할게요' 선택 시: "{nickname}님이 활용할 수 있는 재능을 아래 선택지에서 골라주세요." (options: 16종 재능 목록)

4. 활동 환경 (activity_types):
   - 멘트: 직전에 사용자가 재능을 선택한 경우 "알려주신 재능을 살릴 수 있는 액션으로 함께 찾아볼게요! ✨"를 앞머리에 붙이고, "어떤 환경에서 활동하고 싶으세요?"라고 질문하세요. (재능 중 하나만 임의로 골라 대표로 지정하지 마세요)
   - options: ["실내 활동", "실외 활동", "실내외 병행", "상관없음"]

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
      }),
      question_key: questionKey,
      enough: false,
      options: getQuestionOptions(questionKey, SKILLS, userState, true, {
        hasHistory,
        answers,
        profileSkills,
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

  const [profile, history, following] = await Promise.all([
    getProfile(supabase, user.id, user.id),
    getParticipatedActions(supabase, user.id, user.id),
    getFollowing(supabase, user.id, user.id),
  ]);

  if (!profile) {
    return NextResponse.json(
      { error: '프로필을 먼저 완성해주세요.' },
      { status: 400 },
    );
  }

  const historyCategories = [
    ...new Set(history.map((action) => action.category)),
  ];
  const hasHistory = history.length > 0;
  const fieldReferenceCategories = hasHistory
    ? historyCategories
    : allowedCategories(profile.categories);

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
    conversation = await callStructuredAI({
      agent: 'DISCOVER',
      promptVersion: CHAT_PROMPT_VERSION,
      system: CHAT_SYSTEM,
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
          나눌수있는재능: effectiveSkills,
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
        options: [...ALL_15_SKILLS, '기타'],
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
        options: [...ALL_15_SKILLS, '기타'],
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

    // 만약 프로필에 재능이 있는 사용자가 재능 질문으로 진입했다면, 맞춤 프로필 재능 확인 멘트 적용
    const hasProfileSkills = (profile.skills ?? []).length > 0;
    const isAskingProfileSkill =
      chosenQuestionKey === 'skills' &&
      hasProfileSkills &&
      adaptiveAnswers.talentPreference !== 'new_skill';

    if (isAskingProfileSkill) {
      reply = fallback.reply;
    }

    // 만약 AI가 이미 답변된 질문 축을 되묻거나, 남은 질문 축과 불일치하는 질문을 냈다면, 다음 남은 질문의 안내로 교체
    const isMismatchedReply =
      isAiSuccess &&
      !isQuestionInquiry &&
      (
        (conversation.question_key && !remainingQuestionKeys.includes(conversation.question_key)) ||
        (chosenQuestionKey !== conversation.question_key) ||
        (/재능|기술|특기|어떤 재능/.test(reply) && (chosenQuestionKey === 'activity_types' || chosenQuestionKey === 'activity_type'))
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
      .select('action_id, type, min_required, max_allowed, gender_requirement')
      .in('action_id', candidateIds),
  ]);

  const itemsByAction = new Map<
    string,
    Array<{ type: string; min_required: number; max_allowed: number | null; gender_requirement?: string }>
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
    fieldPreference:
      adaptiveAnswers.fieldPreference === 'selected'
        ? 'new'
        : (adaptiveAnswers.fieldPreference ?? null),
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

  // 2) 선정된 Top 3 후보에 대해 AI가 개인화 맞춤 추천 이유(reason) 서술
  const candidateSummaries = codeRanked.map((item) => {
    const action = item.action;
    const meta = metasById.get(action.id);
    const scheduleStr = action.activityStartAt
      ? `${formatDate(action.activityStartAt)} ${formatTime(action.activityStartAt)} (${isWeekend(action.activityStartAt) ? '주말' : '평일'})`
      : '일정 미정';
    return {
      actionId: action.id,
      title: action.title,
      category: action.category,
      address: action.address,
      activityTypes: meta?.activity_types ?? [],
      targetGroups: meta?.target_groups ?? [],
      participationModes: meta?.participation_modes ?? [],
      skills: meta?.skills ?? [],
      keywords: meta?.keywords ?? [],
      difficulty: meta?.difficulty ?? null,
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
1. [대화 맥락 및 매칭 이유 구체적 서술]:
   - 사용자가 이번 대화에서 선택한 관심 분야, 재능(skills: 예: 요리, 디자인, 교육·멘토링 등), 활동 성격(교류·소통형/과업·집중형), 활동 환경(실내/야외)과 이 액션의 특성을 직접 연결하여 설명하세요.
   - 예: "선택하신 교육 분야에서 교육·멘토링 재능을 발휘하며 어르신들과 따뜻하게 소통할 수 있는 액션이에요."
2. [조건 완화(대체 추천) 솔직한 안내]:
   - 만약 사용자가 희망한 특정 조건(예: 야외 활동 희망)과 달리 추천된 액션이 다른 환경(실내)이거나 조건에 완전히 맞지 않는 경우, 거짓말하지 말고 "원하시던 야외 활동은 아니지만, 선택하신 교육 분야와 교육·멘토링 재능을 나누기에 꼭 맞아 추천해 드려요"처럼 솔직하고 친절하게 설명하세요.
3. [일정 및 시간대 날조(할루시네이션) 엄격 금지]:
   - 액션의 실제 일정(actualSchedule: 날짜, 요일, 시간대)과 다른 요일이나 시간대를 절대 지어내지 마세요.
   - 액션의 실제 일정이 평일인 경우 "주말에 참여할 수 있어...", "주말 오전이나 오후에..."처럼 거짓된 일정을 지어내어 설명하면 절대 안 됩니다.
   - 일정이 정해져 있다면 actualSchedule에 맞는 요일(예: 10월 5일 월요일)은 정확하게 안내해도 좋습니다. 단, 주말 액션을 평일로, 평일 액션을 주말로 속이지 마세요.
4. [표현 규칙]:
   - '익숙한 환경'이라는 부정확한 표현은 절대 사용하지 마세요. (과거 이력을 언급할 때는 '익숙한 분야'라고 표현하세요.)

반드시 JSON 형식으로만 답하세요:
{"reasons": {"actionId1": "추천 이유 1", "actionId2": "추천 이유 2", ...}}`,
      temperature: 0.3,
      user: JSON.stringify({
        사용자답변: messages.filter((m) => m.role === 'user'),
        사용자닉네임: profile.nickname,
        선정된액션목록: candidateSummaries,
        사용자선택조건: {
          관심분야: scoringAnswers.categories ?? [scoringAnswers.category],
          선택재능: scoringAnswers.selectedSkills,
          활동성격: scoringAnswers.targetGroupPreference,
          활동환경: scoringAnswers.activityTypePreference,
          모임규모: scoringAnswers.groupSizePreference,
        },
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
    if (reason) {
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
