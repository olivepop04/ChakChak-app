/**
 * 액션 공유.
 *
 * 회원 공유: 이름과 닉네임으로 검색합니다 (2026-09-07 회의).
 *   이메일·전화번호로는 못 찾습니다. 그걸로 사람을 찾을 수 있으면 개인정보가 새어 나갑니다.
 *   최소 2자부터, 최대 10명, 본인 제외 — searchUsers 가 처리합니다.
 *
 * 비회원 공유: URL 복사만.
 */
'use client';

import { useState } from 'react';
import { UsersRound, Search, Check, Share2, Copy } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { searchUsers } from '@/lib/queries/profiles';
import { shareToUser } from '@/lib/mutations';
import { useToast } from '@/components/ui/Toast';
import { LIMITS } from '@/lib/constants';
import type { UserSummary } from '@/lib/types/view';

/** 한글은 첫 글자, 영문은 최대 두 글자 */
function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';

  const isHangul = /[가-힣]/.test(trimmed[0]);
  if (isHangul) return trimmed[0];

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

export function SharePanel({
  actionId,
  viewerId,
  className,
}: {
  actionId: string;
  viewerId?: string | null;
  className?: string;
}) {
  const toast = useToast();
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<UserSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [sent, setSent] = useState<Set<string>>(new Set());

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/action/${actionId}`
      : '';

  /**
   * 누가 보고 있는지 확정한다.
   *
   * 화면이 viewerId 를 넘겨주면 그걸 쓰고, 안 넘겨주면 세션에서 직접 읽는다.
   * 카드(ActionCard)처럼 서버에서 사용자를 안 들고 오는 자리에서도
   * 공유창이 열리기 때문이다. 이 갈래가 없으면 로그인한 사람에게도
   * "로그인 후 친구에게 보낼 수 있습니다" 가 떴다 (2026-09-08).
   */
  async function resolveViewerId(): Promise<string | null> {
    if (viewerId) return viewerId;
    const { data } = await createClient().auth.getUser();
    return data.user?.id ?? null;
  }

  async function handleSearch() {
    const q = keyword.trim();
    if (q.length < LIMITS.NICKNAME_MIN) {
      toast(`${LIMITS.NICKNAME_MIN}자 이상 입력해주세요.`, 'error');
      return;
    }

    const me = await resolveViewerId();
    if (!me) {
      toast('로그인 후 친구에게 보낼 수 있습니다.', 'error');
      return;
    }

    setSearching(true);
    try {
      const found = await searchUsers(createClient(), q, me);
      setResults(found);
      setSearched(true);
    } catch {
      toast('검색에 실패했어요.', 'error');
    }
    setSearching(false);
  }

  async function handleSend(target: UserSummary) {
    const res = await shareToUser(createClient(), actionId, target.id);
    if (!res.ok) {
      toast(res.message, 'error');
      return;
    }
    setSent((prev) => new Set(prev).add(target.id));
    toast(`@${target.nickname}님에게 보냈어요.`, 'success');
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast('링크를 복사했어요.', 'success');
    } catch {
      toast('복사에 실패했어요. 주소창의 링크를 직접 복사해주세요.', 'error');
    }
  }

  const displayUrl = shareUrl ? shareUrl.replace(/^https?:\/\//, '') : '';

  return (
    <div className={className ?? 'flex flex-col gap-6 px-6 py-5'}>
      {/* 착착 친구에게 보내기 */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <UsersRound className="h-5 w-5 text-neutral-900" aria-hidden="true" />
          <h2 className="text-base font-bold text-neutral-900">착착 친구에게 보내기</h2>
        </div>

        {/* 검색창 */}
        <div className="relative flex items-center">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSearch();
              }
            }}
            placeholder="이름 또는 닉네임 (2자 이상)"
            className="h-12 w-full rounded-2xl bg-neutral-100 pl-4 pr-11 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors focus:bg-neutral-50 focus:ring-1 focus:ring-neutral-300"
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={searching}
            aria-label="검색"
            className="absolute right-3.5 flex h-6 w-6 items-center justify-center text-neutral-500 hover:text-neutral-900 transition-colors"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* 검색 결과 목록 */}
        {searched && results.length === 0 && (
          <p className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-5 text-center text-label text-neutral-700">
            찾는 사람이 없어요. 이름이나 닉네임을 다시 확인해주세요.
          </p>
        )}

        {results.length > 0 && (
          <ul className="mt-1 flex flex-col gap-3.5">
            {results.map((u) => {
              const isSent = sent.has(u.id);
              return (
                <li key={u.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-neutral-200 text-sm font-bold text-neutral-600 select-none">
                      {getInitials(u.nickname)}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="truncate text-sm font-bold text-neutral-900">
                        @{u.nickname}
                      </span>
                      <span className="text-xs text-neutral-400">
                        참여 {u.participatedCount}개 · 호스트 {u.ledCount}개
                      </span>
                    </div>
                  </div>

                  {isSent ? (
                    <div className="flex h-8 items-center gap-1 rounded-full bg-neutral-100 px-3.5 text-xs font-semibold text-neutral-400 select-none">
                      <Check className="h-3.5 w-3.5 stroke-[2.5]" aria-hidden="true" />
                      <span>보냄</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSend(u)}
                      className="flex h-8 items-center rounded-full bg-brand px-4 text-xs font-bold text-white transition-all hover:bg-brand-dark active:scale-95"
                    >
                      보내기
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 섹션 구분선 */}
      <div className="h-px w-full bg-neutral-100" />

      {/* 링크로 공유하기 */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Share2 className="h-5 w-5 text-neutral-900" aria-hidden="true" />
          <h2 className="text-base font-bold text-neutral-900">링크로 공유하기</h2>
        </div>
        <p className="text-xs text-neutral-400">
          착착 회원이 아니어도 이 링크로 액션을 볼 수 있어요.
        </p>

        <div
          onClick={handleCopy}
          className="mt-1 flex h-12 w-full cursor-pointer items-center justify-between rounded-2xl bg-neutral-100 px-4 transition-colors hover:bg-neutral-200/70"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleCopy();
            }
          }}
          aria-label="링크 복사하기"
        >
          <span className="truncate pr-2 text-sm text-neutral-700">
            {displayUrl || '링크를 불러오는 중...'}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleCopy();
            }}
            aria-label="링크 복사"
            className="flex h-7 w-7 flex-none items-center justify-center text-neutral-600 transition-colors hover:text-neutral-900"
          >
            <Copy className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </section>
    </div>
  );
}

