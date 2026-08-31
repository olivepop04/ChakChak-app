/**
 * Activity 화면의 상태별 버튼들.
 *
 * 되돌릴 수 없는 동작(나가기·삭제·취소)에는 반드시 확인 창을 띄웁니다.
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { leaveAction, deleteDraft, cancelAction } from '@/lib/mutations';
import { useToast } from '@/components/ui/Toast';

const btn =
  'inline-flex h-9 items-center justify-center rounded-lg px-3 text-[12px] font-semibold transition-colors';
const secondary = `${btn} border border-neutral-300 bg-white text-neutral-700`;
const danger = `${btn} border border-red-200 bg-red-50 text-red-600`;

/** 참여 취소 */
export function LeaveButton({ actionId }: { actionId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function handle() {
    if (busy) return;
    if (
      !confirm(
        '참여를 취소할까요?\n모집 인원에서 빠지고, 크루 게시판에도 들어갈 수 없게 됩니다.',
      )
    )
      return;

    setBusy(true);
    const res = await leaveAction(createClient(), actionId);
    if (!res.ok) toast(res.message, 'error');
    else {
      toast('참여를 취소했어요.');
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <button type="button" onClick={handle} disabled={busy} className={danger}>
      나가기
    </button>
  );
}

/** DRAFT 삭제 — 공개된 적 없는 것만 */
export function DeleteDraftButton({ actionId }: { actionId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function handle() {
    if (busy) return;
    if (!confirm('작성 중인 액션을 삭제할까요?\n되돌릴 수 없습니다.')) return;

    setBusy(true);
    const res = await deleteDraft(createClient(), actionId);
    if (!res.ok) toast(res.message, 'error');
    else {
      toast('삭제했어요.');
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <button type="button" onClick={handle} disabled={busy} className={danger}>
      삭제하기
    </button>
  );
}

/** 액션 취소 — 참여자 전원에게 알림이 갑니다 */
export function CancelActionButton({ actionId }: { actionId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function handle() {
    if (busy) return;

    const reason = prompt(
      '취소 사유를 적어주세요. 참여자에게 그대로 전달됩니다. (5자 이상)',
    );
    if (reason === null) return;

    setBusy(true);
    const res = await cancelAction(createClient(), actionId, reason);
    if (!res.ok) toast(res.message, 'error');
    else {
      toast('액션을 취소했어요. 참여자에게 알림이 갔어요.');
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <button type="button" onClick={handle} disabled={busy} className={secondary}>
      취소하기
    </button>
  );
}
