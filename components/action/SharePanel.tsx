/**
 * 액션 공유.
 *
 * 회원 공유: 닉네임으로만 검색합니다.
 *   이메일·전화번호로 사람을 찾을 수 있으면 개인정보가 새어 나갑니다.
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

  async function handleSearch() {
    if (!viewerId) {
      toast('로그인 후 친구에게 보낼 수 있습니다.', 'error');
      return;
    }

    const q = keyword.trim();
    if (q.length < LIMITS.NICKNAME_MIN) {
      toast(`${LIMITS.NICKNAME_MIN}자 이상 입력해주세요.`, 'error');
      return;
    }

    setSearching(true);
    try {
      const found = await searchUsers(createClient(), q, viewerId);
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
    <div className={className ?? 'flex flex-col gap-7 px-5 py-5'}>
      {/* 회원에게 보내기 */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-[15px] font-bold text-neutral-900">
            착착 친구에게 보내기
          </h2>
          <p className="mt-0.5 text-[12px] text-neutral-500">
            닉네임으로 찾을 수 있어요. 보내면 상대방 알림에 도착해요.
          </p>
        </div>

        <div className="flex gap-2">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="닉네임 검색 (2자 이상)"
            className="h-11 flex-1 rounded-xl border border-neutral-300 px-4 text-[14px] outline-none focus:border-neutral-900"
          />
          <Button onClick={handleSearch} loading={searching}>
            검색
          </Button>
        </div>

        {searched &&
          (results.length === 0 ? (
            <p className="rounded-xl bg-neutral-50 px-4 py-5 text-center text-[13px] text-neutral-400">
              찾는 사람이 없어요. 닉네임을 다시 확인해주세요.
            </p>
          ) : (
            <div className="-mx-5 border-y border-neutral-100">
              <UserList
                users={results}
                action={(u) =>
                  sent.has(u.id) ? (
                    <span className="shrink-0 rounded-lg bg-neutral-100 px-3 py-1.5 text-[12px] font-medium text-neutral-400">
                      보냄 ✓
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSend(u)}
                      className="shrink-0 rounded-lg bg-neutral-900 px-3 py-1.5 text-[12px] font-semibold text-white"
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
          <h2 className="text-[15px] font-bold text-neutral-900">링크로 공유하기</h2>
          <p className="mt-0.5 text-[12px] text-neutral-500">
            착착 회원이 아니어도 이 링크로 액션을 볼 수 있어요.
          </p>
        </div>

        <div className="flex gap-2">
          <input
            readOnly
            value={shareUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="h-11 flex-1 rounded-xl border border-neutral-300 bg-neutral-50 px-4 text-[13px] text-neutral-600 outline-none"
          />
          <Button variant="secondary" onClick={handleCopy}>
            복사
          </Button>
        </div>
      </section>
    </div>
  );
}
