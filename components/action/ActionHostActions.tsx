'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cancelAction, endActionEarly } from '@/lib/mutations';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils/cn';
import type { ActionStatus } from '@/lib/constants';

interface ActionHostActionsProps {
  actionId: string;
  status: ActionStatus;
  activityStartAt: string | null;
  activityEndAt: string | null;
  variant?: 'button' | 'header';
  className?: string;
}

type ModalMode = 'cancel' | 'early_end' | null;

export function ActionHostActions({
  actionId,
  status,
  activityStartAt,
  activityEndAt,
  variant = 'button',
  className,
}: ActionHostActionsProps) {
  const router = useRouter();
  const toast = useToast();

  const [mode, setMode] = useState<ModalMode>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 활동 시작 및 종료 여부 판단
  const now = new Date();
  const isStarted = activityStartAt ? now >= new Date(activityStartAt) : false;
  const isPastActivityEnd = activityEndAt ? now > new Date(activityEndAt) : false;

  // 활동 중이 아니거나 종료/취소된 경우 동작 불가
  const canCancel = status === 'ACTIVE' && !isStarted;
  const canEarlyEnd = status === 'ACTIVE' && isStarted && !isPastActivityEnd;

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  if (!canCancel && !canEarlyEnd) {
    return null;
  }

  function openModal(targetMode: 'cancel' | 'early_end') {
    setReason('');
    setMenuOpen(false);
    setMode(targetMode);
  }

  function closeModal() {
    if (!busy) {
      setMode(null);
      setReason('');
    }
  }

  async function handleSubmit() {
    const trimmed = reason.trim();
    if (busy || trimmed.length < 5) return;

    setBusy(true);
    const supabase = createClient();

    if (mode === 'early_end') {
      const res = await endActionEarly(supabase, actionId, trimmed);
      if (!res.ok) {
        toast(res.message, 'error');
      } else {
        toast('활동을 일찍 종료했어요. 크루들에게 알림이 갔어요.');
        setMode(null);
        setReason('');
        router.refresh();
      }
    } else if (mode === 'cancel') {
      const res = await cancelAction(supabase, actionId, trimmed);
      if (!res.ok) {
        toast(res.message, 'error');
      } else {
        toast('액션을 취소했어요. 참여자에게 알림이 갔어요.');
        setMode(null);
        setReason('');
        router.refresh();
      }
    }

    setBusy(false);
  }

  return (
    <>
      {variant === 'header' ? (
        <div ref={menuRef} className="relative inline-block">
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="호스트 액션 관리 메뉴"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
              <circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none" />
            </svg>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full z-40 mt-1 min-w-[140px] rounded-xl border border-neutral-200 bg-white py-1.5 shadow-lg">
              {canEarlyEnd && (
                <button
                  type="button"
                  onClick={() => openModal('early_end')}
                  className="flex w-full items-center px-4 py-2.5 text-left text-[13px] font-medium text-red-600 hover:bg-red-50"
                >
                  조기 종료
                </button>
              )}
              {canCancel && (
                <button
                  type="button"
                  onClick={() => openModal('cancel')}
                  className="flex w-full items-center px-4 py-2.5 text-left text-[13px] font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  액션 취소
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className={cn('inline-flex items-center gap-1.5', className)}>
          {canEarlyEnd && (
            <button
              type="button"
              onClick={() => openModal('early_end')}
              className="inline-flex self-start rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-600 transition-colors hover:bg-red-100"
            >
              조기 종료
            </button>
          )}
          {canCancel && (
            <button
              type="button"
              onClick={() => openModal('cancel')}
              className="inline-flex self-start rounded-lg border border-neutral-200 px-3 py-2 text-[12px] font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              취소하기
            </button>
          )}
        </div>
      )}

      {/* 사유 작성 모달 */}
      {mode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="host-action-modal-title"
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
          >
            <h2
              id="host-action-modal-title"
              className="text-[17px] font-bold text-neutral-900"
            >
              {mode === 'early_end' ? '활동을 조기 종료할까요?' : '액션을 취소할까요?'}
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-neutral-500">
              {mode === 'early_end'
                ? '조기 종료 사유는 크루들에게 알림으로 전달됩니다. 활동이 일찍 끝났더라도 결과를 남겨주시면 완료 액션으로 인정돼요.'
                : '취소 사유는 참여자 전원에게 알림으로 전달됩니다.'}
            </p>
            <p className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-[13px] font-semibold leading-relaxed text-red-800">
              이 내용은 {mode === 'early_end' ? '크루' : '참여자'}에게 공개되며, 되돌릴 수 없습니다.
            </p>

            <label className="mt-4 flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-neutral-700">
                {mode === 'early_end' ? '조기 종료 사유' : '취소 사유'}
              </span>
              <textarea
                autoFocus
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                maxLength={1000}
                disabled={busy}
                placeholder={
                  mode === 'early_end'
                    ? '크루들이 상황을 이해할 수 있도록 사유를 적어주세요.'
                    : '크루들이 상황을 이해할 수 있도록 사유를 적어주세요.'
                }
                className="resize-none rounded-xl border border-neutral-300 p-3 text-sm leading-relaxed outline-none focus:border-neutral-900 disabled:bg-neutral-50"
              />
            </label>
            <div className="mt-1 flex items-center justify-between gap-3 text-[11px]">
              <span
                className={
                  reason.trim().length > 0 && reason.trim().length < 5
                    ? 'text-red-600'
                    : 'text-neutral-400'
                }
              >
                {reason.trim().length > 0 && reason.trim().length < 5
                  ? '5자 이상 입력해주세요.'
                  : '5자 이상 입력해주세요.'}
              </span>
              <span className="text-neutral-400">{reason.length}/1000</span>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={closeModal}
                disabled={busy}
                className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-neutral-300 py-3 text-sm font-semibold text-neutral-700 disabled:opacity-50"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={busy || reason.trim().length < 5}
                className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-red-600 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? '처리 중...' : mode === 'early_end' ? '조기 종료 진행' : '취소 진행'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
