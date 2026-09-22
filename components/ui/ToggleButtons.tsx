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

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Ban, Heart, Star, UsersRound, Share2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toggleLike, toggleSave, toggleFollow } from '@/lib/mutations';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils/cn';
import { ShareModal } from '@/components/action/ShareModal';

/**
 * 세 버튼이 공유하는 로직.
 *
 * `onChange` 는 **바깥 화면이 같은 숫자를 들고 있을 때만** 씁니다.
 * 켜짐이 바뀌는 순간(되돌릴 때 포함) 불러줍니다.
 *
 * ★ 여기에 `router.refresh()` 를 넣지 마세요 (2026-09-10).
 *   이 훅을 좋아요·저장·팔로우가 함께 씁니다. 훅에서 새로고침하면
 *   피드에서 하트를 누를 때마다 서버 왕복이 생겨 목록이 깜빡입니다.
 *   바깥 숫자를 맞춰야 하면 `onChange` 로 받아서 그 화면에서 더하고 빼세요.
 */
function useOptimisticToggle(
  initialOn: boolean,
  initialCount: number | undefined,
  run: (
    supabase: ReturnType<typeof createClient>,
    currentlyOn: boolean,
  ) => Promise<{ ok: true; data: boolean } | { ok: false; message: string }>,
  onChange?: (nextOn: boolean) => void,
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
    onChange?.(!prevOn);

    // 2) 서버에 보낸다
    const res = await run(createClient(), prevOn);

    // 3) 실패하면 되돌린다
    if (!res.ok) {
      setOn(prevOn);
      setCount(prevCount);
      onChange?.(prevOn);
      toast(res.message, 'error');
    }
    setBusy(false);
  }

  return { on, count, busy, handle };
}

/**
 * 좋아요·저장·공유를 못 누르는 이유. 문구가 달라집니다.
 *
 * 2026-09-10 기획 결정으로 공유만 규칙이 다릅니다 —
 * 종료·완료된 액션도 공유는 됩니다. 그래서 ended 문구에는 공유를 적지 않습니다.
 */
export type ReactionDisabledReason = 'cancelled' | 'ended' | 'draft';

const REACTION_DISABLED_TEXT: Record<
  ReactionDisabledReason,
  { title: string; body: string }
> = {
  cancelled: {
    title: '취소된 액션이에요',
    body: '취소된 액션에는 좋아요·저장·공유를 할 수 없어요.',
  },
  ended: {
    title: '이미 종료된 액션이에요',
    body: '종료된 액션에는 좋아요·저장을 할 수 없어요.',
  },
  draft: {
    title: '아직 공개 전인 액션이에요',
    body: '공개하기 전에는 좋아요·저장·공유를 할 수 없어요.',
  },
};

/**
 * 취소·종료된 액션에서 좋아요·저장·공유를 누르면 뜨는 안내 팝업.
 * 로그인 안내 팝업과 같은 틀(가운데 흰 카드 + 확인 버튼)을 씁니다.
 */
function DisabledNoticeModal({
  open,
  reason,
  onClose,
}: {
  open: boolean;
  reason: ReactionDisabledReason;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeWithEscape);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', closeWithEscape);
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const { title, body } = REACTION_DISABLED_TEXT[reason];

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reaction-disabled-title"
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <span
          aria-hidden="true"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-100"
        >
          <Ban className="h-6 w-6 text-neutral-500" />
        </span>
        <h2
          id="reaction-disabled-title"
          className="mt-4 text-[17px] font-bold text-neutral-900"
        >
          {title}
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">
          {body}
        </p>
        <button
          type="button"
          onClick={onClose}
          autoFocus
          className="mt-5 flex min-h-13 w-full items-center justify-center rounded-xl bg-neutral-900 py-3 text-[14px] font-semibold text-white"
        >
          확인
        </button>
      </div>
    </div>,
    document.body,
  );
}

// ─────────────────────────────────────────────────────────────
export function LikeButton({
  actionId,
  initialLiked,
  initialCount,
  className,
  iconClassName,
  disabled = false,
  disabledReason = 'cancelled',
}: {
  actionId: string;
  initialLiked: boolean;
  initialCount: number;
  className?: string;
  iconClassName?: string;
  /** 취소·종료된 액션 등에서 못 누르게 막고, 누르면 안내 팝업을 띄운다 */
  disabled?: boolean;
  /** 못 누르는 이유(팝업 문구가 달라짐). 기본은 '취소' */
  disabledReason?: ReactionDisabledReason;
}) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(false);
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const closeNotice = useCallback(() => setNoticeOpen(false), []);
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

  async function handleLike(e: React.MouseEvent) {
    e.stopPropagation();
    if (disabled) {
      setNoticeOpen(true);
      return;
    }
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
        aria-disabled={disabled || undefined}
        aria-label="좋아요"
        className={cn(
          'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[13px] font-medium transition-colors disabled:cursor-wait disabled:opacity-60',
          disabled
            ? 'cursor-not-allowed text-neutral-400 opacity-50'
            : on
              ? 'text-red-500'
              : 'text-neutral-500 hover:bg-neutral-100',
          className,
        )}
      >
        <Heart
          className={cn(
            iconClassName || 'h-4 w-4',
            'shrink-0 transition-colors',
            !disabled && on
              ? 'fill-red-500 text-red-500'
              : 'fill-none text-neutral-400',
          )}
        />
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
              className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <span
                aria-hidden="true"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-xl"
              >
                <Heart className="h-6 w-6 fill-red-500 text-red-500" />
              </span>
              <h2
                id="like-login-title"
                className="mt-4 text-[17px] font-bold text-neutral-900"
              >
                로그인하고 관심을 표현해보세요
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">
                로그인하고 나에게 맞는 액션을 찾아보세요. 마음에 든
                액션에는 좋아요도 남길 수 있어요.
              </p>
              <Link
                href={`/login?next=${encodeURIComponent(pathname)}`}
                autoFocus
                className="mt-5 flex min-h-13 w-full items-center justify-center rounded-xl bg-neutral-900 py-3 text-[14px] font-semibold text-white"
              >
                로그인하고 계속하기
              </Link>
              <button
                type="button"
                onClick={() => setLoginPromptOpen(false)}
                className="mt-2 min-h-11 w-full rounded-xl py-3 text-[13px] font-semibold text-neutral-500 hover:bg-neutral-50"
              >
                다음에 할게요
              </button>
            </div>
          </div>,
          document.body,
        )}

      <DisabledNoticeModal
        open={noticeOpen}
        reason={disabledReason}
        onClose={closeNotice}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────
export function SaveButton({
  actionId,
  initialSaved,
  initialCount,
  className,
  iconClassName,
  disabled = false,
  disabledReason = 'cancelled',
}: {
  actionId: string;
  initialSaved: boolean;
  initialCount?: number;
  className?: string;
  iconClassName?: string;
  /** 취소·종료된 액션 등에서 못 누르게 막고, 누르면 안내 팝업을 띄운다 */
  disabled?: boolean;
  /** 못 누르는 이유(팝업 문구가 달라짐). 기본은 '취소' */
  disabledReason?: ReactionDisabledReason;
}) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(false);
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const closeNotice = useCallback(() => setNoticeOpen(false), []);
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

  async function handleSave(e: React.MouseEvent) {
    e.stopPropagation();
    if (disabled) {
      setNoticeOpen(true);
      return;
    }
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
        aria-disabled={disabled || undefined}
        aria-label="저장"
        className={cn(
          'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[13px] font-medium transition-colors disabled:cursor-wait disabled:opacity-60',
          disabled
            ? 'cursor-not-allowed text-neutral-400 opacity-50'
            : on
              ? 'text-amber-600'
              : 'text-neutral-500 hover:bg-neutral-100',
          className,
        )}
      >
        <Star
          className={cn(
            iconClassName || 'h-4 w-4',
            'shrink-0 transition-colors',
            !disabled && on
              ? 'fill-amber-500 text-amber-500'
              : 'fill-none text-neutral-400',
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
              className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
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
                로그인하고 나에게 맞는 액션을 찾아보세요. 마음에 든 액션은
                내 프로필에 모아둘 수 있어요.
              </p>

              <Link
                href={`/login?next=${encodeURIComponent(pathname)}`}
                autoFocus
                className="mt-5 flex min-h-13 w-full items-center justify-center rounded-xl bg-neutral-900 py-3 text-[14px] font-semibold text-white"
              >
                로그인하고 계속하기
              </Link>
              <button
                type="button"
                onClick={() => setLoginPromptOpen(false)}
                className="mt-2 min-h-11 w-full rounded-xl py-3 text-[13px] font-semibold text-neutral-500 hover:bg-neutral-50"
              >
                다음에 할게요
              </button>
            </div>
          </div>,
          document.body,
        )}

      <DisabledNoticeModal
        open={noticeOpen}
        reason={disabledReason}
        onClose={closeNotice}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────
/**
 * 팔로우 버튼.
 *
 * 프로필 화면의 팔로워 **숫자**는 서버에서 그린 값이라, 이 버튼만으로는
 * 새로고침 전까지 안 바뀝니다. 숫자를 같이 움직이려면 `onToggled` 를 받아
 * 그 화면에서 더하고 빼세요 (2026-09-10, 개발 A 요청).
 *
 *   const [followers, setFollowers] = useState(profile.followerCount);
 *   <FollowButton
 *     targetUserId={id}
 *     initialFollowing={profile.followedByMe}
 *     onToggled={(now) => setFollowers((n) => (now ? n + 1 : n - 1))}
 *   />
 *
 * 실패해서 되돌아갈 때도 한 번 더 불러주므로 숫자가 어긋나지 않습니다.
 */
export function FollowButton({
  targetUserId,
  initialFollowing,
  className,
  onToggled,
}: {
  targetUserId: string;
  initialFollowing: boolean;
  className?: string;
  /** 팔로우 상태가 바뀔 때마다 (되돌릴 때도) 불립니다 */
  onToggled?: (nowFollowing: boolean) => void;
}) {
  const { on, handle } = useOptimisticToggle(
    initialFollowing,
    undefined,
    (sb, cur) => toggleFollow(sb, targetUserId, cur),
    onToggled,
  );

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        handle();
      }}
      aria-pressed={on}
      className={cn(
        'inline-flex min-h-9 items-center rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors',
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
  actionId,
  targetId = 'crew-section',
  /** 숫자 뒤에 붙일 문구. 예) "명 참여 중". 안 주면 숫자만(기존 그대로) */
  suffixLabel,
  className,
  iconClassName,
}: {
  count: number;
  actionId?: string;
  targetId?: string;
  suffixLabel?: string;
  className?: string;
  iconClassName?: string;
}) {
  const router = useRouter();

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else if (actionId) {
      router.push(`/action/${actionId}#${targetId}`);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="참여인원"
      className={cn(
        'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[13px] font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900',
        className,
      )}
    >
      <UsersRound className={cn(iconClassName || 'h-4 w-4', 'shrink-0 text-neutral-400')} />
      <span className="tabular-nums">
        {count}
        {suffixLabel}
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
export function ShareButton({
  actionId,
  actionTitle,
  viewerId,
  showCount = false,
  count,
  className,
  iconClassName,
  disabled = false,
  disabledReason = 'cancelled',
}: {
  actionId: string;
  actionTitle?: string;
  viewerId?: string | null;
  showCount?: boolean;
  count?: number;
  className?: string;
  iconClassName?: string;
  /** 취소·종료된 액션 등에서 못 누르게 막고, 누르면 안내 팝업을 띄운다 */
  disabled?: boolean;
  /** 못 누르는 이유(팝업 문구가 달라짐). 기본은 '취소' */
  disabledReason?: ReactionDisabledReason;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const closeNotice = useCallback(() => setNoticeOpen(false), []);

  function handleShare(e: React.MouseEvent) {
    e.stopPropagation();
    if (disabled) {
      setNoticeOpen(true);
      return;
    }
    setModalOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleShare}
        aria-disabled={disabled || undefined}
        aria-label="공유"
        className={cn(
          'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[13px] font-medium transition-colors',
          disabled
            ? 'cursor-not-allowed text-neutral-400 opacity-50'
            : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900',
          className,
        )}
      >
        <Share2 className={cn(iconClassName || 'h-4 w-4', 'shrink-0 text-neutral-400')} />
        {showCount && count !== undefined && (
          <span className="tabular-nums">{count}</span>
        )}
      </button>

      {modalOpen && (
        <ShareModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          actionId={actionId}
          actionTitle={actionTitle ?? ''}
          viewerId={viewerId ?? null}
        />
      )}

      <DisabledNoticeModal
        open={noticeOpen}
        reason={disabledReason}
        onClose={closeNotice}
      />
    </>
  );
}

