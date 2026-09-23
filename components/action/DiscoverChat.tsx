/**
 * Discover — 사용자 선택에 맞춘 다섯 답변으로 액션을 추천합니다.
 *
 * AI는 조건 해석과 추천 이유를 담당합니다.
 * 질문 문구와 실제 후보 제외·완화·점수·순위는 서버 코드가 결정합니다.
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
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [options, setOptions] = useState<string[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(authenticated);
  const [items, setItems] = useState<Recommendation[] | null>(null);
  const [relaxation, setRelaxation] = useState<string[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authenticated || started.current) return;
    started.current = true;
    void requestNext([]);
  }, [authenticated]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, items]);

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
    setInputText('');
    void requestNext(nextMessages);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || loading) return;
    choose(text);
  }

  function restart() {
    setInputText('');
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
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <p className="text-[14px] font-semibold text-neutral-900">
            로그인 후 Discover AI로 내게 맞는 액션을 찾아보세요.
          </p>
          <ul className="mt-3 flex flex-col gap-2 text-[13px] leading-relaxed text-neutral-600">
            <li>· 내 지역과 가능한 시간에 맞춰 액션을 추천해요.</li>
            <li>· 이미 참여한 액션과 내가 만든 액션은 자동으로 빼요.</li>
            <li>· 편안한 대화를 통해 내게 꼭 맞는 좋은 일을 찾아요.</li>
          </ul>
          <Link
            href="/login?next=/discover"
            className="mt-5 flex min-h-13 items-center justify-center rounded-xl bg-neutral-900 py-3 text-[15px] font-semibold text-white"
          >
            로그인하고 추천받기
          </Link>
          <Link
            href="/signup"
            className="mt-2 flex min-h-11 items-center justify-center rounded-xl border border-neutral-300 py-3 text-[13px] font-semibold text-neutral-700"
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
        </div>
        {items === null && (
          <span className="text-[11px] tabular-nums text-neutral-400">
            맞춤 추천 대화 중 · {answeredCount}회 답변
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

      {loading && (
        <Bubble>
          <span className="inline-flex items-center gap-2">
            {messages.length === 0
              ? '잠시만요. AI가 대화를 준비하고 있어요 😊'
              : 'AI가 맞춤 활동을 생각하고 있어요 😊'}
            <span className="inline-flex gap-0.5">
              <Dot /> <Dot /> <Dot />
            </span>
          </span>
        </Bubble>
      )}

      {!loading && items === null && (
        <div className="flex flex-col gap-2.5 pt-1">
          {options.length > 0 && (
            <div className="flex flex-wrap justify-end gap-2">
              {options.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => choose(option)}
                  className="rounded-full border border-neutral-900 px-3.5 py-1.5 text-[13px] font-medium text-neutral-900 transition-colors hover:bg-neutral-900 hover:text-white"
                >
                  {option}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="직접 입력하거나 위 선택지를 골라보세요"
              disabled={loading}
              className="flex-1 rounded-full border border-neutral-300 bg-white px-4 py-2.5 text-[14px] text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none disabled:bg-neutral-50"
            />
            <button
              type="submit"
              disabled={loading || !inputText.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white transition-opacity disabled:opacity-30"
              aria-label="전송"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </form>
        </div>
      )}

      <div ref={chatEndRef} />

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
              {relaxation[0]}
            </p>
          )}

          {items.length === 0 ? (
            <EmptyState
              icon="🔍"
              title="지금은 딱 맞는 액션이 없어요."
              description="직접 새로운 액션을 만들어 보면 어떠세요?"
              action={{ label: '직접 액션 만들기', href: '/action/create' }}
            />
          ) : (
            <div className="flex flex-col gap-4">
              {items.map((item) => (
                <div key={item.action.id} className="flex flex-col gap-1.5">
                  <ActionCard action={item.action} />
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
      <p className="max-w-[80%] whitespace-pre-line rounded-2xl rounded-tl-sm bg-neutral-100 px-4 py-2.5 text-[14px] leading-relaxed text-neutral-800">
        {children}
      </p>
    </div>
  );
}

function Dot() {
  return <span className="h-1 w-1 animate-pulse rounded-full bg-neutral-400" />;
}
