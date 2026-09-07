/**
 * Discover — AI가 부족한 성향만 골라 최대 4번 묻는 액션 탐색.
 *
 * AI는 질문과 조건 해석, 추천 이유만 담당합니다.
 * 실제 후보 제외·완화·점수·순위는 서버 코드가 결정합니다.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ActionCard } from '@/components/ui/ActionCard';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import type { ActionCardData } from '@/lib/types/view';

interface ChatMessage {
  role: 'assistant' | 'user';
  content: string;
}

interface Recommendation {
  action: ActionCardData;
  score: number;
  reason: string;
}

interface DiscoverResponse {
  done?: boolean;
  reply?: string;
  options?: string[];
  relaxation?: string[];
  items?: Recommendation[];
  error?: string;
}

export function DiscoverChat({
  nickname,
  authenticated = true,
}: {
  nickname: string;
  authenticated?: boolean;
}) {
  const started = useRef(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(authenticated);
  const [items, setItems] = useState<Recommendation[] | null>(null);
  const [relaxation, setRelaxation] = useState<string[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authenticated || started.current) return;
    started.current = true;
    void requestNext([]);
  }, [authenticated]);

  async function requestNext(nextMessages: ChatMessage[]) {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/ai/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const data = (await response.json()) as DiscoverResponse;
      if (!response.ok || data.error) {
        setError(data.error ?? '추천 대화를 시작하지 못했어요.');
        return;
      }

      const withReply = data.reply
        ? [
            ...nextMessages,
            { role: 'assistant' as const, content: data.reply },
          ]
        : nextMessages;
      setMessages(withReply);
      setOptions(data.options ?? []);
      setRelaxation(data.relaxation ?? []);
      if (data.done) setItems(data.items ?? []);
    } catch {
      setError('추천을 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  }

  function choose(value: string) {
    if (loading) return;
    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: value },
    ];
    setMessages(nextMessages);
    setOptions([]);
    void requestNext(nextMessages);
  }

  function restart() {
    setMessages([]);
    setOptions([]);
    setItems(null);
    setRelaxation([]);
    setError('');
    void requestNext([]);
  }

  if (!authenticated) {
    return (
      <div className="flex flex-col gap-5 px-5 pb-24 pt-6">
        <Bubble>
          로그인하고 나에게 맞는 활동을 추천받아 보세요.
          <br />질문을 통해 사용자의 성향에 맞춘 후보를 보여줘요.
        </Bubble>
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <p className="text-[14px] font-semibold text-neutral-900">
            로그인하면 이런 점이 좋아요
          </p>
          <ul className="mt-3 flex flex-col gap-2 text-[13px] leading-relaxed text-neutral-600">
            <li>· 내 지역과 가능한 시간에 맞춰 추천해요.</li>
            <li>· 이미 참여한 액션과 내가 만든 액션은 자동으로 빼요.</li>
            <li>· 필요한 것만 묻고, 최대 4번 안에 후보를 보여줘요.</li>
          </ul>
          <Link
            href="/login?next=/discover"
            className="mt-5 flex h-12 items-center justify-center rounded-xl bg-neutral-900 text-[15px] font-semibold text-white"
          >
            로그인하고 추천받기
          </Link>
          <Link
            href="/signup"
            className="mt-2 flex h-11 items-center justify-center rounded-xl border border-neutral-300 text-[13px] font-semibold text-neutral-700"
          >
            처음이라면 가입하기
          </Link>
        </div>
      </div>
    );
  }

  const answeredCount = messages.filter(
    (message) => message.role === 'user',
  ).length;

  return (
    <div className="flex flex-col gap-4 px-5 pb-24 pt-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[12px] text-neutral-500">
            <b className="font-semibold text-neutral-800">{nickname}</b>님 맞춤 대화
          </p>
          <p className="mt-0.5 text-[11px] text-neutral-400">
            질문을 통해 사용자의 성향에 맞춘 후보를 보여줘요.
          </p>
        </div>
        {items === null && (
          <span className="text-[11px] tabular-nums text-neutral-400">
            답변 {answeredCount}개 반영 · 최대 4개
          </span>
        )}
      </div>

      {messages.map((message, index) =>
        message.role === 'assistant' ? (
          <Bubble key={`${message.role}-${index}`}>{message.content}</Bubble>
        ) : (
          <div key={`${message.role}-${index}`} className="flex justify-end">
            <span className="max-w-[80%] rounded-2xl rounded-br-sm bg-neutral-900 px-4 py-2.5 text-[14px] leading-relaxed text-white">
              {message.content}
            </span>
          </div>
        ),
      )}

      {!loading && items === null && options.length > 0 && (
        <div className="flex flex-wrap justify-end gap-2">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => choose(option)}
              className="rounded-full border border-neutral-900 px-4 py-2 text-[13px] font-medium text-neutral-900 transition-colors hover:bg-neutral-900 hover:text-white"
            >
              {option}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <Bubble>
          <span className="inline-flex items-center gap-2">
            착착 AI가 다음 말을 고르고 있어요
            <span className="inline-flex gap-0.5">
              <Dot /> <Dot /> <Dot />
            </span>
          </span>
        </Bubble>
      )}

      {error && (
        <div className="flex flex-col gap-3 rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-600">
          <p>{error}</p>
          <Button variant="secondary" size="sm" onClick={restart}>
            다시 시도
          </Button>
        </div>
      )}

      {items && (
        <div className="flex flex-col gap-4">
          {relaxation.length > 0 && (
            <p className="rounded-xl bg-violet-50 px-4 py-3 text-[12px] leading-relaxed text-violet-700">
              {relaxation.join(' ')} 조건을 넓힌 사실을 숨기지 않고 알려드려요.
            </p>
          )}

          {items.length === 0 ? (
            <EmptyState
              icon="🔍"
              title="지금 추천할 수 있는 액션이 없어요"
              description="마감 전이고 아직 참여하지 않은 액션이 생기면 다시 추천해드릴게요."
              action={{ label: '직접 액션 만들기', href: '/action/create' }}
            />
          ) : (
            <div className="flex flex-col gap-4">
              {items.map((item) => (
                <div key={item.action.id} className="flex flex-col gap-1.5">
                  <ActionCard action={item.action} />
                  <p className="px-1 text-[12px] leading-relaxed text-neutral-500">
                    ✦ {item.reason}
                  </p>
                </div>
              ))}
            </div>
          )}

          <Button variant="secondary" fullWidth onClick={restart}>
            다시 추천받기
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
        착
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
