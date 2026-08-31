/**
 * AI Agent #3 — 맞춤 추천 (구현 1순위).
 *
 * 흐름
 *   1) 사용자가 고른 답 3개를 받는다
 *   2) LLM 이 "허용된 필터 JSON" 만 만든다  ← SQL 을 만들지 않는다
 *   3) 코드가 JSON 을 검증하고 DB 를 검색한다
 *   4) 코드가 점수를 계산해 상위 3개를 고른다
 *   5) LLM 이 추천 이유를 자연어로 쓴다
 *
 * AI 가 실패해도 추천 카드는 나옵니다. 점수 계산은 코드가 하니까요.
 * 발표 중 API 가 죽어도 화면이 비지 않습니다.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { callStructuredAI, DiscoverFilterSchema } from '@/lib/openai';
import { getRecommendCandidates } from '@/lib/queries/actions';
import { rankActions, fallbackReason, type ScoringProfile } from '@/lib/utils/scoring';
import { CATEGORIES, type Category } from '@/lib/constants';

const FILTER_PROMPT_VERSION = 'discover-filter-v1';
const REASON_PROMPT_VERSION = 'discover-reason-v1';

const FILTER_SYSTEM = `사용자의 선택을 검색 필터로 바꾸세요. JSON 으로만 답하세요.

categories 는 반드시 아래 8개 중에서만 고르세요. 다른 낱말을 만들지 마세요.
${CATEGORIES.join(', ')}

participation_modes: 시간을 내서, 물건으로, 직접 행동으로, 내 재능으로 중에서
regions: 사용자가 말한 지역이 있으면 그대로. 없으면 빈 배열
available_days: 평일, 주말 중에서 해당하는 것

형식: {"categories":[],"participation_modes":[],"regions":[],"available_days":[]}`;

const ReasonSchema = z.object({
  reasons: z
    .array(z.object({ actionId: z.string(), reason: z.string() }))
    .default([]),
});

const REASON_SYSTEM = `추천 이유를 친근한 한국어 한 문장으로 쓰고 JSON 으로만 답하세요.

규칙
- 반드시 주어진 액션 정보와 matched(맞은 조건) 안에 있는 내용만 쓰세요.
- 없는 내용을 지어내지 마세요. 거리(km)나 시간을 만들어내면 안 됩니다.
- 30자 안팎으로 짧게.
- actionId 는 받은 값을 그대로 돌려주세요.

형식: {"reasons":[{"actionId":"...","reason":"..."}]}`;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const answers = (await request.json()) as {
    participationMode?: string;
    category?: string;
    range?: string;
  };

  // ── 내 프로필 (점수 계산에 사용) ──
  const [{ data: profile }, { data: follows }] = await Promise.all([
    supabase
      .from('profiles')
      .select('categories, available_times, regions')
      .eq('id', user.id)
      .maybeSingle(),
    supabase.from('follows').select('following_id').eq('follower_id', user.id),
  ]);

  const scoringProfile: ScoringProfile = {
    categories: profile?.categories ?? [],
    availableTimes: profile?.available_times ?? [],
    regions: profile?.regions ?? [],
    followingIds: (follows ?? []).map((f) => f.following_id),
  };

  // ── 2) LLM 이 필터만 만든다 ──
  let filterCategories: Category[] = [];
  try {
    const filter = await callStructuredAI({
      agent: 'DISCOVER',
      promptVersion: FILTER_PROMPT_VERSION,
      system: FILTER_SYSTEM,
      user: JSON.stringify({
        참여방식: answers.participationMode,
        관심분야: answers.category,
        이동범위: answers.range,
        내관심카테고리: scoringProfile.categories,
        내활동지역: scoringProfile.regions,
      }),
      schema: DiscoverFilterSchema,
      userId: user.id,
    });

    // ★ AI 가 만든 값을 그대로 쓰지 않고 허용 목록으로 거릅니다
    filterCategories = filter.categories.filter((c): c is Category =>
      (CATEGORIES as readonly string[]).includes(c),
    );
  } catch {
    // AI 가 실패하면 사용자가 직접 고른 값으로 검색합니다
    if (answers.category && (CATEGORIES as readonly string[]).includes(answers.category)) {
      filterCategories = [answers.category as Category];
    }
  }

  // ── 3) DB 검색 ──
  // 이 함수가 "추천에서 무조건 빼야 하는 것" 을 이미 걸러 줍니다:
  // ACTIVE 아님 / 모집 마감 / 내가 만든 것 / 이미 참여한 것
  let candidates = await getRecommendCandidates(supabase, user.id, {
    categories: filterCategories.length > 0 ? filterCategories : undefined,
  });

  // 필터가 너무 좁아 아무것도 안 나오면 카테고리 없이 다시 찾습니다
  if (candidates.length === 0 && filterCategories.length > 0) {
    candidates = await getRecommendCandidates(supabase, user.id, {});
  }

  if (candidates.length === 0) {
    return NextResponse.json({ items: [] });
  }

  // ── 4) 점수 계산 (코드가 한다) ──
  const modesByAction: Record<string, string[]> = {};
  const { data: metas } = await supabase
    .from('action_ai_metadata')
    .select('action_id, participation_modes')
    .in(
      'action_id',
      candidates.map((c) => c.id),
    );
  for (const m of metas ?? []) {
    modesByAction[m.action_id] = m.participation_modes ?? [];
  }

  const top = rankActions(candidates, scoringProfile, answers, modesByAction, 3);

  // ── 5) 추천 이유 ──
  let reasonById = new Map<string, string>();
  try {
    const ai = await callStructuredAI({
      agent: 'DISCOVER',
      promptVersion: REASON_PROMPT_VERSION,
      system: REASON_SYSTEM,
      temperature: 0.4,
      user: JSON.stringify(
        top.map((t) => ({
          actionId: t.action.id,
          제목: t.action.title,
          카테고리: t.action.category,
          장소: t.action.address,
          matched: t.matched,
        })),
      ),
      schema: ReasonSchema,
      userId: user.id,
    });
    reasonById = new Map(ai.reasons.map((r) => [r.actionId, r.reason]));
  } catch {
    // 이유만 기본 문구로 대체하고 카드는 그대로 보여줍니다
  }

  return NextResponse.json({
    items: top.map((t) => ({
      action: t.action,
      score: t.score,
      reason: reasonById.get(t.action.id) ?? fallbackReason(t),
    })),
  });
}
