'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { SharePanel } from '@/components/action/SharePanel';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionId: string;
  actionTitle: string;
  viewerId: string | null;
}

export function ShareModal({
  isOpen,
  onClose,
  actionId,
  actionTitle,
  viewerId,
}: ShareModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 transition-opacity"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl bg-white p-5 transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단 헤더: 타이틀 & 닫기 버튼 */}
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <h2 id="share-modal-title" className="text-[17px] font-bold text-neutral-900">
            공유하기
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
          >
            ✕
          </button>
        </div>

        {/* 모임 제목 영역 */}
        {actionTitle && (
          <div className="border-b border-neutral-100 py-3">
            <p className="line-clamp-2 text-[15px] font-bold leading-snug text-neutral-900">
              {actionTitle}
            </p>
          </div>
        )}

        {/* 공유 패널 (친구 전송 & 링크 복사) */}
        <SharePanel
          actionId={actionId}
          viewerId={viewerId}
          className="flex flex-col gap-6 pt-4"
        />
      </div>
    </div>,
    document.body,
  );
}
