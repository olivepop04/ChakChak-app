'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
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
        className="relative flex w-full max-w-sm sm:max-w-md max-h-[90vh] flex-col overflow-hidden rounded-xl bg-white transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단 브랜드 컬러 바 (모달 상단 라운드 테두리 곡률과 일치) */}
        <div className="h-[5px] w-full flex-none bg-brand" />

        {/* 상단 헤더: 타이틀 & 닫기 버튼 — 모달 안쪽 여백 20px 안에서 구분선 */}
        <div className="mx-5 flex items-center justify-between border-b border-neutral-100 pb-3 pt-5">
          {/* 제목 색 #333 — 모달 제목 통일 (2026-09-30) */}
          <h2 id="share-modal-title" className="text-subtitle font-bold text-[#333333]">
            공유하기
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* 모임 제목 영역 */}
        {actionTitle && (
          <div className="mx-5 border-b border-neutral-100 py-3">
            <p className="line-clamp-2 font-paperlogy text-subtitle font-bold leading-snug text-[#333333]">
              {actionTitle}
            </p>
          </div>
        )}

        {/* 공유 패널 (친구 전송 & 링크 복사) */}
        <div className="overflow-y-auto">
          <SharePanel
            actionId={actionId}
            viewerId={viewerId}
            variant="modal"
            className="flex flex-col gap-6 px-5 pb-5 pt-4"
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
