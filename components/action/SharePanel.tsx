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
import { createClient } from '@/lib/supabase/client';
import { searchUsers } from '@/lib/queries/profiles';
import { shareToUser } from '@/lib/mutations';
import { UserList } from '@/components/ui/UserList';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { useToast } from '@/components/ui/Toast';
import { LIMITS } from '@/lib/constants';
import type { UserSummary } from '@/lib/types/view';

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

  return (
    <div className={className ?? 'flex flex-col gap-6 px-5 py-5'}>
      {/* 회원에게 보내기 */}
      <section className="flex flex-col gap-3">
        <div>
          <SectionTitle>착착 친구에게 보내기</SectionTitle>
          <p className="mt-0.5 text-caption text-neutral-500">
            이름과 닉네임으로 친구를 찾을 수 있고, 상대방 알림으로 보내져요.
          </p>
        </div>

        <div className="flex gap-2">
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="이름 또는 닉네임 (2자 이상)"
            className="flex-1"
          />
          <Button onClick={handleSearch} loading={searching}>
            검색
          </Button>
        </div>

        {searched &&
          (results.length === 0 ? (
            <p className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-5 text-center text-label text-neutral-700">
              찾는 사람이 없어요. 이름이나 닉네임을 다시 확인해주세요.
            </p>
          ) : (
            <div className="-mx-5 border-y border-neutral-100">
              <UserList
                users={results}
                action={(u) =>
                  sent.has(u.id) ? (
                    <span className="shrink-0 rounded-full bg-neutral-100 px-3 py-1.5 text-caption font-medium text-neutral-400">
                      보냄 ✓
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSend(u)}
                      className="shrink-0 rounded-full bg-neutral-900 px-3 py-1.5 text-label font-semibold text-white"
                    >
                      보내기
                    </button>
                  )
                }
              />
            </div>
          ))}
      </section>

      {/* 링크 복사 */}
      <section className="flex flex-col gap-3 border-t border-neutral-100 pt-6">
        <div>
          <SectionTitle>링크로 공유하기</SectionTitle>
          <p className="mt-0.5 text-caption text-neutral-500">
            착착 회원이 아니어도 이 링크로 액션을 볼 수 있어요.
          </p>
        </div>

        <div className="flex gap-2">
          <input
            readOnly
            value={shareUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="min-h-11 flex-1 rounded-xl border border-neutral-300 bg-neutral-50 px-4 py-3 text-label text-neutral-600 outline-none"
          />
          <Button variant="secondary" onClick={handleCopy}>
            복사
          </Button>
        </div>
      </section>
    </div>
  );
}
