'use client';

import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';

interface ReasonModalProps {
  open: boolean;
  title: string;
  description?: string;
  warning?: string;
  warningTone?: 'danger' | 'warning';
  reason?: {
    label: string;
    placeholder?: string;
    minLength?: number;
    maxLength?: number;
  };
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
}

export function ReasonModal({
  open,
  title,
  description,
  warning,
  warningTone = 'danger',
  reason,
  confirmLabel,
  cancelLabel = '취소',
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

  const warningClassName =
    warningTone === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-red-100 bg-red-50 text-red-800';

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
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
      >
        <h2 id={titleId} className="text-[17px] font-bold text-neutral-900">
          {title}
        </h2>
        {description && (
          <p className="mt-2 text-[13px] leading-relaxed text-neutral-500">{description}</p>
        )}
        {warning && (
          <p
            className={`mt-3 rounded-lg border px-3 py-2 text-[13px] font-semibold leading-relaxed ${warningClassName}`}
          >
            {warning}
          </p>
        )}

        {reason && (
          <>
            <label className="mt-4 flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-neutral-700">{reason.label}</span>
              <textarea
                autoFocus
                value={value}
                onChange={(event) => setValue(event.target.value)}
                rows={4}
                maxLength={maxLength}
                disabled={isBusy}
                placeholder={reason.placeholder}
                className="resize-none rounded-xl border border-neutral-300 p-3 text-sm leading-relaxed outline-none focus:border-neutral-900 disabled:bg-neutral-50"
              />
            </label>
            <div className="mt-1 flex items-center justify-between gap-3 text-[11px]">
              <span
                className={
                  trimmedLength > 0 && trimmedLength < minLength
                    ? 'text-red-600'
                    : 'text-neutral-400'
                }
              >
                {minLength}자 이상 입력해주세요.
              </span>
              <span className="text-neutral-400">
                {value.length}/{maxLength}
              </span>
            </div>
          </>
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
            className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-red-600 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isBusy ? '처리 중...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
