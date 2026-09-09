/**
 * 참여 취소 버튼 — 담당: 개발 B
 *
 * 원래 ActivityButtons.tsx(조장 담당) 안에 있었는데,
 * F40(나가기 사유 남기기)이 개발 B 과업이라 파일을 분리했습니다.
 * 이제 개발 B가 이 파일만 고치면 됩니다. 조장 파일은 건드리지 않아도 됩니다.
 *
 * F40 — 사유 입력 뒤 leaveActionWithReason() 하나만 호출합니다.
 *
 *   ① 사유를 게시판에 올린다 (kind = 'LEFT_NOTICE')
 *   ② 참여 상태를 LEFT 로
 *   ③ 호스트에게 알림 (사유 포함)
 *
 * 세 가지가 한 트랜잭션으로 돌아갑니다. 나눠 부르지 마세요 —
 * 나가고 나면 게시판 권한이 사라져서 순서가 틀어지면 글이 안 올라갑니다.
 * 사유는 5자 이상 필수이고, 한 번 올리면 본인도 지울 수 없습니다.
 */
'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { leaveActionWithReason } from '@/lib/mutations';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils/cn';

// 카드 하단 트리거 버튼은 CREW CHAT 등 다른 버튼과 같은 중립 스타일(하양 바탕 · 회색 글씨).
// 실제 파괴적 확인은 아래 모달의 빨강 '나가기 진행' 버튼에서 받습니다.
const secondary =
  'inline-flex h-9 items-center justify-center rounded-lg border border-neutral-300 bg-white px-3 text-[12px] font-semibold text-neutral-700 transition-colors';

export function LeaveButton({
  actionId,
  className,
}: {
  actionId: string;
  className?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');

  function openModal() {
    setReason('');
    setOpen(true);
  }

  function closeModal() {
    if (!busy) setOpen(false);
  }

  async function handleLeave() {
    const trimmedReason = reason.trim();
    if (busy || trimmedReason.length < 5) return;

    setBusy(true);
    const res = await leaveActionWithReason(createClient(), actionId, trimmedReason);
    if (!res.ok) {
      toast(res.message, 'error');
    } else {
      toast('참여를 취소했어요.');
      setOpen(false);
      setReason('');
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        disabled={busy}
        className={cn(secondary, className)}
      >
        나가기
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeModal();
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="leave-modal-title"
              className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
            >
              <h2 id="leave-modal-title" className="text-[17px] font-bold text-neutral-900">
                참여를 취소할까요?
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-neutral-500">
                사유는 크루 게시판에 남으며, 참여를 취소하면 게시판에 들어갈 수 없어요.
              </p>
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] font-semibold leading-relaxed text-amber-800">
                이 내용은 크루에게 공개되며, 한번 보내면 지울 수 없습니다.
              </p>

              <label className="mt-4 flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-neutral-700">참여 취소 사유</span>
                <textarea
                  autoFocus
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={5}
                  maxLength={1000}
                  disabled={busy}
                  placeholder="크루가 상황을 이해할 수 있도록 사유를 적어주세요."
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
                    ? '사유를 5자 이상 적어주세요.'
                    : '5자 이상 입력해주세요.'}
                </span>
                <span className="text-neutral-400">{reason.length}/1000</span>
              </div>

              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={busy}
                  className="flex h-11 flex-1 items-center justify-center rounded-xl border border-neutral-300 text-sm font-semibold text-neutral-700 disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleLeave}
                  disabled={busy || reason.trim().length < 5}
                  className="flex h-11 flex-1 items-center justify-center rounded-xl bg-red-600 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy ? '처리 중...' : '나가기 진행'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
