/**
 * AI Agent #1 — 액션 공개 전 검수.
 *
 * 흐름
 *   1) 코드가 확인할 수 있는 것을 먼저 본다 (제목·날짜·이미지·항목)
 *   2) AI 가 내용 품질·취지·개인정보를 본다
 *   3) 결과를 Owner 에게 보여준다
 *   4) 공개는 Owner 가 버튼을 눌러야 한다 — 이 API 는 상태를 바꾸지 않는다
 *
 * ★ AI 가 PASS 해도 자동으로 공개되지 않습니다.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { callStructuredAI, ReviewSchema, AIError, type ReviewResult } from '@/lib/openai';

const PROMPT_VERSION = 'review-v1';

const SYSTEM = `당신은 사회공헌 활동 플랫폼 "GOOD"의 콘텐츠 검수자입니다.
Owner가 올리려는 액션(봉사·나눔 활동)을 검토하고 JSON으로만 답하세요.

확인할 것
1. 개인정보 노출 — 본문에 전화번호, 이메일, 주민번호, 계좌번호, 상세 집주소가 있는가
2. 취지 적합성 — 사회공헌 활동인가. 영리 홍보, 다단계, 정치·종교 권유는 부적합
3. 표현 — 차별적이거나 불쾌감을 주는 표현이 있는가
4. 구체성 — 참여자가 "무엇을 하는지" 알 수 있게 쓰였는가

decision 기준
  BLOCK  : 개인정보 노출, 명백한 영리·홍보·정치·종교, 차별 표현
  REVISE : 활동 설명이 모호하거나 참여 방법을 알 수 없음
  PASS   : 큰 문제 없음

작성 규칙
- hard_errors: BLOCK 사유. 무엇이 문제인지 구체적으로.
- warnings: 고치면 좋은 점.
- suggestions: 더 나은 제목이나 문구 제안. 실제로 쓸 수 있는 문장으로.
- questions: Owner에게 물어볼 것.
- 모두 한국어로, 각 항목은 한 문장.
- 문제가 없으면 빈 배열로 두세요.

형식: {"decision":"PASS","hard_errors":[],"warnings":[],"suggestions":[],"questions":[]}`;

/** 코드가 먼저 확인하는 것들. AI 보다 정확하고 빠릅니다. */
function checkByCode(a: {
  title: string;
  description: string | null;
  recruit_end_at: string | null;
  activity_start_at: string | null;
  activity_end_at: string | null;
  image_urls: string[];
  itemCount: number;
}): string[] {
  const errors: string[] = [];

  if (!a.title.trim()) errors.push('제목을 입력해주세요.');
  if (a.title.trim().length < 5)
    errors.push('제목이 너무 짧아요. 무슨 활동인지 알 수 있게 적어주세요.');
  if (!a.recruit_end_at || !a.activity_start_at || !a.activity_end_at)
    errors.push('모집 마감일과 활동 일시를 모두 입력해주세요.');
  if (a.activity_start_at && a.activity_end_at && a.activity_start_at >= a.activity_end_at)
    errors.push('활동 종료 시각이 시작 시각보다 빨라요.');
  if (a.recruit_end_at && a.activity_start_at && a.recruit_end_at > a.activity_start_at)
    errors.push('모집 마감일이 활동 시작일보다 늦어요.');
  if (a.activity_end_at && new Date(a.activity_end_at) < new Date())
    errors.push('이미 지난 날짜로는 공개할 수 없어요.');
  if (a.image_urls.length === 0) errors.push('대표 이미지를 1장 이상 올려주세요.');
  if (a.itemCount === 0) errors.push('모집 항목을 하나 이상 추가해주세요.');

  // 개인정보 1차 확인 — 정규식이 AI보다 정확한 영역입니다
  const text = `${a.title} ${a.description ?? ''}`;
  if (/01[016-9][-\s.]?\d{3,4}[-\s.]?\d{4}/.test(text))
    errors.push('본문에 전화번호가 있어요. 개인정보는 빼주세요.');
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(text))
    errors.push('본문에 이메일 주소가 있어요. 개인정보는 빼주세요.');
  if (/\d{6}\s?-\s?[1-4]\d{6}/.test(text))
    errors.push('본문에 주민등록번호로 보이는 숫자가 있어요.');

  return errors;
}

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

  // RLS 가 남의 DRAFT 를 막아주지만, Owner 확인을 한 번 더 합니다
  const { data: action } = await supabase
    .from('actions')
    .select(
      'id, owner_id, title, description, category, image_urls, recruit_end_at, activity_start_at, activity_end_at, notice',
    )
    .eq('id', actionId)
    .maybeSingle();

  if (!action || action.owner_id !== user.id) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  const { data: items } = await supabase
    .from('action_items')
    .select('type, name, target_type, min_required, max_allowed, unit, condition_name')
    .eq('action_id', actionId);

  // ── 1. 코드 검사 ──
  const hardErrors = checkByCode({
    title: action.title,
    description: action.description,
    recruit_end_at: action.recruit_end_at,
    activity_start_at: action.activity_start_at,
    activity_end_at: action.activity_end_at,
    image_urls: action.image_urls ?? [],
    itemCount: items?.length ?? 0,
  });

  // 필수 항목이 비었으면 AI 를 부를 필요가 없습니다 (비용 절약)
  if (hardErrors.length > 0) {
    const result: ReviewResult = {
      decision: 'BLOCK',
      hard_errors: hardErrors,
      warnings: [],
      suggestions: [],
      questions: [],
    };
    return NextResponse.json(result);
  }

  // ── 2. AI 검사 ──
  try {
    const ai = await callStructuredAI({
      agent: 'REVIEW',
      promptVersion: PROMPT_VERSION,
      system: SYSTEM,
      user: JSON.stringify({
        제목: action.title,
        소개: action.description,
        카테고리: action.category,
        안내사항: action.notice,
        모집항목: (items ?? []).map((i) => ({
          종류: i.type === 'PERSON' ? '사람' : '물품',
          이름: i.name,
          수량:
            i.target_type === 'MINIMUM'
              ? `최소 ${i.min_required}${i.unit}`
              : `${i.min_required}~${i.max_allowed}${i.unit}`,
          조건: i.condition_name,
        })),
      }),
      schema: ReviewSchema,
      userId: user.id,
      actionId,
    });

    // 검수 결과를 액션에 남겨 둔다 (나중에 다시 보여주기 위해)
    await supabase
      .from('actions')
      .update({ review_feedback: ai })
      .eq('id', actionId);

    return NextResponse.json(ai);
  } catch (e) {
    // AI 가 실패해도 공개 자체를 막지는 않습니다.
    // 코드 검사를 통과했으므로 REVISE 로 넘기고 Owner 가 판단하게 합니다.
    const message =
      e instanceof AIError ? e.message : 'AI 검수를 건너뛰었어요.';
    const result: ReviewResult = {
      decision: 'REVISE',
      hard_errors: [],
      warnings: [`${message} 내용을 한 번 더 확인하고 공개해주세요.`],
      suggestions: [],
      questions: [],
    };
    return NextResponse.json(result);
  }
}
