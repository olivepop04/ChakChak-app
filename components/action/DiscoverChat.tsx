/**
 * Discover — AI 챗 형태의 액션 탐색.
 *
 * ★ 자유 대화가 아닙니다. 정해진 질문 3개를 순서대로 물어봅니다.
 *   자유 입력을 받으면 무슨 답이 올지 몰라 검증할 수 없고,
 *   AI 비용도 통제되지 않습니다.
 *
 * 검색과 순위는 서버의 코드가 하고, AI 는 의도 해석과 추천 이유만 씁니다.
 */
'use client';

import { useState } from 'react';
import { ActionCard } from '@/components/ui/ActionCard';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { CATEGORIES } from '@/lib/constants';
import type { ActionCardData } from '@/lib/types/view';

const QUESTIONS = [
  {
    key: 'participationMode' as const,
    ask: '이번에는 어떤 방식으로 함께하고 싶어요?',
    options: ['시간을 내서', '물건으로', '직접 행동으로', '내 재능으로'],
  },
  {
    key: 'category' as const,
    ask: '어떤 분야의 액션을 찾아볼까요?',
    options: [...CATEGORIES],
  },
  {
    key: 'range' as const,
    ask: '마지막으로, 이동할 수 있는 범위를 알려주세요.',
    options: ['우리 동네', '가까운 지역', '어디든 좋아요'],
  },
];

const RANGE_VALUE: Record<string, string> = {
  '우리 동네': 'near',
  '가까운 지역': 'city',
  '어디든 좋아요': 'any',
};

interface Recommendation {
  action: ActionCardData;
  score: number;
  reason: string;
}

export function DiscoverChat({ nickname }: { nickname: string }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Recommendation[] | null>(null);
  const [error, setError] = useState('');

  async function choose(value: string) {
    const q = QUESTIONS[step];
    const stored = q.key === 'range' ? RANGE_VALUE[value] : value;
    const next = { ...answers, [q.key]: stored, [`${q.key}Label`]: value };
    setAnswers(next);

    if (step < QUESTIONS.length - 1) {
      setStep(step + 1);
      return;
    }

    // 마지막 답 → 추천 요청
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ai/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participationMode: next.participationMode,
          category: next.category,
          range: next.range,
        }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else setItems(data.items ?? []);
    } catch {
      setError('추천을 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
    }
    setLoading(false);
  }

  function restart() {
    setStep(0);
    setAnswers({});
    setItems(null);
    setError('');
  }

  return (
    <div className="flex flex-col gap-4 px-5 pb-24 pt-4">
      {/* 인사 */}
      <Bubble>
        안녕하세요, <b className="font-semibold">{nickname}</b>님 😊
        <br />몇 가지만 답해주면 지금의 당신에게 어울리는 액션을 찾아드릴게요.
      </Bubble>

      {/* 지나온 질문과 답 — 답을 다 하면 마지막 질문까지 보여줍니다 */}
      {QUESTIONS.slice(0, items || loading ? QUESTIONS.length : step).map((q) => (
        <div key={q.key} className="flex flex-col gap-2">
          <Bubble>{q.ask}</Bubble>
          <div className="flex justify-end">
            <span className="rounded-2xl rounded-br-sm bg-neutral-900 px-4 py-2.5 text-[14px] text-white">
              {answers[`${q.key}Label`]}
            </span>
          </div>
        </div>
      ))}

      {/* 현재 질문 */}
      {!items && !loading && step < QUESTIONS.length && (
        <div className="flex flex-col gap-3">
          <Bubble>{QUESTIONS[step].ask}</Bubble>
          <div className="flex flex-wrap justify-end gap-2">
            {QUESTIONS[step].options.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => choose(o)}
                className="rounded-full border border-neutral-900 px-4 py-2 text-[13px] font-medium text-neutral-900 transition-colors hover:bg-neutral-900 hover:text-white"
              >
                {o}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <Bubble>
          <span className="inline-flex items-center gap-2">
            착착 AI가 액션을 살펴보고 있어요
            <span className="inline-flex gap-0.5">
              <Dot /> <Dot /> <Dot />
            </span>
          </span>
        </Bubble>
      )}

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-600">
          {error}
        </p>
      )}

      {/* 결과 */}
      {items && (
        <div className="flex flex-col gap-4">
          {items.length === 0 ? (
            <>
              <Bubble>
                조건에 맞는 액션을 찾지 못했어요.
                <br />
                조건을 바꿔서 다시 찾아볼까요?
              </Bubble>
              <EmptyState
                icon="🔍"
                title="지금은 열린 액션이 적어요"
                description="직접 액션을 만들어 사람을 모아볼 수도 있어요."
                action={{ label: '액션 만들기', href: '/action/create' }}
              />
            </>
          ) : (
            <>
              <Bubble>
                찾았어요! 😊
                <br />
                <b className="font-semibold">{nickname}</b>님에게 어울리는 액션{' '}
                {items.length}개예요.
              </Bubble>

              <div className="flex flex-col gap-4">
                {items.map((it) => (
                  <div key={it.action.id} className="flex flex-col gap-1.5">
                    <ActionCard action={it.action} />
                    <p className="px-1 text-[12px] leading-relaxed text-neutral-500">
                      ✦ {it.reason}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}

          <Button variant="secondary" fullWidth onClick={restart}>
            조건을 바꿔서 다시 찾기
          </Button>
        </div>
      )}
    </div>
  );
}

function Bubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[11px] font-bold text-white">
        G
      </span>
      <p className="max-w-[80%] rounded-2xl rounded-tl-sm bg-neutral-100 px-4 py-2.5 text-[14px] leading-relaxed text-neutral-800">
        {children}
      </p>
    </div>
  );
}

function Dot() {
  return <span className="h-1 w-1 animate-pulse rounded-full bg-neutral-400" />;
}
