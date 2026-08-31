/**
 * 좋아요 · 저장 · 팔로우 버튼.
 *
 * 셋 다 "누르면 바로 화면이 바뀌고, 실패하면 되돌리는" 방식(낙관적 업데이트)입니다.
 * 서버 응답을 기다렸다가 바꾸면 느리게 느껴집니다.
 *
 * 비회원이 누르면 mutations 가 "로그인이 필요합니다." 를 돌려주고,
 * 그 문구가 Toast 로 뜹니다.
 */
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toggleLike, toggleSave, toggleFollow } from '@/lib/mutations';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils/cn';

/** 세 버튼이 공유하는 로직 */
function useOptimisticToggle(
  initialOn: boolean,
  initialCount: number | undefined,
  run: (
    supabase: ReturnType<typeof createClient>,
    currentlyOn: boolean,
  ) => Promise<{ ok: true; data: boolean } | { ok: false; message: string }>,
) {
  const [on, setOn] = useState(initialOn);
  const [count, setCount] = useState(initialCount ?? 0);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function handle() {
    if (busy) return;
    setBusy(true);

    const prevOn = on;
    const prevCount = count;

    // 1) 화면을 먼저 바꾼다
    setOn(!on);
    setCount(on ? count - 1 : count + 1);

    // 2) 서버에 보낸다
    const res = await run(createClient(), prevOn);

    // 3) 실패하면 되돌린다
    if (!res.ok) {
      setOn(prevOn);
      setCount(prevCount);
      toast(res.message, 'error');
    }
    setBusy(false);
  }

  return { on, count, busy, handle };
}

// ─────────────────────────────────────────────────────────────
export function LikeButton({
  actionId,
  initialLiked,
  initialCount,
  className,
}: {
  actionId: string;
  initialLiked: boolean;
  initialCount: number;
  className?: string;
}) {
  const { on, count, handle } = useOptimisticToggle(
    initialLiked,
    initialCount,
    (sb, cur) => toggleLike(sb, actionId, cur),
  );

  return (
    <button
      type="button"
      onClick={handle}
      aria-pressed={on}
      aria-label="좋아요"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors',
        on ? 'text-rose-600' : 'text-neutral-500 hover:bg-neutral-100',
        className,
      )}
    >
      <span aria-hidden="true">{on ? '♥' : '♡'}</span>
      <span className="tabular-nums">{count}</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
export function SaveButton({
  actionId,
  initialSaved,
  initialCount,
  className,
}: {
  actionId: string;
  initialSaved: boolean;
  initialCount?: number;
  className?: string;
}) {
  const { on, count, handle } = useOptimisticToggle(
    initialSaved,
    initialCount,
    (sb, cur) => toggleSave(sb, actionId, cur),
  );

  return (
    <button
      type="button"
      onClick={handle}
      aria-pressed={on}
      aria-label="저장"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors',
        on ? 'text-amber-600' : 'text-neutral-500 hover:bg-neutral-100',
        className,
      )}
    >
      <span aria-hidden="true">{on ? '🔖' : '🏷'}</span>
      {initialCount !== undefined && (
        <span className="tabular-nums">{count}</span>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
export function FollowButton({
  targetUserId,
  initialFollowing,
  className,
}: {
  targetUserId: string;
  initialFollowing: boolean;
  className?: string;
}) {
  const { on, handle } = useOptimisticToggle(
    initialFollowing,
    undefined,
    (sb, cur) => toggleFollow(sb, targetUserId, cur),
  );

  return (
    <button
      type="button"
      onClick={handle}
      aria-pressed={on}
      className={cn(
        'inline-flex h-9 items-center rounded-lg px-3.5 text-[13px] font-semibold transition-colors',
        on
          ? 'border border-neutral-300 bg-white text-neutral-600'
          : 'bg-neutral-900 text-white',
        className,
      )}
    >
      {on ? '팔로잉 ✓' : '팔로우'}
    </button>
  );
}
