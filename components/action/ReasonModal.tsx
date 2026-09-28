'use client';

import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';
import { TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface ReasonModalProps {
  open: boolean;
  title: string;
  /** 제목 앞 아이콘 (선택) — 내 액션 통일안(2026-09-28)에서 추가 */
  icon?: LucideIcon;
  description?: React.ReactNode;
  warning?: React.ReactNode;
  warningTone?: 'danger' | 'warning';
  reason?: {
    label: string;
    placeholder?: string;
    minLength?: number;
    maxLength?: number;
  };
  confirmLabel: string;
  /**
   * 확인 버튼 색 — 'default'는 포인트 그린(로그아웃 등), 'danger'는 되돌릴 수 없는 진짜 삭제,
   * 'muted'는 text-muted 회색(취소·조기종료·나가기 — 2026-09-28, "튀지 않게" 요청)
   */
  confirmVariant?: 'default' | 'danger' | 'muted';
  cancelLabel?: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
}

export function ReasonModal({
  open,
  title,
  icon: Icon,
  description,
  warning,
  warningTone = 'danger',
  reason,
  confirmLabel,
  confirmVariant = 'default',
  cancelLabel = '닫기',
  busy = false,
  onClose,
  onConfirm,
}: ReasonModalProps) {
  const [mounted, setMounted] = useState(false);
  const [value, setValue] = useState('');
  const [confirming, setConfirming] = useState(false);
  const titleId = useId();
  const minLength = reason?.minLength ?? 5;
  const maxLength = reason?.maxLength ?? 1000;
  const isBusy = busy || confirming;
  const trimmedLength = value.trim().length;
  const canConfirm = !reason || trimmedLength >= minLength;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) setValue('');
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isBusy) onClose();
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isBusy, onClose, open]);

  if (!mounted || !open) return null;

  async function handleConfirm() {
    if (isBusy || !canConfirm) return;

    setConfirming(true);
    try {
      await onConfirm(reason ? value.trim() : '');
    } finally {
      setConfirming(false);
    }
  }

  function handleClose() {
    if (!isBusy) onClose();
  }

  // 왼쪽 정렬(사유 입력이 있는 모달) / 가운데 정렬(설명만 있는 모달) — 내 액션 통일안, 2026-09-28
  const centered = !reason;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5"
      >
        <h2
          id={titleId}
          className={cn(
            'flex items-center gap-2 text-subtitle font-bold text-[#333333]',
            centered ? 'justify-center text-center' : 'justify-start text-left',
          )}
        >
          {Icon && <Icon className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden="true" />}
          <span>{title}</span>
        </h2>
        {description && (
          <p
            className={cn(
              'mt-2 text-label leading-relaxed text-neutral-500',
              centered && 'text-center',
            )}
          >
            {description}
          </p>
        )}
        {warning && (
          <div
            className={cn(
              'flex items-start gap-2 rounded-xl px-3 py-2.5',
              description ? 'mt-3' : 'mt-2',
              warningTone === 'warning'
                ? 'border border-warning bg-warning-soft'
                : 'border border-danger bg-danger-soft',
            )}
          >
            <span
              className={cn(
                'mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-md',
                warningTone === 'warning' ? 'bg-warning' : 'bg-danger',
              )}
            >
              <TriangleAlert
                className={cn('h-3.5 w-3.5', warningTone === 'warning' ? 'text-warning-ink' : 'text-white')}
                strokeWidth={2.25}
                aria-hidden="true"
              />
            </span>
            <p
              className={cn(
                'text-label font-medium leading-relaxed',
                warningTone === 'warning' ? 'text-warning-ink' : 'text-danger',
              )}
            >
              {warning}
            </p>
          </div>
        )}

        {reason && (
          <label className="mt-4 flex flex-col gap-1.5">
            <span className="sr-only">{reason.label}</span>
            <textarea
              autoFocus
              aria-label={reason.label}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              rows={4}
              maxLength={maxLength}
              disabled={isBusy}
              placeholder={reason.placeholder}
              className="h-[117px] resize-none rounded-xl border border-hairline p-3 text-body leading-relaxed outline-none focus:border-hairline-focus disabled:bg-neutral-50"
            />
          </label>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={isBusy}
            className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-neutral-300 py-3 text-sm font-semibold text-neutral-700 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isBusy || !canConfirm}
            className={cn(
              'flex min-h-11 flex-1 items-center justify-center rounded-xl py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40',
              confirmVariant === 'danger' && 'bg-danger',
              confirmVariant === 'muted' && 'bg-[#7A7A7A]',
              confirmVariant === 'default' && 'bg-brand',
            )}
          >
            {isBusy ? '처리 중...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
