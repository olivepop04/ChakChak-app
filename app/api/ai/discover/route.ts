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
const MAX_USER_TURNS = 6;
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
  reply: z.string().trim().min(1).max(300),
  question_key: z
    .enum([
      'talent_preference',
      'skills',
      'activity_type',
      'vibe_preference',
      'group_size',
      'field_preference',
      'travel_range',
      'participation_mode',
    ])
    .nullable()
    .default(null),
  enough: z.boolean().default(false),
  options: z.array(z.string().trim().min(1).max(40)).max(6).default([]),
  categories: z.array(z.string()).default([]),
  participation_mode: z.enum(PARTICIPATION_MODES).nullable().default(null),
});

const RecommendationSchema = z.object({
  topActionIds: z.array(z.string()).max(3).default([]),
  reasons: z
    .array(
      z.object({
        actionId: z.string(),
        reason: z.string().trim().max(100),
      }),
    )
    .default([]),
});

type ChatMessage = z.infer<typeof ChatMessageSchema>;
type Conversation = z.infer<typeof ConversationSchema>;

const CHAT_SYSTEM = `당신은 선한 영향력 SNS '착착'의 액션 맞춤 추천 AI 어시스턴트입니다.
반드시 JSON 형식으로만 답하세요.

Discover AI의 목적:
- 사용자를 평가하거나 정보를 캐묻는 '설문조사'가 아니라, 회원님을 깊이 이해하고 꼭 맞는 Action을 함께 찾아주는 따뜻하고 친절한 동반자입니다.
- 사용자가 "나한테 맞춰서 물어보네", "내가 했던 활동도 알고 있네", "이미 알고 있는 건 또 안 묻네", "몇 가지만 답했는데 나를 꽤 잘 파악했네", "착한 일을 시작하는 게 생각보다 쉽네"라고 느끼도록 대화합니다.

핵심 대화 원칙 (엄수):
1. [언어 규칙 - 절대 금지어]:
   - '봉사', '봉사활동', '봉사자', '수혜자', '사회공헌 활동' 단어를 일체 사용하지 마세요!
   - 대신 'Action', '좋은 일', '함께하기', '참여하기', '직접 해보기', '작은 행동', '좋은 행동' 등의 긍정적이고 활기찬 표현을 사용하세요.

2. [핵심 질문 공식: [이미 알고 있는 사실] + [자연스러운 확인/선택 질문]]:
   - 없는 데이터를 있는 것처럼 아는 척하지 마세요 (데이터의 진실성 준수).
   - 프로필이나 과거 활동으로 이미 파악된 정보(재능, 시간, 지역)는 중복해서 캐묻지 마세요.
   - 예: 프로필에 사진 촬영이 이미 있다면 "어떤 재능이 있으세요?" ❌ -> "프로필에 사진 촬영 재능을 등록해주셨네요. 이번에도 사진 촬영을 살릴 수 있는 Action을 찾아볼까요?" ⭕
   - 예: 과거 환경 활동 이력이 있다면 "어떤 분야에 관심 있으세요?" ❌ -> "지난번에는 환경 분야의 소규모 야외 Action에 참여하셨네요. 이번에도 비슷한 활동을 이어가볼까요, 아니면 새로운 분야도 괜찮으세요?" ⭕

3. [첫 번째 턴 (사용자답변수 0) 오프닝]:
   - 짧은 환영 인사 + Discover의 역할을 먼저 안내한 후 첫 질문을 시작하세요.
   - 전달받은 '사용자상태(A~F)'와 '이미알고있는사실'을 활용하여 자연스럽게 환영하세요.
   - 신규 사용자(F 상태)라면: "반가워요! 아직 착착에서 해본 활동이나 프로필 정보가 없으시네요. 괜찮아요. 몇 가지만 편하게 알려주시면 지금 잘 맞는 Action을 찾아드릴게요. 😊"처럼 부담을 덜어주세요.

4. [이후 턴 (사용자답변수 1 이상)]:
   - 이전 사용자의 답변을 한 문장으로 따뜻하고 공감 가득하게 받아준 뒤 다음 질문으로 자연스럽게 연결하세요.
   - 사용자를 평가하거나 심사하는 말투 금지 (예: "재능이 없으시군요" ❌ -> "괜찮아요. 특별한 재능 없이도 쉽게 참여할 수 있는 Action이 많아요. 😊" ⭕).
   - 모임 규모를 물을 때는 "혼자 참여"를 묻지 말고 "10명 안팎의 작은 모임이 편하신가요, 아니면 사람이 조금 많아도 괜찮으세요?"처럼 Action의 규모(소규모/중규모/대규모)를 파악하세요.
   - 얼마나 오래 참여할 수 있는지, 시간을 얼마나 쓸 수 있는지 등의 불필요한 질문은 하지 마세요.

5. [질문 수 및 추천 전환 판단 (enough)]:
   - 최소 4개 질문 답변 전(사용자답변수 < 4)에는 enough를 false로 유지하세요.
   - 4번째 답변 이후(사용자답변수 >= 4), 사용자의 선호(재능, 분야, 환경, 모임규모, 성격 등)가 충분히 파악되었다고 판단되면 "enough": true로 설정하여 즉시 추천으로 전환하세요.
   - 아직 정보가 부족하다면 5~6번째 질문을 진행하세요. (6번째 답변에서는 코드가 자동으로 무조건 추천으로 전환합니다).

6. [선택지(options) 제공]:
   - 사용자가 탭 한 번으로 편하게 답할 수 있도록 질문에 부합하는 친절한 선택지 2~3개를 options 배열에 넣어주세요.

형식:
{"reply":"공감 및 질문 문장","question_key":"group_size","enough":false,"options":["선택지1","선택지2"],"categories":[],"participation_mode":null}`;

const RECOMMEND_SYSTEM = `당신은 선한 영향력 SNS '착착'의 액션 추천 전문 AI 에이전트입니다.
프로젝트의 '콘텐츠 자동 분류·색인 시스템'에 의해 생성된 각 액션의 7대 AI 색인 메타데이터와 사용자의 대화 및 성향을 비교하여 가장 부합하는 최적의 액션 3개를 추천합니다.
반드시 JSON 형식으로만 답하세요.

핵심 규칙:
1. '봉사', '봉사활동', '봉사자', '수혜자' 단어를 일체 사용하지 마세요. 'Action', '함께하는 활동', '참여'로 표현하세요.
2. 주어진 후보 목록의 actionId 중에서만 topActionIds로 최대 3개를 선정하세요.
3. 각 선정 액션에 대해 [사용자 정보/대화 발언] → [Action 특성/색인] → [추천 이유]가 자연스럽게 연결된 친근하고 따뜻한 1문장(50자 안팎)의 개인화된 사유(reason)를 작성하세요.
   - 예시: "사진 촬영 재능을 활용할 수 있고, 평소 선호하셨던 소규모 환경 활동이라 부담 없이 참여해볼 수 있는 Action이에요."
   - 예시: "가볍게 첫 참여를 원하셨던 성은님께 딱 맞는, 사전 준비 없이 누구나 참여 가능한 Action이에요."
   - 예시: "사람들과 따뜻하게 이야기 나누는 소통형 활동을 좋아하시는 성은님께 잘 어울리는 소규모 Action이에요."
4. 후보 정보에 없는 허위 사실이나 거리, 시간 등을 지어내지 마세요.

형식:
{"topActionIds":["actionId1", "actionId2", "actionId3"],"reasons":[{"actionId":"actionId1","reason":"개인화된 추천 이유 문장"}]}`;

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
  const adaptiveAnswers = extractAdaptiveAnswers(userAnswers);
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

  let conversation: Conversation;
  let isAiSuccess = false;
  try {
    conversation = await callStructuredAI({
      agent: 'DISCOVER',
      promptVersion: CHAT_PROMPT_VERSION,
      system: CHAT_SYSTEM,
      temperature: 0.3,
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

  const chosenQuestionKey = fallbackQuestionKey;
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

    const reply =
      isAiSuccess && conversation.reply ? conversation.reply : fallback.reply;
    const options =
      isAiSuccess && conversation.options.length > 0
        ? conversation.options
        : getQuestionOptions(chosenQuestionKey, SKILLS);

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
    relaxation.push('말씀해주신 조건으로는 선택지가 많지 않아서, 지역이나 분야를 조금 넓혀 더 잘 맞는 Action을 찾아봤어요.');
  }

  if (candidates.length === 0 && filterCategories.length > 0) {
    candidates = allCandidates;
    relaxation.push('말씀해주신 조건으로는 선택지가 많지 않아서, 지역이나 분야를 조금 넓혀 더 잘 맞는 Action을 찾아봤어요.');
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

    const reasonsMap = new Map(aiRec.reasons.map((r) => [r.actionId, r.reason]));
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
      const aiReason = reasonsMap.get(action.id);
      return {
        action,
        score: scored.score,
        reason:
          aiReason && aiReason.trim().length > 0
            ? aiReason
            : fallbackReason(scored),
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
      reason: fallbackReason(item),
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
