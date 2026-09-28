/**
 * Activity 화면의 상태별 버튼들.
 *
 * 되돌릴 수 없는 동작(나가기·삭제·취소)에는 반드시 확인 창을 띄웁니다.
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { deleteDraft, cancelAction, endActionEarly } from '@/lib/mutations';
import { useToast } from '@/components/ui/Toast';
import { ReasonModal } from '@/components/action/ReasonModal';

// 되돌리기 어려운 것(취소하기·조기종료·삭제하기)은 튀지 않게 진한 회색(text-ink) 테두리로 통일 (조장 요청, 2026-09-28).
const btn =
  'inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-xl px-3 text-body font-semibold transition-colors border border-[#333333] bg-white text-[#333333]';
// 크루 채팅 옆 — 고정 92px(줄바꿈 없음)
const grayFixed = `${btn} w-[92px] shrink-0`;
// 크루 채팅이 없는 줄(삭제하기+계속 작성하기) — 1:1
const grayFlex = `${btn} flex-1`;

/**
 * 참여 취소 버튼은 components/action/LeaveButton.tsx 로 옮겼습니다 (개발 B 담당).
 * F40(나가기 사유)이 개발 B 과업이라 조장 파일을 안 건드려도 되게 분리했습니다.
 * 기존에 이 파일에서 가져다 쓰던 곳이 안 깨지도록 여기서 다시 내보냅니다.
 */
export { LeaveButton } from '@/components/action/LeaveButton';

export function DeleteDraftButton({ actionId }: { actionId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function handle() {
    if (busy) return;

    setBusy(true);
    const res = await deleteDraft(createClient(), actionId);
    if (!res.ok) toast(res.message, 'error');
    else {
      toast('삭제했어요.');
      setOpen(false);
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <>
      <button type="button" className={grayFlex} onClick={() => setOpen(true)} disabled={busy}>
        삭제하기
      </button>
      <ReasonModal
        open={open}
        title="작성 중인 액션을 삭제할까요?"
        description="되돌릴 수 없습니다."
        confirmLabel="삭제 진행"
        confirmVariant="danger"
        busy={busy}
        onClose={() => setOpen(false)}
        onConfirm={handle}
      />
    </>
  );
}

/** 액션 취소 — 참여자 전원에게 알림이 갑니다 */
export function CancelActionButton({ actionId }: { actionId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function handle(reason: string) {
    const trimmedReason = reason.trim();
    if (busy || trimmedReason.length < 5) return;

    setBusy(true);
    const res = await cancelAction(createClient(), actionId, trimmedReason);
    if (!res.ok) toast(res.message, 'error');
    else {
      toast('액션을 취소했어요. 참여자에게 알림이 갔어요.');
      setOpen(false);
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} disabled={busy} className={grayFixed}>
        취소하기
      </button>
      <ReasonModal
        open={open}
        title="액션을 취소할까요?"
        description="취소 사유는 참여자에게 그대로 전달됩니다."
        reason={{ label: '취소 사유' }}
        confirmLabel="취소 진행"
        busy={busy}
        onClose={() => setOpen(false)}
        onConfirm={handle}
      />
    </>
  );
}

/** 조기 종료 — 활동 중(시작 이후)인 액션을 일찍 종료합니다 */
export function EarlyEndButton({ actionId }: { actionId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function handle(reason: string) {
    const trimmedReason = reason.trim();
    if (busy || trimmedReason.length < 5) return;

    setBusy(true);
    const res = await endActionEarly(createClient(), actionId, trimmedReason);
    if (!res.ok) toast(res.message, 'error');
    else {
      toast('활동을 일찍 종료했어요. 크루들에게 알림이 갔어요.');
      setOpen(false);
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} disabled={busy} className={grayFixed}>
        조기종료
      </button>
      <ReasonModal
        open={open}
        title="활동을 조기 종료할까요?"
        description="조기 종료 사유는 크루들에게 그대로 전달됩니다."
        reason={{ label: '조기 종료 사유' }}
        confirmLabel="조기 종료 진행"
        busy={busy}
        onClose={() => setOpen(false)}
        onConfirm={handle}
      />
    </>
  );
}
