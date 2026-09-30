/**
 * AI 자동 분류 — 액션이 공개될 때 색인을 만든다.
 *
 * 왜 미리 만들어 두는가
 *   Discover 추천이 액션을 찾을 때마다 AI 를 부르면 느리고 비쌉니다.
 *   공개 시점에 한 번만 분류해서 action_ai_metadata 에 저장해 두고,
 *   추천은 그 색인을 검색합니다.
 *
 * 지시문·답 검사·허용 목록·정리 규칙은 lib/ai/classify-spec.ts 한 곳에 있습니다 (2026-09-29).
 * 「한꺼번에 다시 분류」 스크립트도 같은 파일을 씁니다 — 여기서 따로 정하지 마세요.
 *
 * 이 API 가 실패해도 액션 공개는 유지됩니다. 색인만 비는 것뿐입니다.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { callStructuredAI, AI_MODEL } from '@/lib/openai';
import {
  CLASSIFY_PROMPT_VERSION as PROMPT_VERSION,
  CLASSIFY_SYSTEM,
  ClassifySchema,
  buildClassifyUser,
  fallbackClassification,
  isEmptyClassification,
  sanitizeClassification,
} from '@/lib/ai/classify-spec';

// 배포(Vercel) 함수가 AI 응답을 기다릴 수 있는 최대 시간 — lib/openai.ts 의 20초 × 2번보다 길게 (2026-09-30)
export const maxDuration = 60;

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
    .select('type, name, condition_name, min_required, max_allowed')
    .eq('action_id', actionId);

  try {
    const ai = await callStructuredAI({
      agent: 'CLASSIFY',
      promptVersion: PROMPT_VERSION,
      system: CLASSIFY_SYSTEM,
      user: buildClassifyUser(action, items),
      schema: ClassifySchema,
      userId: user.id,
      actionId,
    });

    // 스키마는 통과했는데 내용이 하나도 없으면(키를 한 겹 감싼 답 등) 실패로 봅니다.
    // 그대로 저장하면 기본값뿐인 색인이 「제대로 분류됨」 으로 남아 다시 잡히지 않습니다.
    if (isEmptyClassification(ai)) throw new Error('AI 가 빈 분류를 돌려줌');

    // AI 가 허용되지 않은 값을 반환할 경우를 대비하여 명세 체계에 맞춰 정제합니다
    const { error: saveError } = await supabase.from('action_ai_metadata').upsert({
      action_id: actionId,
      ...sanitizeClassification(ai, action),
      ai_model: AI_MODEL,
      prompt_version: PROMPT_VERSION,
      owner_confirmed: false,
    });

    if (saveError) {
      console.error('[classify] 색인 저장 실패:', saveError.message);
      return NextResponse.json(
        { ok: false, error: '색인 저장에 실패했어요.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    // 색인 실패는 공개를 막지 않습니다. 기본 색인으로 안전하게 채웁니다.
    await supabase.from('action_ai_metadata').upsert({
      action_id: actionId,
      ...fallbackClassification(action),
      ai_model: AI_MODEL,
      prompt_version: `${PROMPT_VERSION}-fallback`,
      owner_confirmed: false,
    });
    return NextResponse.json({ ok: true, fallback: true });
  }
}
