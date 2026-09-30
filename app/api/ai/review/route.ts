/**
 * AI Agent #1 — 액션 공개 전 검수.
 *
 * 흐름
 *   1) 코드가 확인할 수 있는 것을 먼저 본다 (제목·날짜·이미지·항목·장소)
 *   2) AI 가 내용 품질·취지·개인정보를 본다
 *   3) 결과를 호스트에게 보여준다
 *   4) 공개는 호스트가 버튼을 눌러야 한다 — 이 API 는 상태를 바꾸지 않는다
 *
 * ★ AI 가 PASS 해도 자동으로 공개되지 않습니다.
 *
 * ── 검수의 태도 (2026-09-09) ──────────────────────────────────
 *
 * 착착은 착한 일을 **쉽게 시작하게 만드는** 서비스입니다.
 * 그래서 검수는 심사가 아니라 거들기입니다.
 *
 *   BLOCK   정말 공개되면 안 되는 것만. 좁게.
 *   REVISE  "공개 불가" 가 아니라 "이대로는 참여자가 움직이기 어렵다".
 *           호스트는 이걸 보고도 공개할 수 있습니다 (ActionForm).
 *   PASS    문장이 투박해도, 활동이 소박해도 통과입니다.
 *
 * 그래서 코드 검사도 두 갈래입니다.
 *   blockers  비어 있는 것        → AI 를 부르지 않고 BLOCK
 *   warnings  아쉬운 것           → 알려만 주고 호스트가 판단
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { callStructuredAI, ReviewSchema, AIError, type ReviewResult } from '@/lib/openai';
import { getPlaceErrors, getPlaceWarnings } from '@/lib/utils/place-validation';
import { applyCodeFindings, type CodeWarning } from '@/lib/utils/review-result';

// 배포(Vercel) 함수가 AI 응답을 기다릴 수 있는 최대 시간 — lib/openai.ts 의 20초 × 2번보다 길게 (2026-09-30)
export const maxDuration = 60;

const PROMPT_VERSION = 'review-v7';
// v2: 착착·'인원' · v3: Owner→호스트 · v4: 장소 검수
// v5: 심사 → 거들기. BLOCK 사유를 5가지로 좁히고, 작은 선행을 PASS 시키고,
//     AI 가 보지도 못하는 날짜·이미지를 판단하지 않게 했습니다.
// v6: 두 가지 실제 사례를 고쳤습니다 (2026-09-11 회의).
//     ① 알바 모집을 막을 때 "착한 일이 아니다" 라고 호스트를 판정했습니다.
//        → 서비스 취지를 설명하는 말투로 바꿨습니다.
//     ② 프롬프트에 없는 "신청 방법을 알려주세요" 를 AI 가 지어냈습니다.
//        → 신청은 「참여하기」 버튼이 처리하므로 지적 금지로 명시했습니다.
// v7: 「"사회공헌성이 충분한가"」 → 「"거창한 공익성이 있는가"」 (2026-09-28, 성은님 PR 2731121).
//     classify · trends 와 함께 「사회공헌」 낱말을 걷어낸 용어 정리입니다. 판단 기준은 그대로입니다.
//     문장이 바뀌었는데 v6 으로 남아 있어, ai_runs 의 버전별 집계가 섞이지 않게 병합 때 올렸습니다.

const SYSTEM = `당신은 "착착(CHAK CHAK)" 의 액션 검수 도우미입니다.

착착은 착한 일을 쉽게 시작하고 쉽게 참여하게 만드는 서비스입니다.
당신은 심사위원이 아니라 이 액션이 무사히 공개되도록 돕는 사람입니다.
막는 것보다 도와주는 것이 기본 태도입니다. JSON 으로만 답하세요.

[착각하면 안 되는 것]
착착은 전문 봉사활동 플랫폼이 아닙니다. 아주 작은 실천도 훌륭한 액션입니다.
  공원에서 쓰레기 줍기 · 책 한 권 나눔 · 이웃 짐 들어드리기 · 화단 정리
다음 이유로는 절대 BLOCK 이나 REVISE 를 하지 마세요.
  규모가 작다 · 참여자가 한두 명이다 · 전문적이지 않다 · 기관과 연계가 없다
  사회적 영향이 작다 · 내용이 소박하다 · 개인적인 선행에 가깝다
"거창한 공익성이 있는가" 가 아니라 "남에게 실제로 좋은 행동인가" 로 봅니다.

[BLOCK — 좁게, 명백할 때만]
A 개인정보: 주민번호·계좌번호·비밀번호·개인 전화번호·이메일·상세 집주소,
  또는 제3자의 개인정보. 이름이나 공개된 장소가 나온 것만으로는 아닙니다.
B 불법·중대한 위험: 불법을 목적으로 하거나, 명백하고 중대한 신체 위험,
  위험물의 부적절한 사용. "조금 위험할 수 있다" 정도는 BLOCK 이 아니라 warnings 입니다.
C 사기·기만·부당한 금전 요구: 기부를 가장한 사기, 금전 이득이 주된 목적.
  유급 아르바이트·인력 모집처럼 참여자에게 금전 보상이 따르는 것도 여기입니다.
  이때 "자원봉사나 착한 일이 아닙니다" 라고 쓰지 마세요. 호스트를 판정하는 말이 됩니다.
  이렇게: "알바생을 구하거나 금전적인 보상이 따르는 액션은 착착의 취지에 맞지 않아요."
  무엇이 문제인지는 분명히 하되, 사람이 아니라 서비스의 범위를 설명합니다.
D 정치 선동·종교 포교가 주된 목적일 때.
  정치인·종교시설·기업이 배경이나 장소로 등장하는 것만으로는 BLOCK 이 아닙니다.
  "등장" 과 "주된 목적" 을 구분하세요.
E 차별·혐오·괴롭힘 표현.

[REVISE — 참여하기 어려울 때만]
"공개 불가" 가 아니라 "이대로는 참여자가 움직이기 어렵다" 는 뜻입니다.
  무슨 활동인지 알 수 없음 · 어디서 만나는지 알 수 없음
  참여자가 무엇을 하면 되는지 알 수 없음 · 꼭 필요한 준비물이나 조건이 빠짐
  "좋은 일을 함께해요" 처럼 내용이 사실상 없는 경우
상식적으로 이해되면 REVISE 하지 마세요.

[PASS 를 적극적으로]
안전·정책 문제가 없고, 무엇을 하는지와 어떻게 참여하는지를 알 수 있으면 PASS 입니다.
문장이 세련되지 않아도, 제목이 밋밋해도, 문법이 조금 어색해도 PASS 입니다.
더 좋게 만들 여지가 있다는 것은 공개하면 안 된다는 뜻이 아닙니다.

[warnings 와 REVISE 를 가르는 한 문장]
"이것이 없어도 참여할 수 있는가?"
  예   → PASS + warnings/suggestions
  아니오 → REVISE
  "활동 목적을 조금 더 자세히 쓰면 좋아요"   → PASS + suggestions
  "제목을 조금 더 구체적으로 쓰면 좋아요"    → PASS + suggestions
  "어디서 만나는지 알 수 없어요"            → REVISE
  "무엇을 준비해 가야 하는지 알 수 없어요"   → REVISE

[추측하지 마세요]
정보가 없을 때 좋은 쪽으로 지어내지 마세요. "지역 주민을 도와드립니다" 만 있으면
무슨 활동인지 모르는 것이 맞습니다. 반대로 정보가 충분한데 "혹시 부족할지도"
라며 REVISE 하지 마세요. 확실한 것만 짚습니다.

[확신이 없으면]
명백한 위험 → BLOCK · 명백한 정보 부족 → REVISE · 애매하지만 참여할 만함 → PASS
애매하다는 것 자체는 문제가 아닙니다.

[판단 순서]
1 BLOCK 사유가 있는가 → 있으면 BLOCK
2 안전·개인정보에 보완이 필요한가 → 명백한 위험이면 BLOCK, 보완으로 해결되면 REVISE
3 무슨 활동인지 알 수 있는가 → 아니면 REVISE
4 참여자가 어떻게 참여하면 되는지 알 수 있는가 → 아니면 REVISE
5 장소·준비물·참여조건 중 꼭 필요한 것이 빠졌는가 → 빠졌으면 REVISE
6 그 밖은 PASS + warnings/suggestions

[말투]
호스트를 평가하거나 혼내지 마세요.
  쓰지 말 것: "활동 내용이 불충분합니다" "이대로는 공개할 수 없습니다" "잘못 작성하셨습니다"
  이렇게: "참여자가 바로 이해할 수 있게 한 가지만 더 알려주세요"
  이렇게: "지금도 충분히 좋은 활동이에요. 만나는 곳만 조금 더 적어주시면 참여가 쉬워져요"
다만 BLOCK 사유는 친절함 때문에 흐리지 말고 무엇이 문제인지 분명히 알려주세요.

[당신이 못 보는 것]
날짜·시간과 이미지는 입력에 들어오지 않습니다. 코드가 따로 확인합니다.
"일정을 적어주세요", "사진을 올려주세요" 같은 말을 만들어내지 마세요.
장소는 주소와 장소이름만 보고 판단하세요. 도로명 주소가 아니어도
"○○공원", "○○역 3번 출구", "○○도서관" 처럼 찾아갈 수 있으면 충분합니다.
참여 신청은 착착이 「참여하기」 버튼으로 처리합니다. 호스트가 적을 내용이 아닙니다.
"신청 방법을 알려주세요", "어떻게 신청하나요", "접수 방법이 없어요" 같은 말을
만들어내지 마세요. 소개·안내 글에 들어갈 내용이 아니므로 이것으로 REVISE 하지 않습니다.
연락처·오픈채팅·구글폼으로 신청을 받게 유도하는 제안도 하지 마세요.

입력의 "코드가_이미_알려준_것" 은 호스트 화면에 이미 그대로 보이고 있습니다.
그 내용은 warnings·suggestions·questions 어디에도 다시 쓰지 마세요.
같은 말이 세 번 겹쳐 보입니다. 판단(decision)에만 반영하세요.

[형식]
hard_errors  BLOCK 사유. 무엇이 왜 문제인지.
warnings     고치면 좋은 점.
suggestions  그대로 가져다 쓸 수 있는 제목이나 문구 제안.
questions    호스트에게 물어볼 것.
모두 한국어로 한 문장씩. 해당 없으면 빈 배열로 두세요.
{"decision":"PASS","hard_errors":[],"warnings":[],"suggestions":[],"questions":[]}`;

interface CodeCheckInput {
  title: string;
  recruit_end_at: string | null;
  activity_start_at: string | null;
  activity_end_at: string | null;
  image_urls: string[];
  itemCount: number;
  address: string | null;
  place_name: string | null;
}

/**
 * 코드가 먼저 확인하는 것들. AI 보다 정확하고 빠르고 공짜입니다.
 *
 * `blockers` 는 **비어 있거나 앞뒤가 맞지 않는 것**만 담습니다.
 * "짧다·넓다" 같은 판단은 `warnings` 로 내려보내고 호스트가 정합니다.
 */
function checkByCode(a: CodeCheckInput): {
  blockers: string[];
  warnings: CodeWarning[];
} {
  const blockers: string[] = [];
  const warnings: CodeWarning[] = [];

  if (!a.title.trim()) blockers.push('제목을 알려주세요.');
  if (!a.recruit_end_at || !a.activity_start_at || !a.activity_end_at)
    blockers.push('모집 마감일과 활동 일시를 모두 알려주세요.');
  if (a.activity_start_at && a.activity_end_at && a.activity_start_at >= a.activity_end_at)
    blockers.push('활동 종료 시각이 시작 시각보다 빨라요. 날짜를 한 번만 확인해주세요.');
  if (a.recruit_end_at && a.activity_start_at && a.recruit_end_at > a.activity_start_at)
    blockers.push('모집 마감일이 활동 시작일보다 늦어요. 마감일을 활동 시작 전으로 옮겨주세요.');
  if (a.activity_end_at && new Date(a.activity_end_at) < new Date())
    blockers.push('활동 날짜가 이미 지났어요. 날짜를 다시 잡아주세요.');
  // 모집 마감이 지난 채로 공개되면 아무도 참여할 수 없고, 공개 뒤에는 날짜도 못 고칩니다 (2026-09-30).
  // 문구에 「이미 지났」·「활동 종료」 를 쓰지 않아야 ActionForm 이 모집 마감 칸에 초점을 줍니다.
  else if (a.recruit_end_at && new Date(a.recruit_end_at) <= new Date())
    blockers.push('모집 마감일이 오늘보다 앞이에요. 마감일을 다시 잡아주세요.');
  if (a.image_urls.length === 0) blockers.push('대표 이미지를 1장 이상 올려주세요.');
  if (a.itemCount === 0)
    blockers.push('함께할 사람이나 필요한 물품을 하나 이상 적어주세요.');

  // 장소 (PDF 25쪽) — "파주" 라고만 적어도 공개되던 문제.
  //
  // 규칙을 lib/utils/place-validation.ts 로 뺐습니다.
  // 액션 만들기 화면(개발 B)이 같은 함수를 써야 "화면은 통과인데
  // 공개가 안 되는" 일이 안 생깁니다.
  //
  // 비어 있으면 막고, 넓으면 알려만 줍니다.
  blockers.push(...getPlaceErrors({ address: a.address, placeName: a.place_name }));
  for (const message of getPlaceWarnings({ address: a.address })) {
    warnings.push({ topic: '주소', message, dropSuggestions: true });
  }

  // 제목이 짧다고 공개를 막지는 않습니다. "공원 청소" 도 훌륭한 제목입니다.
  if (a.title.trim().length > 0 && a.title.trim().length < 5) {
    warnings.push({
      topic: '제목',
      message: '제목만 보고도 무슨 활동인지 알 수 있게 조금만 더 적어주시면 좋아요.',
      dropSuggestions: false,
    });
  }

  return { blockers, warnings };
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
      'id, owner_id, title, description, category, categories, image_urls, address, place_name, recruit_end_at, activity_start_at, activity_end_at, notice',
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
  const { blockers, warnings: codeWarnings } = checkByCode({
    title: action.title,
    recruit_end_at: action.recruit_end_at,
    activity_start_at: action.activity_start_at,
    activity_end_at: action.activity_end_at,
    image_urls: action.image_urls ?? [],
    itemCount: items?.length ?? 0,
    address: action.address,
    place_name: action.place_name,
  });

  const codeMessages = codeWarnings.map((w) => w.message);

  // 꼭 필요한 것이 비어 있으면 AI 를 부를 필요가 없습니다 (비용 절약)
  if (blockers.length > 0) {
    const result: ReviewResult = {
      decision: 'BLOCK',
      hard_errors: blockers,
      warnings: codeMessages,
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
        카테고리: action.categories ?? [action.category],
        주소: action.address,
        장소이름: action.place_name,
        안내사항: action.notice,
        모집항목: (items ?? []).map((i) => ({
          종류: i.type === 'PERSON' ? '인원' : '물품',
          이름: i.name,
          수량:
            i.target_type === 'MINIMUM'
              ? `최소 ${i.min_required}${i.unit}`
              : `${i.min_required}~${i.max_allowed}${i.unit}`,
          조건: i.condition_name,
        })),
        코드가_이미_알려준_것: codeMessages,
      }),
      schema: ReviewSchema,
      userId: user.id,
      actionId,
    });

    // 코드가 짚은 것은 AI 판단과 별개로 반드시 보여줍니다.
    // 장소가 "파주" 뿐인데 PASS 로 넘어가면 25쪽 문제가 되돌아옵니다.
    const result: ReviewResult = applyCodeFindings(ai, codeWarnings);

    // 검수 결과를 액션에 남겨 둔다 (나중에 다시 보여주기 위해)
    await supabase.from('actions').update({ review_feedback: result }).eq('id', actionId);

    return NextResponse.json(result);
  } catch (e) {
    // AI 가 실패해도 공개를 막지 않습니다.
    // 코드 검사를 통과했으니 REVISE 로 넘기고 호스트가 판단합니다
    // (ActionForm 이 REVISE 에서도 공개 버튼을 보여줍니다).
    const message = e instanceof AIError ? e.message : 'AI 검수를 건너뛰었어요.';
    const result: ReviewResult = {
      decision: 'REVISE',
      hard_errors: [],
      warnings: [...codeMessages, `${message} 내용을 한 번 더 확인하고 공개해주세요.`],
      suggestions: [],
      questions: [],
    };
    return NextResponse.json(result);
  }
}
