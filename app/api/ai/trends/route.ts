/**
 * AI Agent #2 — 트렌드 해설.
 *
 * 집계 숫자를 LLM 에 넘겨 "눈에 띄는 변화" 를 자연어로 설명하게 합니다.
 * 계산은 코드가 이미 다 했고, AI 는 읽기 쉬운 문장으로 옮기기만 합니다.
 *
 * 외부 데이터(뉴스·SNS)는 쓰지 않습니다. 착착 내부 데이터만 씁니다.
 *
 * ★ "미래 예측" 이라고 하지 마세요.
 *   데이터가 수십 건이라 예측이라고 하면 발표에서 질문을 받습니다.
 *   "현재 현황과 변화 패턴" 으로 표현합니다.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getTrendStats } from '@/lib/queries/stats';
import { callStructuredAI } from '@/lib/openai';
import { ACTION_STATUS_LABEL } from '@/lib/constants';

// v1 -> v2: 필드 이름이 모호해 AI 가 서로 다른 항목을 섞어 없는 비율을 만들어냈다.
// 이름을 명확히 하고 "새 비율을 계산하지 말라" 는 규칙을 추가했다.
const PROMPT_VERSION = 'trends-v2';

const TrendSchema = z.object({
  insights: z
    .array(
      z.object({
        title: z.string(),
        detail: z.string(),
      }),
    )
    .default([]),
});

const SYSTEM = `당신은 선한 영향력 액션 데이터를 읽어주는 분석가입니다.
아래 집계 숫자만 보고 눈에 띄는 점 3~5개를 골라 JSON 으로 답하세요.

규칙
- 주어진 숫자에 없는 내용을 지어내지 마세요. 특히 없는 지역·날짜·인원을 만들면 안 됩니다.
- ★ 새로운 비율이나 평균을 직접 계산하지 마세요. 주어진 숫자를 그대로 인용만 하세요.
  (서로 다른 항목을 나눠서 "○○율" 을 만들어내면 틀린 값이 됩니다)
- ★ 각 숫자가 무엇을 세는지 이름 그대로 이해하세요. 다른 항목과 섞지 마세요.
- 미래를 예측하지 마세요. "지금 이렇다", "이렇게 변해왔다" 만 쓰세요.
- 일반인이 읽을 수 있는 쉬운 한국어로 쓰세요. 전문 용어를 쓰지 마세요.
- title 은 15자 안팎, detail 은 두 문장 이내.
- 데이터가 적으면 적은 대로, 무리해서 해석하지 마세요.

형식: {"insights":[{"title":"...","detail":"..."}]}`;

export async function GET() {
  const supabase = await createClient();
  const stats = await getTrendStats(supabase);

  // 데이터가 거의 없으면 AI 를 부르지 않습니다 (비용 절약 + 헛소리 방지)
  if (stats.totalActions < 3) {
    return NextResponse.json({
      insights: [],
      note: '아직 데이터가 적어서 분석할 내용이 많지 않아요.',
    });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  try {
    const ai = await callStructuredAI({
      agent: 'TRENDS',
      promptVersion: PROMPT_VERSION,
      system: SYSTEM,
      temperature: 0.4,
      /*
       * 필드 이름을 애매하게 두면 AI 가 서로 다른 항목을 섞어 계산합니다.
       * (실제로 "참여_완료_수 25" 를 "완료된 액션 25개" 로 읽고
       *  39개 중 25개라며 없는 비율을 만들어낸 적이 있습니다)
       * 무엇을 세는 숫자인지 이름에 그대로 적습니다.
       */
      user: JSON.stringify({
        공개된_액션_개수: stats.totalActions,
        소감까지_남긴_참여자_수: stats.totalParticipations,
        최소인원을_채운_모집항목_비율_퍼센트: stats.fulfillmentRate,
        분야별_액션_개수: stats.byCategory.map((c) => ({
          분야: c.category,
          액션개수: c.count,
          모인_사람수: c.crew,
        })),
        주별_새로_만들어진_액션_개수: stats.byWeek.map((w) => ({
          주_시작일: w.week,
          액션개수: w.count,
        })),
        지역별_액션_개수: stats.byRegion.map((r) => ({
          지역: r.region,
          액션개수: r.count,
        })),
        // 상태를 영문 그대로 넘기면 해설에도 'ACTIVE' 로 나옵니다
        상태별_액션_개수: stats.byStatus.map((s) => ({
          상태: ACTION_STATUS_LABEL[s.status],
          액션개수: s.count,
        })),
      }),
      schema: TrendSchema,
      userId: user?.id ?? null,
    });

    return NextResponse.json({ insights: ai.insights });
  } catch {
    // AI 가 실패해도 그래프는 그대로 나옵니다. 해설 자리만 비웁니다.
    return NextResponse.json({
      insights: [],
      note: 'AI 해설을 불러오지 못했어요. 그래프는 정상이에요.',
    });
  }
}
