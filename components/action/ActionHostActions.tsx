'use client';

import { useState, useRef, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cancelAction, endActionEarly } from '@/lib/mutations';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils/cn';
import { ReasonModal } from '@/components/action/ReasonModal';
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
    setMenuOpen(false);
    setMode(targetMode);
  }

  function closeModal() {
    if (!busy) {
      setMode(null);
    }
  }

  async function handleSubmit(reason: string) {
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
        router.refresh();
      }
    } else if (mode === 'cancel') {
      const res = await cancelAction(supabase, actionId, trimmed);
      if (!res.ok) {
        toast(res.message, 'error');
      } else {
        toast('액션을 취소했어요. 참여자에게 알림이 갔어요.');
        setMode(null);
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
            className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100"
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
            <div className="absolute right-0 top-full z-40 mt-1 min-w-[140px] rounded-xl border border-neutral-200 bg-white py-1.5">
              {canEarlyEnd && (
                <button
                  type="button"
                  onClick={() => openModal('early_end')}
                  className="flex w-full items-center px-4 py-2.5 text-left text-label font-medium text-red-600 hover:bg-red-50"
                >
                  조기 종료
                </button>
              )}
              {canCancel && (
                <button
                  type="button"
                  onClick={() => openModal('cancel')}
                  className="flex w-full items-center px-4 py-2.5 text-left text-label font-medium text-neutral-700 hover:bg-neutral-50"
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
              className="inline-flex self-start rounded-full border border-red-200 bg-red-50 px-3 py-2 text-label font-semibold text-red-600 transition-colors hover:bg-red-100"
            >
              조기 종료
            </button>
          )}
          {canCancel && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => openModal('cancel')}
              className="self-start"
            >
              <Trash2 className="h-3.5 w-3.5" />
              액션 취소
            </Button>
          )}
        </div>
      )}

      {mode && (
        <ReasonModal
          open
          title={mode === 'early_end' ? '활동을 조기 종료할까요?' : '액션을 취소할까요?'}
          description={
            mode === 'early_end'
              ? '조기 종료 사유는 크루들에게 알림으로 전달됩니다. 일찍 끝난 활동이라도 결과를 남겨주시면 크루들이 소감을 남길 수 있어요.'
              : '취소 사유는 참여자 전원에게 알림으로 전달됩니다.'
          }
          warning={`이 내용은 ${mode === 'early_end' ? '크루' : '참여자'}에게 공개되며, 되돌릴 수 없습니다.`}
          reason={{
            label: mode === 'early_end' ? '조기 종료 사유' : '취소 사유',
            placeholder: '크루들이 상황을 이해할 수 있도록 5자 이상 적어주세요.',
          }}
          confirmLabel={mode === 'early_end' ? '조기 종료 진행' : '취소 진행'}
          cancelLabel="닫기"
          busy={busy}
          onClose={closeModal}
          onConfirm={handleSubmit}
        />
      )}
    </>
  );
}
