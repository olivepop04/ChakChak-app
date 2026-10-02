/**
 * Discover — 사용자 선택에 맞춘 다섯 답변으로 액션을 추천합니다.
 *
 * AI는 조건 해석과 추천 이유를 담당합니다.
 * 질문 문구와 실제 후보 제외·완화·점수·순위는 서버 코드가 결정합니다.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Check,
  ListFilter,
  Lock,
  MapPin,
  MessageCircleQuestion,
  RotateCw,
  SearchX,
  Sparkle,
  Sparkles,
} from 'lucide-react';
import { ActionCard } from '@/components/ui/ActionCard';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
// 민호님이 구현한 공용 Chip 컴포넌트 재사용 (components/ui/Chip.tsx 원본 훼손 없이 import)
import { Chip } from '@/components/ui/Chip';
import { SKILLS } from '@/lib/constants';
import { cn } from '@/lib/utils/cn';
import type { ActionCardData } from '@/lib/types/view';
import {
  REGIONS,
  SIDO_LIST,
  PROVINCE_WIDE,
  formatRegion,
} from '@/lib/constants/regions';
import { formatSummaryChips } from '@/app/api/ai/discover/interview';

/** 질문 수 — 서버(app/api/ai/discover)가 다섯 답변을 받으면 추천을 돌려준다 */
const QUESTION_COUNT = 5;

/** 비로그인 안내 3줄 (문구는 기존 안내 카드 그대로) */
const GUEST_POINTS = [
  { icon: MapPin, text: '내 지역과 가능한 시간에 맞춰 추천해요.' },
  { icon: ListFilter, text: '이미 참여한 액션과 내가 만든 액션은 자동으로 빼요.' },
  { icon: MessageCircleQuestion, text: '질문을 통해 내 성향을 파악하고 맞춤 액션을 찾아요.' },
] as const;

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
  summaryChips?: string[];
  error?: string;
  isLastQuestion?: boolean;
}

const DISCOVER_SESSION_KEY_PREFIX = 'chakchak_discover_session_v1';
/** 10분 만료 — 상세페이지 둘러보고 와도 3개 추천을 보존하며, 10분 후 자동 리셋 (사용자 지정) */
const SESSION_TTL_MS = 10 * 60 * 1000;

/**
 * 계정별로 키를 나눈다 — sessionStorage는 로그인 상태가 아니라 브라우저 탭에 묶여서,
 * 같은 탭에서 로그아웃 후 다른 계정으로 들어와도 이전 계정의 대화·추천이 그대로 남아
 * 있었다(2026-09-30, 팀 테스트 피드백: 로그아웃 후 다른 계정으로 들어가면 앞 사람의
 * 액션 찾기 결과가 보임). userId가 키에 들어가야 계정이 바뀌면 자연히 다른 칸을 본다.
 */
function getSessionKey(userId: string | null): string {
  return `${DISCOVER_SESSION_KEY_PREFIX}:${userId ?? 'guest'}`;
}

interface DiscoverSessionData {
  messages: ChatMessage[];
  options: string[];
  items: Recommendation[] | null;
  summaryChips: string[];
  relaxation: string[];
  isServerLastQuestion?: boolean;
  timestamp: number;
}

function saveSessionToStorage(
  sessionKey: string,
  data: {
    messages: ChatMessage[];
    options: string[];
    items: Recommendation[] | null;
    summaryChips: string[];
    relaxation: string[];
    isServerLastQuestion?: boolean;
  },
) {
  if (typeof window === 'undefined') return;
  try {
    const payload: DiscoverSessionData = {
      ...data,
      timestamp: Date.now(),
    };
    sessionStorage.setItem(sessionKey, JSON.stringify(payload));
  } catch {
    // sessionStorage 용량 초과 또는 접근 불가 무시
  }
}

export function DiscoverChat({
  nickname,
  authenticated = true,
  userId = null,
}: {
  nickname: string;
  authenticated?: boolean;
  userId?: string | null;
}) {
  const sessionKey = getSessionKey(userId);
  const started = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(authenticated);
  const [items, setItems] = useState<Recommendation[] | null>(null);
  const [summaryChips, setSummaryChips] = useState<string[]>([]);
  const [relaxation, setRelaxation] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [regionModalOpen, setRegionModalOpen] = useState(false);
  const [selectedSido, setSelectedSido] = useState<string | null>(null);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [isSubmittingFinal, setIsSubmittingFinal] = useState(false);
  const [isServerLastQuestion, setIsServerLastQuestion] = useState(false);

  useEffect(() => {
    setSelectedSkills([]);
    setSelectedTimes([]);
  }, [options]);

  useEffect(() => {
    if (!authenticated || started.current) return;
    started.current = true;

    // 세션 스토리지에서 10분 이내 직전 대화/추천 복원 시도 (계정별 키, sessionKey)
    if (typeof window !== 'undefined') {
      try {
        const raw = sessionStorage.getItem(sessionKey);
        if (raw) {
          const parsed = JSON.parse(raw) as DiscoverSessionData;
          const isFresh = Date.now() - (parsed.timestamp ?? 0) < SESSION_TTL_MS;
          if (isFresh && Array.isArray(parsed.messages) && parsed.messages.length > 0) {
            setMessages(parsed.messages);
            setOptions(parsed.options ?? []);
            setItems(parsed.items ?? null);
            setSummaryChips(parsed.summaryChips ?? []);
            setRelaxation(parsed.relaxation ?? []);
            setIsServerLastQuestion(Boolean(parsed.isServerLastQuestion));
            setLoading(false);
            return;
          } else {
            sessionStorage.removeItem(sessionKey);
          }
        }
      } catch {
        sessionStorage.removeItem(sessionKey);
      }
    }

    void requestNext([]);
  }, [authenticated, sessionKey]);

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
      const nextItems = data.done ? (data.items ?? []) : null;
      const nextChips = data.summaryChips ?? [];
      const nextOptions = data.options ?? [];
      const nextRelaxation = data.relaxation ?? [];
      const nextIsLast = Boolean(data.isLastQuestion);

      setMessages(withReply);
      setOptions(nextOptions);
      setRelaxation(nextRelaxation);
      setIsServerLastQuestion(nextIsLast);
      if (data.done) {
        setItems(nextItems);
        if (data.summaryChips) setSummaryChips(nextChips);
      }

      saveSessionToStorage(sessionKey, {
        messages: withReply,
        options: nextOptions,
        items: nextItems,
        summaryChips: nextChips,
        relaxation: nextRelaxation,
        isServerLastQuestion: nextIsLast,
      });
    } catch {
      setError('추천을 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
      setIsSubmittingFinal(false);
    }
  }

  const isCurrentLastQuestion =
    isServerLastQuestion ||
    options.some((o) => o.includes('모임') || o.includes('소규모'));

  function choose(value: string) {
    if (loading) return;
    if (isCurrentLastQuestion) {
      setIsSubmittingFinal(true);
    }
    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: value },
    ];
    setMessages(nextMessages);
    setOptions([]);
    void requestNext(nextMessages);
  }

  function handleOptionClick(option: string) {
    if (loading) return;
    if (option.includes('지역') && option.includes('선택')) {
      setSelectedSido(null);
      setRegionModalOpen(true);
      return;
    }
    choose(option);
  }

  const isSkillSelection =
    options.length >= 10 &&
    options.some((opt) => (SKILLS as readonly string[]).includes(opt)) &&
    options.includes('기타');

  const isTimeSelection =
    options.length >= 4 &&
    options.includes('주말 오전') &&
    options.includes('시간 상관없음');

  function handleSkillToggle(skill: string) {
    if (loading) return;
    if (skill === '기타') {
      if (selectedSkills.includes('기타')) {
        setSelectedSkills([]);
      } else {
        setSelectedSkills(['기타']);
      }
      return;
    }

    const withoutEtc = selectedSkills.filter((s) => s !== '기타');
    if (withoutEtc.includes(skill)) {
      setSelectedSkills(withoutEtc.filter((s) => s !== skill));
    } else {
      setSelectedSkills([...withoutEtc, skill]);
    }
  }

  function handleConfirmSkills() {
    if (loading || selectedSkills.length === 0) return;
    choose(selectedSkills.join(', '));
  }

  function handleTimeToggle(time: string) {
    if (loading) return;
    if (time === '시간 상관없음') {
      if (selectedTimes.includes('시간 상관없음')) {
        setSelectedTimes([]);
      } else {
        setSelectedTimes(['시간 상관없음']);
      }
      return;
    }

    const withoutAny = selectedTimes.filter((t) => t !== '시간 상관없음');
    if (withoutAny.includes(time)) {
      setSelectedTimes(withoutAny.filter((t) => t !== time));
    } else {
      setSelectedTimes([...withoutAny, time]);
    }
  }

  function handleConfirmTimes() {
    if (loading || selectedTimes.length === 0) return;
    choose(selectedTimes.join(', '));
  }

  function handleRegionSelect(region: string) {
    setRegionModalOpen(false);
    setSelectedSido(null);
    choose(`📍 ${region}`);
  }

  /**
   * 오류 배너 전용 재시도 — 지금까지의 대화(messages)는 그대로 둔 채 같은 요청만 다시 보낸다.
   * choose()가 실패 직전에 이미 사용자의 마지막 답을 messages에 반영해 둔 상태라, 여기서
   * 다시 messages를 지우거나 새로 만들 필요가 없다. 예전엔 이 버튼이 restart()를 불러서
   * 오류 한 번에 1번 질문부터 대화가 통째로 리셋됐다 (2026-09-30, 팀 테스트 피드백).
   */
  function retryLastRequest() {
    setError('');
    void requestNext(messages);
  }

  function restart() {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(sessionKey);
      } catch {
        // sessionStorage 비활성화 환경 무시
      }
    }
    setMessages([]);
    setOptions([]);
    setItems(null);
    setSummaryChips([]);
    setRelaxation([]);
    setError('');
    void requestNext([]);
  }

  if (!authenticated) {
    return (
      <div className="flex flex-col gap-5 px-6 pb-24 pt-4">
        <div>
          <h2 className="font-paperlogy text-body font-medium leading-relaxed text-neutral-900">
            나에게 딱 맞는 액션을
            <br />
            AI가 골라드려요
          </h2>
          <p className="mt-1 text-label leading-relaxed text-neutral-500">
            몇 가지 질문에 답하면, 추천 이유와 함께 보여드려요.
          </p>
        </div>

        {/* 결과 미리보기 — 흐린 추천 칸 위에 흰 잠금 안내 카드 (2026-09-27 목업 확정) */}
        <section className="-mx-6 bg-[#F5F5F7] px-6 py-5">
          <div className="relative">
            <div
              aria-hidden="true"
              className="overflow-hidden rounded-xl border border-hairline bg-white"
            >
              <div className="flex gap-2 bg-brand-soft px-4 py-3">
                <Sparkles className="mt-px h-4 w-4 flex-none text-brand" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <p className="text-caption font-bold tracking-wider text-brand">착착의 추천 이유</p>
                  <span className="block h-2.5 w-[90%] rounded-full bg-brand/20" />
                  <span className="block h-2.5 w-[60%] rounded-full bg-brand/20" />
                </div>
              </div>
              {/* 예시 데이터 대신 회색 막대 — 진짜 추천처럼 보이지 않게 */}
              <div className="blur-[3px]">
                <div className="flex items-center gap-1.5 px-4 pb-2 pt-3">
                  <span className="h-8 w-8 flex-none rounded-full bg-hairline" />
                  <span className="block h-2.5 w-20 rounded-full bg-neutral-200" />
                </div>
                <div className="h-40 bg-gradient-to-br from-brand-soft to-[#F5F5F7]" />
                <div className="flex flex-col gap-2 px-4 pb-4 pt-3">
                  <span className="block h-5 w-[52px] rounded-full bg-brand" />
                  <span className="block h-4 w-3/4 rounded-full bg-neutral-300" />
                  <span className="block h-2.5 w-[95%] rounded-full bg-neutral-200" />
                  <span className="block h-2.5 w-[70%] rounded-full bg-neutral-200" />
                </div>
              </div>
            </div>

            <div className="absolute inset-x-4 bottom-4 flex flex-col gap-3 rounded-xl border border-hairline bg-white p-4">
              <p className="flex items-center gap-1.5 text-label font-bold text-neutral-900">
                <Lock className="h-4 w-4 flex-none" aria-hidden="true" />
                로그인하면 나만의 추천을 볼 수 있어요
              </p>
              <ul className="flex flex-col gap-2.5">
                {GUEST_POINTS.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-brand-soft">
                      <Icon className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
                    </span>
                    <span className="text-label font-medium leading-normal text-neutral-800">
                      {text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-2">
          <Button href="/login?next=/discover" size="lg" fullWidth>
            로그인하고 추천받기
          </Button>
          <Link
            href="/signup"
            className="flex min-h-11 items-center justify-center rounded-xl border border-neutral-300 bg-white text-label font-semibold text-neutral-700"
          >
            처음이라면 가입하기
          </Link>
        </div>
      </div>
    );
  }

  const userAnswers = messages.filter((message) => message.role === 'user');
  const isDone = items !== null;

  // 오프닝 확인 응답을 제외한 실제 5대 질문 응답 수 계산 (0~5)
  const hasOpeningAnswer = messages.some(
    (m, idx) =>
      m.role === 'user' &&
      idx > 0 &&
      /이 조건으로|다른 조건|지역.*선택|전국|이대로|좋아요.*이 조건/.test(m.content),
  );
  const coreAnsweredCount = hasOpeningAnswer
    ? Math.max(0, userAnswers.length - 1)
    : userAnswers.length;
  const answeredCount = Math.min(QUESTION_COUNT, isDone ? QUESTION_COUNT : coreAnsweredCount);

  return (
    <div className="flex flex-col gap-4 px-6 pb-24 pt-4">
      {/* 인트로 제목 + 숫자 칩 5개 — 답함=초록 채움 · 지금=초록 테두리 · 남음=회색 (2026-09-27 목업 확정) */}
      <div className="flex flex-col gap-3 border-b border-neutral-100 pb-5">
        <h2 className="font-paperlogy text-body font-medium leading-relaxed text-neutral-900">
          {nickname}님에게 맞는 액션을 찾기 위해 몇 가지만 물어볼게요
        </h2>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: QUESTION_COUNT }, (_, i) => i + 1).map((n) => {
            const answered = isDone || n <= answeredCount;
            const current = !answered && n === answeredCount + 1;
            return (
              <span
                key={n}
                className={cn(
                  'flex h-7 w-7 flex-none items-center justify-center rounded-full border-[1.5px] text-label font-bold tabular-nums',
                  answered
                    ? 'border-brand bg-brand text-white'
                    : current
                      ? 'border-brand bg-white text-brand'
                      : 'border-neutral-100 bg-neutral-100 text-neutral-400',
                )}
              >
                {n}
              </span>
            );
          })}
          {!isDone && (
            <span className="ml-auto text-caption text-neutral-400">맞춤 추천 준비 중</span>
          )}
        </div>
      </div>

      {/* 내 답 다음에 오는 새 질문(턴)은 위 여백을 16px 더 → 「질문 + 내 답」 묶음 사이 32px (2026-10-01 목업 확정) */}
      {messages.map((message, index) =>
        message.role === 'assistant' ? (
          <Bubble
            key={`${message.role}-${index}`}
            className={cn(messages[index - 1]?.role === 'user' && 'mt-4')}
          >
            {message.content}
          </Bubble>
        ) : (
          <div key={`${message.role}-${index}`} className="flex justify-end">
            {/* 내 답변 — 검정 → 연한 포인트 그린 + 초록 글씨 (2026-09-27) */}
            <span className="max-w-[80%] rounded-xl rounded-br-sm bg-brand-soft px-4 py-2.5 text-body font-semibold leading-relaxed text-brand">
              {message.content}
            </span>
          </div>
        ),
      )}
      {loading && (
        <Bubble className={cn(messages[messages.length - 1]?.role === 'user' && 'mt-4')}>
          <span className="inline-flex items-center gap-2">
            {messages.length === 0
              ? '잠시만요. AI가 대화를 준비하고 있어요 😊'
              : isSubmittingFinal
                ? 'AI가 딱 맞는 맞춤 액션을 찾고 있어요 😊'
                : 'AI가 질문을 준비하고 있어요 😊'}
            <span className="inline-flex gap-0.5">
              <Dot /> <Dot /> <Dot />
            </span>
          </span>
        </Bubble>
      )}

      {/*
        선택지 — 2026-10-01 목업 확정(「액션 찾기 — 선택지 말풍선 판」 보드):
          · 내 답변 말풍선 같은 초록 판(오른쪽)을 없애고 챗봇 말풍선 바로 아래에 둡니다.
            왼쪽은 말풍선 글자 시작점(아바타 28 + 간격 8 = ml-9),
            폭은 말풍선 최대 폭(max-w-[80%])과 같게 — 오른쪽 끝이 말풍선과 맞습니다.
          · 여러 개 고르기: 제목 대신 안내문 「여러 개 고를 수 있어요」 하나로 통일,
            「N개 선택됨」·버튼 옆 개수 배지 삭제, 「선택 완료」는 가로 꽉 찬 초록 버튼(44px · 12px · hover 없음)
          · 시간 칩도 고르면 재능 칩과 같은 연한 초록(tone="soft")
      */}
      {!loading && items === null && options.length > 0 && (
        <div className="ml-9 max-w-[80%]">
          {isSkillSelection || isTimeSelection ? (
            <div className="flex flex-col gap-3">
              <p className="text-label font-medium text-neutral-500">여러 개 고를 수 있어요</p>

              <div className="flex flex-wrap gap-2">
                {options.map((option) => {
                  const isSelected = isSkillSelection
                    ? selectedSkills.includes(option)
                    : selectedTimes.includes(option);
                  return (
                    <Chip
                      key={option}
                      selected={isSelected}
                      tone="soft"
                      onClick={() =>
                        isSkillSelection ? handleSkillToggle(option) : handleTimeToggle(option)
                      }
                      className="gap-1.5 py-1.5 text-label"
                    >
                      {isSelected && (
                        <Check className="h-3.5 w-3.5 stroke-[2.5]" aria-hidden="true" />
                      )}
                      <span>{option}</span>
                    </Chip>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={isSkillSelection ? selectedSkills.length === 0 : selectedTimes.length === 0}
                onClick={isSkillSelection ? handleConfirmSkills : handleConfirmTimes}
                className="flex min-h-11 w-full items-center justify-center rounded-xl bg-brand px-5 text-body font-bold text-white disabled:opacity-30"
              >
                선택 완료
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {options.map((option) => (
                <Chip
                  key={option}
                  onClick={() => handleOptionClick(option)}
                  className="py-1.5 text-label"
                >
                  {option}
                </Chip>
              ))}
            </div>
          )}
        </div>
      )}

      <div ref={chatEndRef} />

      {/* 오류 — 빨간 상자 대신 챗봇이 말하듯 회색 말풍선 + 아래 「다시 시도」 칩 (2026-10-01 목업 J · A안) */}
      {error && (
        <>
          <Bubble className={cn(messages[messages.length - 1]?.role === 'user' && 'mt-4')}>
            {error}
          </Bubble>
          <div className="ml-9 flex max-w-[80%] flex-wrap gap-2">
            {/* 오류 뒤 「다시 시도」 는 대화를 지우지 않고 같은 요청만 다시 보냅니다 (성은님 10/1 수정 유지) */}
            <Chip onClick={retryLastRequest} className="gap-1.5 py-1.5 text-label">
              <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>다시 시도</span>
            </Chip>
          </div>
        </>
      )}

      {items && (
        // 추천 결과 — 채팅(흰 바탕)과 나누는 가로 전체 회색 판 (2026-09-27 목업 확정: B+C)
        <section className="-mx-6 -mb-24 mt-4 flex flex-col gap-5 bg-[#F5F5F7] px-6 pb-32 pt-6">
          {/* 질문 완료 요약 — 사용자가 누른 답 문구 그대로 칩으로 */}
          <div className="flex flex-col gap-3 rounded-xl bg-white p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-brand">
                <Check className="h-3.5 w-3.5 stroke-[3] text-white" aria-hidden="true" />
              </span>
              <p className="text-body font-bold text-neutral-900">
                {nickname}님의 선택
              </p>
            </div>
            <div>
              <p className="text-label text-neutral-500">이 조건으로 찾았어요</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(summaryChips.length > 0 ? summaryChips : formatSummaryChips(messages)).map((chip, index) => (
                  <span
                    key={`${chip}-${index}`}
                    className="inline-flex items-center rounded-full bg-brand-soft px-3 py-1.5 text-label font-semibold text-brand"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* 조건 완화 안내 — 보라 → 기능색 "주의" · 아이콘은 AI 검수 REVISE 와 같은 Sparkle */}
          {relaxation.length > 0 && (
            <div className="flex gap-2.5 rounded-xl bg-warning-soft px-4 py-3">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-lg bg-warning">
                <Sparkle className="h-3.5 w-3.5 stroke-[2.25] text-warning-ink" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-label font-bold leading-relaxed text-warning-ink">
                  비슷한 조건까지 찾아봤어요
                </p>
                <p className="mt-0.5 text-label leading-relaxed text-warning-ink">
                  {relaxation[0] || '원하시는 조건에 딱 맞는 액션이 많지 않아, 조건을 넓혀 가장 가까운 액션으로 추천해 드렸어요.'}
                </p>
              </div>
            </div>
          )}

          <h2 className="font-paperlogy text-subtitle font-bold leading-snug text-neutral-900">
            {nickname}님을 위한 추천 액션
          </h2>

          {items.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="지금은 딱 맞는 액션이 없어요."
              description="직접 새로운 액션을 만들어 보면 어떠세요?"
              action={{ label: '직접 액션 만들기', href: '/action/create', variant: 'primary' }}
            />
          ) : (
            <div className="flex flex-col gap-6">
              {items.map((item) => (
                // 추천 하나 = 둥근 테두리 칸 하나(액션 찾기 전용) — 맨 위 "착착의 추천 이유" 띠
                <div
                  key={item.action.id}
                  className="overflow-hidden rounded-xl border border-hairline bg-white"
                >
                  <div className="flex gap-2 bg-brand-soft px-4 py-3">
                    <Sparkles className="mt-px h-4 w-4 flex-none text-brand" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="text-caption font-bold tracking-wider text-brand">착착의 추천 이유</p>
                      <p className="mt-0.5 text-label font-semibold leading-relaxed text-neutral-900">
                        {item.reason}
                      </p>
                    </div>
                  </div>
                  <ActionCard action={item.action} variant="boxed" />
                </div>
              ))}
            </div>
          )}

          {/* 가로 꽉 찬 흰 버튼 → 오류 「다시 시도」와 같은 칩(RotateCw + 글자), 가운데 (2026-10-01) */}
          <div className="flex justify-center">
            <Chip onClick={restart} className="gap-1.5 py-1.5 text-label">
              <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>다시 추천받기</span>
            </Chip>
          </div>
        </section>
      )}

      {/* 활동 지역 선택 바텀시트 모달 */}
      {regionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center">
          <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-t-xl bg-white sm:rounded-xl">
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
              <div className="flex items-center gap-2">
                {selectedSido && (
                  <button
                    type="button"
                    onClick={() => setSelectedSido(null)}
                    className="text-neutral-500 hover:text-neutral-800"
                    aria-label="뒤로가기"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}
                {/* 1단계 제목 앞 map-pin (2026-10-01 목업 K) */}
                {!selectedSido && (
                  <MapPin className="h-5 w-5 shrink-0 text-[#333333]" aria-hidden="true" />
                )}
                <h3 className="text-subtitle font-bold text-[#333333]">
                  {selectedSido ? selectedSido : '활동할 지역 선택'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRegionModalOpen(false);
                  setSelectedSido(null);
                }}
                className="text-label font-medium text-neutral-500 hover:text-neutral-800"
              >
                닫기
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {!selectedSido ? (
                <ul className="divide-y divide-neutral-100">
                  {SIDO_LIST.map((sido) => (
                    <li key={sido}>
                      <button
                        type="button"
                        onClick={() => setSelectedSido(sido)}
                        className="flex w-full items-center justify-between px-5 py-3.5 text-left text-body text-neutral-800 hover:bg-neutral-50"
                      >
                        <span>{sido}</span>
                        <span className="text-neutral-300">›</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="divide-y divide-neutral-100">
                  {[PROVINCE_WIDE, ...(REGIONS[selectedSido] ?? [])].map((g) => {
                    const isAll = g === PROVINCE_WIDE;
                    const regionString = formatRegion(selectedSido, g);
                    return (
                      <li key={g}>
                        <button
                          type="button"
                          onClick={() => handleRegionSelect(regionString)}
                          className={`flex w-full items-center justify-between px-5 py-3.5 text-left text-body hover:bg-neutral-50 ${
                            isAll
                              ? 'bg-neutral-50 font-semibold text-neutral-900'
                              : 'text-neutral-800'
                          }`}
                        >
                          <span>{isAll ? `${selectedSido} 전체` : g}</span>
                          {isAll && (
                            <span className="rounded-lg bg-brand-soft px-2 py-0.5 text-caption font-semibold text-brand">
                              전체 선택
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Bubble({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex gap-2', className)}>
      {/* 착착 AI 아바타 — 검정 원 "착" 글자 → 초록 픽셀 표정 (2026-09-27, public/avatars/discover_avatar_01.svg) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/avatars/discover_avatar_01.svg"
        alt=""
        aria-hidden="true"
        draggable={false}
        className="h-7 w-7 shrink-0 rounded-full"
      />
      <p className="max-w-[80%] whitespace-pre-line rounded-xl rounded-tl-sm bg-neutral-100 px-4 py-2.5 text-body leading-relaxed text-neutral-800">
        {children}
      </p>
    </div>
  );
}

function Dot() {
  return <span className="h-1 w-1 animate-pulse rounded-full bg-neutral-400" />;
}
