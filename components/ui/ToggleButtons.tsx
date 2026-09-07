/**
 * 좋아요 · 저장 · 팔로우 버튼.
 *
 * 셋 다 "누르면 바로 화면이 바뀌고, 실패하면 되돌리는" 방식(낙관적 업데이트)입니다.
 * 서버 응답을 기다렸다가 바꾸면 느리게 느껴집니다.
 *
 * 저장 버튼은 비회원 여부를 먼저 확인해 로그인 안내를 띄웁니다.
 * 좋아요·팔로우는 mutation 실패 문구를 Toast 로 보여줍니다.
 */
'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Star } from 'lucide-react';
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
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(false);
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);
  const { on, count, handle } = useOptimisticToggle(
    initialLiked,
    initialCount,
    (sb, cur) => toggleLike(sb, actionId, cur),
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!loginPromptOpen) return;

    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setLoginPromptOpen(false);
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    document.addEventListener('keydown', closeWithEscape);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', closeWithEscape);
    };
  }, [loginPromptOpen]);

  async function handleLike() {
    if (checkingAuth) return;
    setCheckingAuth(true);
    try {
      const {
        data: { user },
      } = await createClient().auth.getUser();
      if (!user) {
        setLoginPromptOpen(true);
        return;
      }
      await handle();
    } finally {
      setCheckingAuth(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleLike}
        disabled={checkingAuth}
        aria-busy={checkingAuth}
        aria-pressed={on}
        aria-label="좋아요"
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors disabled:cursor-wait disabled:opacity-60',
          on ? 'text-rose-600' : 'text-neutral-500 hover:bg-neutral-100',
          className,
        )}
      >
        <span aria-hidden="true">{on ? '♥' : '♡'}</span>
        <span className="tabular-nums">{count}</span>
      </button>

      {mounted &&
        loginPromptOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setLoginPromptOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="like-login-title"
              className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <span
                aria-hidden="true"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-xl text-rose-500"
              >
                ♡
              </span>
              <h2
                id="like-login-title"
                className="mt-4 text-[17px] font-bold text-neutral-900"
              >
                로그인하고 관심을 표현해보세요
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">
                로그인하고 나에게 맞는 활동을 추천받아 보세요. 마음에 든
                액션에는 좋아요도 남길 수 있어요.
              </p>
              <Link
                href={`/login?next=${encodeURIComponent(pathname)}`}
                autoFocus
                className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-neutral-900 text-[14px] font-semibold text-white"
              >
                로그인하고 계속하기
              </Link>
              <button
                type="button"
                onClick={() => setLoginPromptOpen(false)}
                className="mt-2 h-11 w-full rounded-xl text-[13px] font-semibold text-neutral-500 hover:bg-neutral-50"
              >
                다음에 할게요
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
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
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(false);
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);
  const { on, count, handle } = useOptimisticToggle(
    initialSaved,
    initialCount,
    (sb, cur) => toggleSave(sb, actionId, cur),
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!loginPromptOpen) return;

    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setLoginPromptOpen(false);
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    document.addEventListener('keydown', closeWithEscape);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', closeWithEscape);
    };
  }, [loginPromptOpen]);

  async function handleSave() {
    if (checkingAuth) return;
    setCheckingAuth(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoginPromptOpen(true);
        return;
      }

      await handle();
    } finally {
      setCheckingAuth(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleSave}
        disabled={checkingAuth}
        aria-busy={checkingAuth}
        aria-pressed={on}
        aria-label="저장"
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors disabled:cursor-wait disabled:opacity-60',
          on ? 'text-amber-600' : 'text-neutral-500 hover:bg-neutral-100',
          className,
        )}
      >
        <Star
          className={cn(
            'h-3.5 w-3.5 shrink-0 transition-colors',
            on ? 'fill-amber-500 text-amber-500' : 'fill-none text-neutral-400',
          )}
        />
        {initialCount !== undefined && (
          <span className="tabular-nums">{count}</span>
        )}
      </button>

      {mounted &&
        loginPromptOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setLoginPromptOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="save-login-title"
              className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <span
                aria-hidden="true"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 text-xl"
              >
                <Star className="h-6 w-6 fill-amber-500 text-amber-500" />
              </span>
              <h2
                id="save-login-title"
                className="mt-4 text-[17px] font-bold text-neutral-900"
              >
                로그인하고 액션을 저장해보세요
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">
                로그인하고 나에게 맞는 활동을 추천받아 보세요. 마음에 든 액션도
                MY에 모아둘 수 있어요.
              </p>

              <Link
                href={`/login?next=${encodeURIComponent(pathname)}`}
                autoFocus
                className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-neutral-900 text-[14px] font-semibold text-white"
              >
                로그인하고 계속하기
              </Link>
              <button
                type="button"
                onClick={() => setLoginPromptOpen(false)}
                className="mt-2 h-11 w-full rounded-xl text-[13px] font-semibold text-neutral-500 hover:bg-neutral-50"
              >
                다음에 할게요
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
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

// ─────────────────────────────────────────────────────────────
export function CrewAnchorButton({
  count,
  targetId = 'crew-section',
  className,
}: {
  count: number;
  targetId?: string;
  className?: string;
}) {
  function handleClick() {
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="참여인원"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900',
        className,
      )}
    >
      <span aria-hidden="true">👥</span>
      <span className="tabular-nums">{count}</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
export function ShareButton({
  actionId,
  count,
  className,
}: {
  actionId: string;
  count?: number;
  className?: string;
}) {
  const toast = useToast();

  async function handleShare() {
    const shareUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/action/${actionId}`
        : '';

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        toast('링크를 복사했어요.', 'success');
      } else {
        toast('주소창의 링크를 복사해주세요.', 'error');
      }
    } catch {
      toast('복사에 실패했어요. 주소창의 링크를 직접 복사해주세요.', 'error');
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label="공유"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-neutral-500 transition-colors hover:bg-neutral-100',
        className,
      )}
    >
      <span aria-hidden="true">↗</span>
      {count !== undefined ? (
        <span className="tabular-nums">{count}</span>
      ) : (
        <span>공유</span>
      )}
    </button>
  );
}

