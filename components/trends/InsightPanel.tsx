/**
 * AI 해설 패널.
 *
 * 그래프가 먼저 그려지고 해설은 나중에 붙습니다.
 * AI 호출이 몇 초 걸리는데 그동안 화면이 비어 있으면 안 되니까요.
 * AI 가 실패해도 그래프는 그대로 남습니다.
 */
'use client';

import { useEffect, useState } from 'react';

interface Insight {
  title: string;
  detail: string;
}

export function InsightPanel() {
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    fetch('/api/ai/trends')
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setInsights(d.insights ?? []);
        setNote(d.note ?? null);
      })
      .catch(() => {
        if (!alive) return;
        setInsights([]);
        setNote('AI 해설을 불러오지 못했어요.');
      });

    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-neutral-900 p-5 text-white">
      <div className="flex items-center gap-2">
        <span className="text-base" aria-hidden="true">
          ✦
        </span>
        <h2 className="text-body font-bold">착착 AI가 읽은 흐름</h2>
      </div>

      {insights === null && (
        <p className="text-label text-white/60">데이터를 살펴보는 중…</p>
      )}

      {insights !== null && insights.length === 0 && (
        <p className="text-label leading-relaxed text-white/60">
          {note ?? '아직 분석할 내용이 충분하지 않아요.'}
        </p>
      )}

      {insights !== null && insights.length > 0 && (
        <ul className="flex flex-col gap-3.5">
          {insights.map((i, idx) => (
            <li key={idx} className="flex flex-col gap-1">
              <p className="text-label font-semibold">{i.title}</p>
              <p className="text-label leading-relaxed text-white/70">
                {i.detail}
              </p>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-1 text-caption leading-relaxed text-white/40">
        착착 안에 쌓인 활동 기록만 사용합니다. 현재 현황과 변화 패턴을 설명하며,
        미래를 예측하지는 않습니다.
      </p>
    </section>
  );
}
