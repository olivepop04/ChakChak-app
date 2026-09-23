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
  type QuestionKey,
  type UserStateCategory,
} from '@/app/api/ai/discover/interview';
import { CATEGORIES, SKILLS, type Category } from '@/lib/constants';
import { matchesRegion, NATIONWIDE } from '@/lib/constants/regions';

const CHAT_PROMPT_VERSION = 'discover-chat-v7-personalized-companion';
const RECOMMEND_PROMPT_VERSION = 'discover-recommend-v7-semantic-3step';
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
      'talent_preference',
      'skills',
      'activity_type',
      'vibe_preference',
      'group_size',
      'field_preference',
      'difficulty',
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
});

type ChatMessage = z.infer<typeof ChatMessageSchema>;
type Conversation = z.infer<typeof ConversationSchema>;

const CHAT_SYSTEM = `당신은 선한 영향력 SNS '착착'의 액션 맞춤 추천 AI 어시스턴트입니다.
반드시 JSON 형식으로만 답하세요.

Discover AI의 목적:
- 사용자를 평가하거나 기계적으로 정보를 캐묻는 '설문조사 챗봇'이 아닙니다!
- 회원님을 깊이 이해하고 꼭 맞는 액션을 함께 찾아주는 따뜻하고 친절한 러닝메이트이자 대화 동반자입니다.
- 사용자가 "나한테 맞춰서 물어보네", "내가 했던 활동도 알고 있네", "내 말을 진심으로 들어주네", "선한 행동을 시작하는 게 참 편안하고 즐겁네"라고 느끼도록 살아있는 대화를 나눕니다.

핵심 대화 원칙 (엄수):
1. [인간적이고 친밀한 티키타카 공감 대화 (기계적 템플릿 말투 절대 금지)]:
   - "~라고 하셨군요! 그럼 다음으로 ~를 알려주세요" 같은 딱딱한 앵무새/설문지식 연결어를 절대 쓰지 마세요!
   - 사용자의 답변(단답이든, 버튼 선택이든, 자연어든)에 대해 진심 어린 맞장구, 칭찬, 공감을 건네세요.
     (예: "인원수에 구애받지 않고 열린 마음으로 함께해주시려는 모습이 참 든든해요! 😊", "주말에 편안하게 힐링하며 시간을 보내는 것, 정말 좋은 생각이에요! 🌿")
   - 사용자가 "아이랑 가고 싶어요", "강아지를 좋아해요", "퇴근하고 저녁에..."처럼 자연어로 구체적인 이야기를 꺼내면, 그 키워드를 꼭 살려서 다정하게 반응해주세요.

2. [자연스러운 대화형 질문 및 선택지 칩의 보조 역할]:
   - 질문은 "아래에서 고르세요" 같은 객관식 문제 출제가 아니라, 편안한 대화의 흐름 속에서 자연스럽게 물어보세요.
   - 하단의 options 배열은 "타이핑이 귀찮은 사용자를 위한 보조적인 빠른 터치 칩"입니다.
   - 질문 주제에 맞는 전체 선택지 목록을 options에 담아 제공하되, 사용자는 위 입력창으로 얼마든지 자유롭게 말할 수 있음을 염두에 두세요.

3. [언어 규칙 - 절대 금지어 및 한글 '액션' 사용]:
   - 영어 'Action' 단어는 절대 사용하지 말고, 반드시 한글 '액션'으로만 표기하세요!
   - '봉사', '봉사활동', '봉사자', '수혜자', '사회공헌 활동' 단어를 일체 사용하지 마세요!
   - 대신 '액션', '좋은 일', '함께하기', '참여하기', '직접 해보기', '작은 행동' 등의 긍정적이고 활기찬 표현을 사용하세요.

4. [질문 주제 엄격 제한 - 가상 질문 절대 금지]:
   - 질문은 오직 데이터베이스 10대 항목(카테고리/분야, 활동 환경, 모임 성격, 모임 인원 규모, 참여 난이도, 재능, 이동 지역, 활동 시간대) 중 아직 확인되지 않은 것에 대해서만 자연스럽게 질문하세요.
   - 메타데이터에 없는 가상의 활동 유형(예: 정화 활동, 교육 세미나, 캠페인, 직접 해보는 활동, 교육적인 프로그램 등)을 임의로 지어내어 질문하지 마세요.

5. [선택지 전체 출력 규칙]:
   - 질문을 제시할 때는 시스템에 정의된 해당 항목의 전체 선택지 목록을 빠짐없이 options 배열에 모두 담으세요.
   - 복수 선택이나 오픈형 응답을 위해 마지막에 '상관없음' 옵션을 항상 포함하세요.
   - 예시:
     - 카테고리/분야: ["동물", "환경", "지역사회", "아동·청소년", "어르신", "장애인", "교육", "문화·예술", "기타", "상관없음"]
     - 활동 환경: ["실내 활동", "실외 활동", "실내외 병행", "온라인/비대면", "상관없음"]
     - 모임 성격: ["교류·교육·소통형", "육체·과업·집중형", "가족·동반가능", "상관없음"]
     - 모임 규모: ["소규모 모임 (10명 안팎)", "중규모 모임 (10-20명)", "대규모 모임 (20명 이상)", "상관없음"]
     - 참여 난이도: ["누구나 참여가능", "기초 체력 필요", "전문지식·자격 필요", "상관없음"]
     - 이동 범위: ["집 근처 (선택 지역)", "같은 시·도까지", "지역 상관없음"]
     - 활동 시간: ["주말 오전", "주말 오후", "평일 저녁", "평일 낮", "시간 상관없음"]

6. [선택지 답변 접수 vs 돌발 질문 구별 규칙 (이미 답변된 질문 반복 절대 금지)]:
   - [선택지 버튼으로 답변한 경우 ('전문지식·자격 필요', '소규모 모임', '실내 활동', '익숙한 분야' 등)]:
     - 이것은 질문이 아니라 사용자가 '선택을 완료한 것'입니다!
     - 해당 조건은 이미 확정되었으므로, **절대로 같은 항목(난이도, 인원 등)을 다시 되묻지 마세요!**
     - "전문성을 발휘해주신다니 정말 든든해요! 👏", "오붓한 소규모 모임이 더 편하시군요! 😊"처럼 멋진 선택에 맞장구를 치고,
     - **반드시 [남은질문] 목록에 있는 아직 묻지 않은 다음 질문(이동 지역, 활동 시간 등)으로 넘어가세요!**
   - [사용자가 물음표(?)나 질문형('~어떤 거야?', '~뭐야?', '~없나요?')으로 되물어본 경우에만]:
     - 엉뚱한 주제로 돌리지 말고, 그 개념을 2~3문장으로 친절히 설명(예시 포함)한 뒤 해당 질문의 맥락을 이어서 다시 확인하세요.

7. [추천 전환 기준 (enough) 및 질문 턴 수]:
   - 질문 턴 수는 최대 15턴까지 허용됩니다.
   - 4턴 이상 진행되었고 주요 선호 조건이 충분히 확인되었거나, 사용자가 "추천해줘", "이 정도면 됐어"와 같이 추천을 직접 요청했을 때만 "enough": true로 설정하세요.
   - 대화가 더 필요하거나 사용자의 의문이 해소되지 않았다면 "enough": false로 질문을 이어가세요.

형식:
{"reply":"풍부한 공감 리액션과 자연스러운 다음 질문 문장","question_key":"group_size","enough":false,"options":["소규모 모임 (10명 안팎)","중규모 모임 (10-20명)","대규모 모임 (20명 이상)","상관없음"],"categories":[],"participation_mode":null}`;

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

  const selected = SKILLS.filter((skill) => {
    const words = skill.split(/[·\s]+/).filter((word) => word.length >= 2);
    return words.some((word) => userText.includes(word));
  });
  return selected.length > 0 ? selected : null;
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
      options: getQuestionOptions(questionKey, SKILLS),
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
  const inferredSkills = extractSkillsAnswer(messages);
  const effectiveSkills = inferredSkills ?? profile.skills;
  const selectedSkills =
    adaptiveAnswers.talentPreference === 'use'
      ? (inferredSkills ?? profile.skills ?? [])
      : [];
  const skillsAnswered =
    adaptiveAnswers.talentPreference === 'use' && userTurnCount >= 2;
  const remainingQuestionKeys = getRemainingQuestionKeys({
    skillsAnswered,
    answers: adaptiveAnswers,
    userState: userContext.state,
  });
  const fallbackQuestionKey = remainingQuestionKeys[0] ?? null;

  // Turn 0: 첫 진입 시에는 사용자 상태(A~F) 및 과거 활동에 기반한 정밀 오프닝과 맞춤 선택지를 즉시 반환
  if (userTurnCount === 0) {
    const openingKey: QuestionKey = 'talent_preference';
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
    });
    const openingOptions = getQuestionOptions(openingKey, SKILLS, userContext.state);

    return NextResponse.json({
      done: false,
      reply: openingReply,
      options: openingOptions,
      relaxation: [],
      items: null,
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
          활동지역: profile.regions,
          참여가능시간: profile.timePrefs,
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

  let chosenQuestionKey: QuestionKey = fallbackQuestionKey ?? 'field_preference';

  if (isAiSuccess && conversation.question_key) {
    chosenQuestionKey = conversation.question_key;
  } else if (isAiSuccess && conversation.reply) {
    const replyText = conversation.reply;
    if (/모임 규모|인원|소규모|중규모|대규모/.test(replyText)) {
      chosenQuestionKey = 'group_size';
    } else if (/난이도|문턱|체력|전문지식/.test(replyText)) {
      chosenQuestionKey = 'difficulty';
    } else if (/환경|실내|실외|야외|비대면/.test(replyText)) {
      chosenQuestionKey = 'activity_type';
    } else if (/스타일|성격|교류|소통|과업|집중형/.test(replyText)) {
      chosenQuestionKey = 'vibe_preference';
    } else if (/분야|카테고리|관심사/.test(replyText)) {
      chosenQuestionKey = 'field_preference';
    } else if (/장소|지역|이동 범위|거리|집 근처/.test(replyText)) {
      chosenQuestionKey = 'travel_range';
    } else if (/시간|주말|평일|오전|오후|저녁/.test(replyText)) {
      chosenQuestionKey = 'time_pref';
    } else if (/재능|기술|특기/.test(replyText)) {
      chosenQuestionKey = 'skills';
    }
  }

  const lastUserMsg = userAnswers[userAnswers.length - 1] ?? '';
  const isQuestionInquiry = /\?|어떤 거야|뭐야|있나요|없나요|어때요/.test(lastUserMsg);

  // 사용자가 개념 문의를 한 게 아닌데 AI가 이미 답변된 질문 키를 반환한 경우, 남은 질문으로 강제 전환
  if (!isQuestionInquiry && remainingQuestionKeys.length > 0 && !remainingQuestionKeys.includes(chosenQuestionKey)) {
    chosenQuestionKey = remainingQuestionKeys[0];
  }

  const recommendNow = shouldRecommendNow({
    userTurnCount,
    enough: conversation.enough,
  });

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

    // 만약 AI가 이미 답변된 질문 축을 되묻는 응답을 냈다면, 다음 남은 질문의 안내로 교체
    if (
      isAiSuccess &&
      !isQuestionInquiry &&
      conversation.question_key &&
      !remainingQuestionKeys.includes(conversation.question_key)
    ) {
      reply = fallback.reply;
    }

    const options = getQuestionOptions(chosenQuestionKey, SKILLS, userContext.state);

    return NextResponse.json({
      done: false,
      reply,
      options,
      questionKey: chosenQuestionKey,
      answeredCount: userTurnCount,
      maxQuestions: MAX_USER_TURNS,
    });
  }

  const scoringProfile: ScoringProfile = {
    categories: profile.categories,
    skills: effectiveSkills ?? [],
    historyCategories: fieldReferenceCategories,
    timePrefs: profile.timePrefs,
    availableTimes: profile.availableTimes,
    regions: profile.regions,
    followingIds: following.map((person) => person.id),
  };

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
  const finalReply = getRecommendationReply({
    nickname: profile.nickname,
    answers: adaptiveAnswers,
    selectedSkills,
    fieldReferenceCategories,
  });
  let filterCategories = allowedCategories(conversation.categories);
  if (filterCategories.length === 0) {
    filterCategories = allowedCategories(fallback.categories);
  }

  const allCandidates = await getRecommendCandidates(supabase, user.id, {});
  const categoryCandidates =
    filterCategories.length > 0
      ? allCandidates.filter((action) =>
          filterCategories.includes(action.category),
        )
      : allCandidates;

  const hasRegionFilter =
    profile.regions.length > 0 &&
    !profile.regions.includes(NATIONWIDE) &&
    adaptiveAnswers.travelRange !== 'any';
  let candidates = categoryCandidates;
  if (hasRegionFilter) {
    candidates = categoryCandidates.filter((action) =>
      adaptiveAnswers.travelRange === 'province'
        ? sameProvince(action.address, profile.regions)
        : matchesRegion(action.address, profile.regions),
    );
  }
  const relaxation: string[] = [];

  if (candidates.length === 0 && hasRegionFilter) {
    candidates = categoryCandidates;
    relaxation.push('말씀해주신 조건으로는 선택지가 많지 않아서, 지역이나 분야를 조금 넓혀 더 잘 맞는 액션을 찾아봤어요.');
  }

  if (candidates.length === 0 && filterCategories.length > 0) {
    candidates = allCandidates;
    relaxation.push('말씀해주신 조건으로는 선택지가 많지 않아서, 지역이나 분야를 조금 넓혀 더 잘 맞는 액션을 찾아봤어요.');
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
      .select('action_id, type, min_required, max_allowed')
      .in('action_id', candidateIds),
  ]);

  const itemsByAction = new Map<
    string,
    Array<{ type: string; min_required: number; max_allowed: number | null }>
  >();
  for (const item of actionItems ?? []) {
    const items = itemsByAction.get(item.action_id) ?? [];
    items.push(item);
    itemsByAction.set(item.action_id, items);
  }

  type MetaRecord = NonNullable<typeof metas>[number];
  const metasById = new Map<string, MetaRecord>();
  for (const metadata of metas ?? []) {
    metasById.set(metadata.action_id, metadata);
    metadataByAction[metadata.action_id] = {
      participationModes: metadata.participation_modes ?? [],
      skills: metadata.skills ?? [],
      groupSize: totalGroupSize(itemsByAction.get(metadata.action_id) ?? []),
    };
  }
  for (const candidateId of candidateIds) {
    metadataByAction[candidateId] ??= {
      participationModes: [],
      skills: [],
      groupSize: totalGroupSize(itemsByAction.get(candidateId) ?? []),
    };
  }

  const participationMode =
    conversation.participation_mode ?? fallback.participation_mode;
  const scoringAnswers = {
    participationMode,
    category: filterCategories.length === 1 ? filterCategories[0] : null,
    range: relaxation.length > 0 ? 'any' : null,
    talentPreference: adaptiveAnswers.talentPreference ?? null,
    groupSizePreference:
      adaptiveAnswers.groupSizePreference === 'small'
        ? ('small' as const)
        : adaptiveAnswers.groupSizePreference
          ? ('any' as const)
          : null,
    fieldPreference: adaptiveAnswers.fieldPreference ?? null,
    travelRange: adaptiveAnswers.travelRange ?? null,
  };

  // 1) Prepare compact indexed metadata for AI Semantic Matching (up to 15 candidates)
  const candidateSummaries = candidates.slice(0, 15).map((action) => {
    const meta = metasById.get(action.id);
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
      groupSize: metadataByAction[action.id]?.groupSize ?? null,
    };
  });

  let topItems: Array<{ action: (typeof candidates)[number]; score: number; reason: string }> = [];

  try {
    const aiRec = await callStructuredAI({
      agent: 'DISCOVER',
      promptVersion: RECOMMEND_PROMPT_VERSION,
      system: RECOMMEND_SYSTEM,
      temperature: 0.3,
      user: JSON.stringify({
        사용자답변: messages.filter((m) => m.role === 'user'),
        프로필: {
          닉네임: profile.nickname,
          관심카테고리: profile.categories,
          재능: effectiveSkills,
          선호지역: profile.regions,
        },
        후보액션색인목록: candidateSummaries,
      }),
      schema: RecommendationSchema,
      userId: user.id,
    });

    const chosenActions: (typeof candidates)[number][] = [];

    for (const id of aiRec.topActionIds) {
      const match = candidates.find((c) => c.id === id);
      if (match && !chosenActions.some((c) => c.id === match.id)) {
        chosenActions.push(match);
      }
    }

    if (chosenActions.length < Math.min(3, candidates.length)) {
      const remainingCandidates = candidates.filter(
        (c) => !chosenActions.some((item) => item.id === c.id),
      );
      const codeRanked = rankActions(
        remainingCandidates,
        scoringProfile,
        scoringAnswers,
        metadataByAction,
        3 - chosenActions.length,
      );
      for (const item of codeRanked) {
        chosenActions.push(item.action);
      }
    }

    topItems = chosenActions.slice(0, 3).map((action) => {
      const scored = scoreAction(
        action,
        scoringProfile,
        scoringAnswers,
        metadataByAction[action.id],
      );
      return {
        action,
        score: scored.score,
        reason: '',
      };
    });
  } catch {
    const codeTop = rankActions(
      candidates,
      scoringProfile,
      scoringAnswers,
      metadataByAction,
      3,
    );
    topItems = codeTop.map((item) => ({
      action: item.action,
      score: item.score,
      reason: '',
    }));
  }

  return NextResponse.json({
    done: true,
    reply: finalReply,
    options: [],
    relaxation,
    items: topItems,
  });
}
