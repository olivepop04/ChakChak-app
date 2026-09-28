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
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils/cn';
import { LIMITS } from '@/lib/constants';
import type { UserSummary } from '@/lib/types/view';

export function SharePanel({
  actionId,
  viewerId,
  className,
  variant = 'page',
}: {
  actionId: string;
  viewerId?: string | null;
  className?: string;
  /** 'page' = 공유 화면(기본), 'modal' = ShareModal 안 — 제목 크기·좌우 여백만 다름 */
  variant?: 'page' | 'modal';
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

  // 공유 화면(page)은 섹션 제목 17px, 모달(modal)은 한 단계 작은 15px (Day14 목업)
  const isModal = variant === 'modal';
  const headingClass = cn(
    'flex items-center gap-1.5 font-bold text-neutral-900',
    isModal ? 'text-body' : 'text-subtitle',
  );
  const headingIconClass = cn(
    'flex-none text-neutral-900',
    isModal ? 'h-[15px] w-[15px]' : 'h-[17px] w-[17px]',
  );

  return (
    <div className={className ?? 'flex flex-col gap-6 px-6 py-5'}>
      {/* 착착 친구에게 보내기 */}
      <section className="flex flex-col gap-3">
        <h2 className={headingClass}>
          <UsersRound className={headingIconClass} aria-hidden="true" />
          착착 친구에게 보내기
        </h2>

        {/* 검색칸 — 회색 채움 44px · 12px · 15px, 오른쪽 원형 검색 버튼 */}
        <div className="flex h-11 items-center gap-2 rounded-xl bg-neutral-100 pl-3.5 pr-1.5 focus-within:ring-1 focus-within:ring-neutral-300">
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
            aria-label="이름 또는 닉네임으로 찾기"
            className="min-w-0 flex-1 bg-transparent text-body text-neutral-900 outline-none placeholder:text-neutral-400"
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={searching}
            aria-label="검색"
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-neutral-100 text-neutral-700 transition-colors hover:bg-neutral-200"
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
          <ul className={cn(isModal ? '-mx-5' : '-mx-6 border-b border-neutral-100')}>
            {results.map((u) => {
              const isSent = sent.has(u.id);
              return (
                <li
                  key={u.id}
                  className={cn('flex items-center gap-3 py-3', isModal ? 'px-5' : 'px-6')}
                >
                  <Avatar name={u.nickname} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body font-semibold text-neutral-900">
                      @{u.nickname}
                    </p>
                    <p className="mt-0.5 text-caption text-neutral-500">
                      참여 {u.participatedCount}개 · 호스트 {u.ledCount}개
                    </p>
                  </div>

                  {isSent ? (
                    <span className="inline-flex min-h-9 flex-none select-none items-center gap-1 rounded-full bg-neutral-100 px-3.5 text-label font-semibold text-neutral-400">
                      <Check className="h-3.5 w-3.5 stroke-[2.5]" aria-hidden="true" />
                      보냄
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSend(u)}
                      className="min-h-9 flex-none rounded-full bg-brand px-3.5 text-label font-semibold text-white transition-colors hover:bg-brand/90 active:bg-brand/80"
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

      {/* 링크로 공유하기 — 화면은 위 목록 밑줄로 나뉘고, 모달은 구분선을 따로 둠 */}
      <section
        className={cn(
          'flex flex-col gap-3 pt-6',
          isModal && 'border-t border-neutral-100',
        )}
      >
        <div>
          <h2 className={headingClass}>
            <Share2 className={headingIconClass} aria-hidden="true" />
            링크로 공유하기
          </h2>
          <p className="mt-1 text-label text-neutral-500">
            착착 회원이 아니어도 이 링크로 액션을 볼 수 있어요.
          </p>
        </div>

        <div className="flex h-11 items-center gap-2 rounded-xl bg-neutral-100 pl-3.5 pr-1.5">
          <span className="min-w-0 flex-1 truncate text-body text-neutral-600">
            {displayUrl || '링크를 불러오는 중...'}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            aria-label="링크 복사"
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-neutral-100 text-neutral-700 transition-colors hover:bg-neutral-200"
          >
            <Copy className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </section>
    </div>
  );
}
