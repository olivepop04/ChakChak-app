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
import { Button } from '@/components/ui/Button';

const btn =
  'inline-flex min-h-9 items-center justify-center rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors';
const secondary = `${btn} border border-neutral-300 bg-white text-neutral-700`;

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
      <Button type="button" variant="danger" size="sm" onClick={() => setOpen(true)} disabled={busy}>
        삭제하기
      </Button>
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
      <button type="button" onClick={() => setOpen(true)} disabled={busy} className={secondary}>
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
      <button type="button" onClick={() => setOpen(true)} disabled={busy} className={secondary}>
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
