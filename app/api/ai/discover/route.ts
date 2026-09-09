/**
 * AI Agent #3 — 대화형 맞춤 추천.
 *
 * AI가 하는 일
 *   1) 서버가 정한 다섯 질문을 사용자 선택에 맞춰 순서대로 묻는다
 *   2) 다섯 답변에서 허용된 추천 조건만 뽑는다
 *   3) 코드가 고른 후보를 설명하는 이유를 쓴다
 *
 * 코드가 하는 일
 *   1) 마감·내 액션·이미 참여한 액션을 제외한다
 *   2) 지역과 카테고리를 단계적으로 완화한다
 *   3) 고정 점수로 상위 3개를 고른다
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
  fallbackReason,
  type ScoringProfile,
  type ActionScoringMetadata,
} from '@/lib/utils/scoring';
import { sameProvince, totalGroupSize } from '@/lib/utils/discover-ranking';
import {
  extractAdaptiveAnswers,
  getDiscoverReply,
  getRemainingQuestionKeys,
  shouldRecommendNow,
  type QuestionKey,
} from '@/app/api/ai/discover/interview';
import { CATEGORIES, SKILLS, type Category } from '@/lib/constants';
import { matchesRegion, NATIONWIDE } from '@/lib/constants/regions';

const CHAT_PROMPT_VERSION = 'discover-chat-v4-fixed-five';
const REASON_PROMPT_VERSION = 'discover-reason-v4-fixed-five';
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
  reply: z.string().trim().min(1).max(180),
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

const ReasonSchema = z.object({
  reasons: z
    .array(z.object({ actionId: z.string(), reason: z.string().trim().max(80) }))
    .default([]),
});

type ChatMessage = z.infer<typeof ChatMessageSchema>;
type Conversation = z.infer<typeof ConversationSchema>;

const CHAT_SYSTEM = `당신은 선한 영향력 SNS '착착'의 추천 대화 에이전트입니다.
반드시 JSON 형식으로만 답하세요.

대화 규칙
- 프로필에 이미 있는 카테고리, 지역, 참여 가능 시간은 다시 묻지 마세요.
- 서버가 준 남은 질문의 첫 번째 question_key만 사용하세요.
- 첫 질문은 재능 활용 여부입니다. 활용한다고 답하면 재능을, 아니라고 답하면 참여 방식을 묻습니다.
- 그 다음 모임 규모, 익숙한 분야/새로운 분야, 이동 가능 범위를 순서대로 묻습니다.
- 추상적인 가치관, 뿌듯한 순간, 성격, 일회성/꾸준함은 묻지 마세요.
- 한 번에 질문은 하나만 하고 선택지는 2~4개만 만드세요.
- 다섯 번째 답변 전에는 enough를 false로 유지하세요.
- 질문 수는 코드가 정확히 5번으로 제한합니다.
- 전체 대화에서 추천 조건을 누적해서 뽑으세요.
- categories는 아래 허용 목록 안에서만 고르세요.
  ${CATEGORIES.join(', ')}
- participation_mode는 아래 허용 목록 중 하나 또는 null입니다.
  ${PARTICIPATION_MODES.join(', ')}
- 액션 이름이나 순위는 만들지 마세요. 실제 후보 선정은 코드가 합니다.

형식
{"reply":"질문 또는 추천 시작 문장","question_key":"group_size","enough":false,"options":["선택지"],"categories":[],"participation_mode":null}`;

const REASON_SYSTEM = `추천 이유를 친근한 한국어 한 문장으로 쓰고 JSON 형식으로만 답하세요.

규칙
- 주어진 액션 정보, matched, 사용자 답변 안의 내용만 쓰세요.
- 없는 거리, 시간, 혜택을 만들지 마세요.
- 40자 안팎으로 짧게 쓰세요.
- actionId는 받은 값을 그대로 돌려주세요.

형식: {"reasons":[{"actionId":"...","reason":"..."}]}`;

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

const QUESTION_OPTIONS: Record<QuestionKey, string[]> = {
  skills: [
    '사진·영상·디자인',
    '글쓰기·SNS 홍보',
    '요리·운전',
    '교육·통역',
    '재능 없음',
    '아직 모르겠음',
  ],
  talent_preference: ['재능을 활용하고 싶어요', '재능과 상관없어요'],
  participation_mode: ['시간을 내서', '물건으로', '직접 행동으로'],
  group_size: ['10명 이내가 좋아요', '인원이 많아도 괜찮아요'],
  field_preference: ['비슷한 분야', '새로운 분야', '둘 다 좋아요'],
  travel_range: ['선택 지역만', '같은 시·도까지', '지역 상관없음'],
};

function questionReply(
  key: QuestionKey,
  fieldReferenceCategories: Category[],
  hasHistory: boolean,
): string {
  if (key === 'skills') {
    return '어떤 재능을 활용하고 싶으세요? 가장 가까운 항목을 골라주세요.';
  }
  if (key === 'talent_preference') {
    return '이번에는 가진 재능을 활용하는 액션을 우선해서 찾아볼까요?';
  }
  if (key === 'participation_mode') {
    return '재능과 상관없이 참여한다면 어떤 방식이 가장 편한가요?';
  }
  if (key === 'group_size') {
    return '10명 이내의 작은 모임이 편한가요, 인원이 많아도 괜찮은가요?';
  }
  if (key === 'field_preference') {
    const category = fieldReferenceCategories[0];
    if (category && hasHistory) {
      return `최근 ${category} 분야에 참여하셨네요. 비슷한 분야를 이어갈까요, 새로운 분야도 찾아볼까요?`;
    }
    if (category) {
      return `프로필에 ${category} 분야를 관심사로 등록하셨네요. 익숙한 분야를 찾을까요, 새로운 분야에도 도전해볼까요?`;
    }
    return '익숙한 분야의 액션을 찾을까요, 새로운 분야에도 도전해볼까요?';
  }
  return '활동 장소는 어느 정도까지 이동할 수 있나요?';
}

function fallbackConversation({
  messages,
  fieldReferenceCategories,
  hasHistory,
  profileCategories,
  questionKey,
}: {
  messages: ChatMessage[];
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
      reply: questionReply(
        questionKey,
        fieldReferenceCategories,
        hasHistory,
      ),
      question_key: questionKey,
      enough: false,
      options: QUESTION_OPTIONS[questionKey],
      categories,
      participation_mode: participationMode,
    };
  }

  return {
    reply: getDiscoverReply({
      recommendNow: true,
      conversationReply: '',
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
  const skillsAnswered =
    adaptiveAnswers.talentPreference === 'use' && userTurnCount >= 2;
  const remainingQuestionKeys = getRemainingQuestionKeys({
    skillsAnswered,
    answers: adaptiveAnswers,
  });
  const fallbackQuestionKey = remainingQuestionKeys[0] ?? null;

  let conversation: Conversation;
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
  } catch {
    conversation = fallbackConversation({
      messages,
      fieldReferenceCategories,
      hasHistory,
      profileCategories: profile.categories,
      questionKey: fallbackQuestionKey,
    });
  }

  const chosenQuestionKey = fallbackQuestionKey;
  const recommendNow = shouldRecommendNow({
    userTurnCount,
  });

  if (!recommendNow && chosenQuestionKey) {
    const fallback = fallbackConversation({
      messages,
      fieldReferenceCategories,
      hasHistory,
      profileCategories: profile.categories,
      questionKey: chosenQuestionKey,
    });
    const aiAskedChosenQuestion =
      conversation.question_key === chosenQuestionKey;

    return NextResponse.json({
      done: false,
      reply: aiAskedChosenQuestion ? conversation.reply : fallback.reply,
      options: QUESTION_OPTIONS[chosenQuestionKey],
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
    fieldReferenceCategories,
    hasHistory,
    profileCategories: profile.categories,
    questionKey: null,
  });
  const finalReply = getDiscoverReply({
    recommendNow: true,
    conversationReply: conversation.reply || fallback.reply,
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
      .select('action_id, participation_modes, skills')
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
  for (const metadata of metas ?? []) {
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
  const top = rankActions(
    candidates,
    scoringProfile,
    {
      participationMode,
      category: filterCategories.length === 1 ? filterCategories[0] : null,
      range: relaxation.length > 0 ? 'any' : null,
      talentPreference: adaptiveAnswers.talentPreference ?? null,
      groupSizePreference: adaptiveAnswers.groupSizePreference ?? null,
      fieldPreference: adaptiveAnswers.fieldPreference ?? null,
      travelRange: adaptiveAnswers.travelRange ?? null,
    },
    metadataByAction,
    3,
  );

  let reasonById = new Map<string, string>();
  try {
    const reasons = await callStructuredAI({
      agent: 'DISCOVER',
      promptVersion: REASON_PROMPT_VERSION,
      system: REASON_SYSTEM,
      temperature: 0.4,
      user: JSON.stringify({
        사용자답변: messages.filter((message) => message.role === 'user'),
        후보: top.map((item) => ({
          actionId: item.action.id,
          제목: item.action.title,
          카테고리: item.action.category,
          장소: item.action.address,
          matched: item.matched,
        })),
      }),
      schema: ReasonSchema,
      userId: user.id,
    });
    reasonById = new Map(
      reasons.reasons.map((reason) => [reason.actionId, reason.reason]),
    );
  } catch {
    // 이유만 기본 문구로 대체하고 추천 카드는 그대로 보여줍니다.
  }

  return NextResponse.json({
    done: true,
    reply: finalReply,
    options: [],
    relaxation,
    items: top.map((item) => ({
      action: item.action,
      score: item.score,
      reason: reasonById.get(item.action.id) ?? fallbackReason(item),
    })),
  });
}
