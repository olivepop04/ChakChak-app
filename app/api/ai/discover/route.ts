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
  type QuestionKey,
} from '@/app/api/ai/discover/interview';
import { CATEGORIES, SKILLS, type Category } from '@/lib/constants';
import { matchesRegion, NATIONWIDE } from '@/lib/constants/regions';

const CHAT_PROMPT_VERSION = 'discover-chat-v6-semantic-agent';
const RECOMMEND_PROMPT_VERSION = 'discover-recommend-v6-semantic-indexing';
const MAX_USER_TURNS = 5;
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
  reply: z.string().trim().min(1).max(250),
  question_key: z
    .enum([
      'skills',
      'talent_preference',
      'participation_mode',
      'group_size',
      'field_preference',
      'travel_range',
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

const CHAT_SYSTEM = `당신은 선한 영향력 SNS '착착'의 대화형 맞춤 추천 AI 어시스턴트입니다.
반드시 JSON 형식으로만 답하세요.

역할 및 대화 원칙:
1. [첫 번째 턴 (사용자답변수 0)]:
   - 사용자의 닉네임을 부르며 따뜻하고 반갑게 맞이해주세요.
   - Discover AI의 역할(3~5가지 편안한 대화를 통해 회원님에게 꼭 맞는 봉사 액션을 찾아드림)을 안내하세요.
   - 프로필 정보(나눌 수 있는 재능, 지난 활동 이력)가 있다면 자연스럽게 언급하며 첫 질문(재능 활용 여부)을 시작하세요.
   - 프로필에 재능이 없다면, 이번에는 가진 재능을 살릴 수 있는 활동을 원하는지, 아니면 부담 없이 가볍게 참여하고 싶은지 물어보세요.

2. [이후 턴 (사용자답변수 1 이상)]:
   - 이전 사용자의 답변을 한 문장으로 따뜻하고 공감 가득하게 받아주세요 (과도한 칭찬이나 기계적인 반복 지양, 자연스러운 한국어 구어체).
   - 서버가 제공한 '남은질문' 목록의 첫 번째 주제(question_key)를 참고하여 다음 질문으로 부드럽게 연결하세요.
   - 질문 흐름: 재능 활용 여부 -> (재능 활용 시 어떤 재능인지 / 미활용 시 참여 방식) -> 모임 인원 규모 -> 관심 분야(익숙한 분야 / 새로운 분야) -> 활동 지역 및 이동 범위.
   - 프로필에 이미 등록된 활동지역이나 시간대를 굳이 불필요하게 다시 캐묻지 마세요.

3. [조기 추천 판단 (enough)]:
   - 3번째 답변 이후(사용자답변수 >= 3), 사용자가 본인의 선호나 희망사항(재능, 분야, 모임규모, 장소 등)을 충분히 명확하게 표현했다고 판단되면 "enough": true 로 설정하세요.
   - 아직 정보가 더 필요하다고 판단되면 "enough": false 를 유지하세요 (5번째 답변에서는 코드가 자동으로 추천으로 전환합니다).

4. [선택지(options) 제공]:
   - 사용자가 한 번의 탭으로 편하게 답변할 수 있도록 질문에 맞는 친절한 선택지 2~4개를 options 배열에 넣어주세요.
   - 재능 관련 질문일 때는 나눌 수 있는 재능 목록에서 추천 선택지를 구성하세요.

5. [추천 조건 누적]:
   - 전체 대화에서 파악된 카테고리를 categories 배열에 추출하세요 (허용 목록: ${CATEGORIES.join(', ')}).
   - 파악된 참여 방식을 participation_mode 에 설정하세요 (허용: ${PARTICIPATION_MODES.join(', ')}, 또는 null).

형식:
{"reply":"공감 및 질문 문장","question_key":"group_size","enough":false,"options":["선택지1","선택지2"],"categories":[],"participation_mode":null}`;

const RECOMMEND_SYSTEM = `당신은 선한 영향력 SNS '착착'의 액션 추천 전문 AI 에이전트입니다.
프로젝트의 '콘텐츠 자동 분류·색인 시스템'에 의해 생성된 각 액션의 AI 색인 메타데이터를 분석하여 사용자의 대화 및 성향에 가장 부합하는 최적의 액션 3개를 추천합니다.
반드시 JSON 형식으로만 답하세요.

후보 색인 메타데이터 구조:
- category: 활동 분야 ('동물', '환경', '지역사회', '아동·청소년', '노인', '장애', '교육', '기타')
- activityTypes: 활동 환경 ('실내 활동', '실외 활동', '실내외 병행', '온라인/비대면')
- targetGroups: 모임 성격 및 교류 형태 ('교류·교육·소통형': 말벗, 멘토링, 교육, 돌봄 등 소통 중심 / '육체·과업·집중형': 플로깅, 연탄배달, 도시락포장, 청소 등 육체활동 중심 / '가족·동반가능')
- participationModes: 모임 인원 규모 ('10명 이내 소그룹', '10~20명 중그룹', '20명 이상 대그룹')
- skills: 이 액션에서 실제로 활용할 수 있는 재능 ('사진 촬영', '영상 촬영·편집', '디자인', '글쓰기', 'SNS 홍보', '요리', '운전', '교육·멘토링', '통역·번역', '컴퓨터·IT', '원예·식물관리', '청소·정리', '미술·공예', '음악·공연', '수리·시공')
- keywords: 검색 및 활동 핵심어 (3~5개)
- difficulty: 참여 문턱 ('누구나 참여가능', '기초 체력 필요', '전문지식,자격,역량 필요')

추천 및 선정 규칙:
1. 주어진 후보 목록의 actionId 중에서만 topActionIds로 최대 3개를 선정하세요.
2. 사용자가 대화에서 표현한 구체적인 희망 사항(선호 재능, 활동 방식, 모임 규모, 관심 분야, 지역 등)과 후보 액션의 색인 정보 간의 의미적 적합도(Semantic Match)가 가장 높은 액션을 우선 선정하세요.
3. 각 선정 액션에 대해 친근하고 따뜻한 1문장(50자 안팎)의 개인화된 추천 이유(reason)를 작성하세요.
4. 이유 작성 시, 사용자가 직접 말한 답변 내용과 해당 액션의 색인 특성을 직접 연결해주세요 (예: "사진 촬영 재능으로 어르신들의 소중한 순간을 담아드릴 수 있는 액션이에요.").
5. 후보 정보에 없는 허위 사실이나 거리, 시간 등을 지어내지 마세요.

형식:
{"topActionIds":["actionId1", "actionId2", "actionId3"],"reasons":[{"actionId":"actionId1","reason":"추천 이유 문장"}]}`;

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
        프로필: {
          관심카테고리: profile.categories,
          활동지역: profile.regions,
          참여가능시간: profile.timePrefs,
          나눌수있는재능: effectiveSkills,
        },
        지난활동: history.slice(0, 5).map((action) => ({
          제목: action.title,
          카테고리: action.category,
        })),
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
    relaxation.push('활동 지역을 넓혀봤어요.');
  }

  if (candidates.length === 0 && filterCategories.length > 0) {
    candidates = allCandidates;
    relaxation.push('관심 분야도 넓혀봤어요.');
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
    fallback.participation_mode ?? conversation.participation_mode;
  const scoringAnswers = {
    participationMode,
    category: filterCategories.length === 1 ? filterCategories[0] : null,
    range: relaxation.length > 0 ? 'any' : null,
    talentPreference: adaptiveAnswers.talentPreference ?? null,
    groupSizePreference: adaptiveAnswers.groupSizePreference ?? null,
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
