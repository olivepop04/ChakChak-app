/**
 * AI Agent #3 — 대화형 맞춤 추천.
 *
 * AI가 하는 일
 *   1) 프로필과 지난 활동을 보고 다음 성향 질문을 고른다
 *   2) 최대 3개의 답에서 허용된 추천 조건만 뽑는다
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
} from '@/lib/utils/scoring';
import { CATEGORIES, type Category } from '@/lib/constants';
import { matchesRegion, NATIONWIDE } from '@/lib/constants/regions';

const CHAT_PROMPT_VERSION = 'discover-chat-v2';
const REASON_PROMPT_VERSION = 'discover-reason-v2';
const MAX_USER_TURNS = 3;
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
  options: z.array(z.string().trim().min(1).max(40)).max(4).default([]),
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
- 활동 이력이 있으면 첫 질문에서 비슷한 활동과 새로운 활동 중 무엇을 원하는지 물으세요.
- 활동 이력이 없으면 기분, 몸/머리 사용, 일회성/꾸준함 같은 성향만 물으세요.
- 한 번에 질문은 하나만 하고 선택지는 2~4개만 만드세요.
- 사용자 답변이 3개가 되면 더 묻지 말고 짧게 추천을 시작한다고 말하며 options는 빈 배열로 주세요.
- 전체 대화에서 추천 조건을 누적해서 뽑으세요.
- categories는 아래 허용 목록 안에서만 고르세요.
  ${CATEGORIES.join(', ')}
- participation_mode는 아래 허용 목록 중 하나 또는 null입니다.
  ${PARTICIPATION_MODES.join(', ')}
- 액션 이름이나 순위는 만들지 마세요. 실제 후보 선정은 코드가 합니다.

형식
{"reply":"질문 또는 추천 시작 문장","options":["선택지"],"categories":[],"participation_mode":null}`;

const REASON_SYSTEM = `추천 이유를 친근한 한국어 한 문장으로 쓰고 JSON 형식으로만 답하세요.

규칙
- 주어진 액션 정보, matched, 사용자 답변 안의 내용만 쓰세요.
- 없는 거리, 시간, 혜택을 만들지 마세요.
- 40자 안팎으로 짧게 쓰세요.
- actionId는 받은 값을 그대로 돌려주세요.

형식: {"reasons":[{"actionId":"...","reason":"..."}]}`;

function fallbackConversation({
  userTurnCount,
  hasHistory,
  messages,
  historyCategories,
  profileCategories,
}: {
  userTurnCount: number;
  hasHistory: boolean;
  messages: ChatMessage[];
  historyCategories: Category[];
  profileCategories: string[];
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
    categories = historyCategories;
  } else if (categories.length === 0 && userText.includes('새로운')) {
    categories = CATEGORIES.filter(
      (category) => !historyCategories.includes(category),
    );
  } else if (categories.length === 0) {
    categories = profileCategories.filter((category) => category !== '전체');
  }

  let participationMode: (typeof PARTICIPATION_MODES)[number] | null = null;
  if (userText.includes('물품') || userText.includes('물건')) {
    participationMode = '물건으로';
  } else if (userText.includes('재능') || userText.includes('머리')) {
    participationMode = '내 재능으로';
  } else if (userText.includes('몸') || userText.includes('움직')) {
    participationMode = '직접 행동으로';
  } else if (userText.includes('시간')) {
    participationMode = '시간을 내서';
  }

  if (userTurnCount === 0 && hasHistory) {
    const historyLabel = historyCategories[0] ?? '이전';
    return {
      reply: `지난 ${historyLabel} 활동 기록을 참고했어요. 이번에는 비슷한 활동과 새로운 활동 중 어느 쪽이 끌리세요?`,
      options: ['비슷한 활동', '새로운 활동'],
      categories,
      participation_mode: participationMode,
    };
  }

  if (userTurnCount === 0) {
    return {
      reply: '오늘은 어떤 느낌의 좋은 일을 하고 싶으세요?',
      options: ['차분하게 돕기', '활기차게 움직이기', '뿌듯함 느끼기'],
      categories,
      participation_mode: participationMode,
    };
  }

  if (userTurnCount === 1) {
    return {
      reply: '이번에는 몸을 움직이는 일과 재능을 나누는 일 중 무엇이 더 좋아요?',
      options: ['몸을 움직이고 싶어요', '재능을 나누고 싶어요', '물품으로 돕고 싶어요'],
      categories,
      participation_mode: participationMode,
    };
  }

  if (userTurnCount === 2) {
    return {
      reply: '마지막으로, 한 번 가볍게 해볼까요 아니면 꾸준히 함께할까요?',
      options: ['한 번 가볍게', '꾸준히 함께', '일정에 맞춰 유연하게'],
      categories,
      participation_mode: participationMode,
    };
  }

  return {
    reply: '좋아요. 지금까지 알려주신 성향을 바탕으로 액션을 골라봤어요.',
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
        },
        지난활동: history.slice(0, 5).map((action) => ({
          제목: action.title,
          카테고리: action.category,
        })),
        사용자답변수: userTurnCount,
        대화: messages,
      }),
      schema: ConversationSchema,
      userId: user.id,
    });
  } catch {
    conversation = fallbackConversation({
      userTurnCount,
      hasHistory: history.length > 0,
      messages,
      historyCategories,
      profileCategories: profile.categories,
    });
  }

  // 시연 때 AI가 과거 활동을 받았는데도 두루뭉술하게 말하는 경우를 막습니다.
  // 첫 질문에는 실제 참여 카테고리를 최소 하나 포함해, 과거 기록을 썼다는 점이 보이게 합니다.
  if (
    userTurnCount === 0 &&
    historyCategories.length > 0 &&
    !historyCategories.some((category) => conversation.reply.includes(category))
  ) {
    conversation = {
      ...conversation,
      reply: `지난 ${historyCategories[0]} 활동 기록을 참고했어요. ${conversation.reply}`,
    };
  }

  // AI가 더 묻고 싶어 해도 세 번 답하면 코드가 대화를 끝냅니다.
  if (userTurnCount < MAX_USER_TURNS) {
    const fallback = fallbackConversation({
      userTurnCount,
      hasHistory: history.length > 0,
      messages,
      historyCategories,
      profileCategories: profile.categories,
    });
    const hasUsableOptions = conversation.options.length >= 2;

    return NextResponse.json({
      done: false,
      reply: hasUsableOptions ? conversation.reply : fallback.reply,
      options: hasUsableOptions ? conversation.options : fallback.options,
    });
  }

  const scoringProfile: ScoringProfile = {
    categories: profile.categories,
    timePrefs: profile.timePrefs,
    availableTimes: profile.availableTimes,
    regions: profile.regions,
    followingIds: following.map((person) => person.id),
  };

  const fallback = fallbackConversation({
    userTurnCount,
    hasHistory: history.length > 0,
    messages,
    historyCategories,
    profileCategories: profile.categories,
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
    profile.regions.length > 0 && !profile.regions.includes(NATIONWIDE);
  let candidates = hasRegionFilter
    ? categoryCandidates.filter((action) =>
        matchesRegion(action.address, profile.regions),
      )
    : categoryCandidates;
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
      reply: conversation.reply || fallback.reply,
      options: [],
      relaxation,
      items: [],
    });
  }

  const modesByAction: Record<string, string[]> = {};
  const { data: metas } = await supabase
    .from('action_ai_metadata')
    .select('action_id, participation_modes')
    .in(
      'action_id',
      candidates.map((candidate) => candidate.id),
    );
  for (const metadata of metas ?? []) {
    modesByAction[metadata.action_id] = metadata.participation_modes ?? [];
  }

  const participationMode =
    conversation.participation_mode ?? fallback.participation_mode;
  const top = rankActions(
    candidates,
    scoringProfile,
    {
      participationMode,
      category: filterCategories.length === 1 ? filterCategories[0] : null,
      range: relaxation.length > 0 ? 'any' : null,
    },
    modesByAction,
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
    reply: conversation.reply || fallback.reply,
    options: [],
    relaxation,
    items: top.map((item) => ({
      action: item.action,
      score: item.score,
      reason: reasonById.get(item.action.id) ?? fallbackReason(item),
    })),
  });
}
