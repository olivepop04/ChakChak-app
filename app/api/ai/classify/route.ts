/**
 * AI 자동 분류 — 액션이 공개될 때 색인을 만든다.
 *
 * 왜 미리 만들어 두는가
 *   Discover 추천이 액션을 찾을 때마다 AI 를 부르면 느리고 비쌉니다.
 *   공개 시점에 한 번만 분류해서 action_ai_metadata 에 저장해 두고,
 *   추천은 그 색인을 검색합니다.
 *
 * 이 API 가 실패해도 액션 공개는 유지됩니다. 색인만 비는 것뿐입니다.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { callStructuredAI, AI_MODEL } from '@/lib/openai';
import { CATEGORIES } from '@/lib/constants';

const PROMPT_VERSION = 'classify-v1';

const ClassifySchema = z.object({
  categories: z.array(z.string()).default([]),
  activity_types: z.array(z.string()).default([]),
  target_groups: z.array(z.string()).default([]),
  participation_modes: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  difficulty: z.enum(['쉬움', '보통', '어려움']).nullable().default(null),
});

const SYSTEM = `사회공헌 액션을 분류해 JSON 으로만 답하세요.

categories: 아래 8개 중에서만 고르세요 (여러 개 가능)
${CATEGORIES.join(', ')}

activity_types: 현장봉사, 물품기부, 재능기부, 캠페인, 교육, 돌봄 중에서
target_groups: 아동, 청소년, 노인, 장애인, 동물, 환경, 지역주민, 기타 중에서
participation_modes: 시간을 내서, 물건으로, 직접 행동으로, 내 재능으로 중에서
skills: 필요한 능력이 있으면 짧게 (없으면 빈 배열)
keywords: 검색에 쓸 낱말 3~6개
difficulty: 쉬움 / 보통 / 어려움 중 하나

주어진 내용에 없는 것을 지어내지 마세요.`;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const { actionId } = (await request.json()) as { actionId?: string };
  if (!actionId) {
    return NextResponse.json({ error: '액션을 찾을 수 없습니다.' }, { status: 400 });
  }

  const { data: action } = await supabase
    .from('actions')
    .select('id, owner_id, title, description, category, address, notice')
    .eq('id', actionId)
    .maybeSingle();

  if (!action || action.owner_id !== user.id) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  const { data: items } = await supabase
    .from('action_items')
    .select('type, name, condition_name')
    .eq('action_id', actionId);

  try {
    const ai = await callStructuredAI({
      agent: 'CLASSIFY',
      promptVersion: PROMPT_VERSION,
      system: SYSTEM,
      user: JSON.stringify({
        제목: action.title,
        소개: action.description,
        카테고리: action.category,
        장소: action.address,
        모집항목: (items ?? []).map((i) => i.name),
      }),
      schema: ClassifySchema,
      userId: user.id,
      actionId,
    });

    // AI 가 엉뚱한 카테고리를 만들어도 저장하지 않도록 걸러냅니다
    const safeCategories = ai.categories.filter((c) =>
      (CATEGORIES as readonly string[]).includes(c),
    );

    const { error: saveError } = await supabase.from('action_ai_metadata').upsert({
      action_id: actionId,
      categories: safeCategories.length > 0 ? safeCategories : [action.category],
      activity_types: ai.activity_types,
      target_groups: ai.target_groups,
      participation_modes: ai.participation_modes,
      skills: ai.skills,
      keywords: ai.keywords,
      difficulty: ai.difficulty,
      ai_model: AI_MODEL,
      prompt_version: PROMPT_VERSION,
      owner_confirmed: false,
    });

    // 저장 실패를 조용히 넘기면 안 됩니다.
    // 예전에 RLS INSERT 정책이 빠져 있어서 "AI 는 성공했는데 색인은 비어 있는"
    // 상태를 한참 못 찾았습니다. 서버 로그에 남겨 두세요.
    if (saveError) {
      console.error('[classify] 색인 저장 실패:', saveError.message);
      return NextResponse.json(
        { ok: false, error: '색인 저장에 실패했어요.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    // 색인 실패는 공개를 막지 않습니다.
    // 카테고리만이라도 넣어 두면 추천에서 완전히 빠지지는 않습니다.
    await supabase.from('action_ai_metadata').upsert({
      action_id: actionId,
      categories: [action.category],
      activity_types: [],
      target_groups: [],
      participation_modes: [],
      skills: [],
      keywords: [],
      difficulty: null,
      ai_model: AI_MODEL,
      prompt_version: `${PROMPT_VERSION}-fallback`,
      owner_confirmed: false,
    });
    return NextResponse.json({ ok: true, fallback: true });
  }
}
