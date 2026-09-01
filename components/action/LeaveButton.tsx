/**
 * 참여 취소 버튼 — 담당: 개발 B
 *
 * 원래 ActivityButtons.tsx(조장 담당) 안에 있었는데,
 * F40(나가기 사유 남기기)이 개발 B 과업이라 파일을 분리했습니다.
 * 이제 개발 B가 이 파일만 고치면 됩니다. 조장 파일은 건드리지 않아도 됩니다.
 *
 * ── F40 을 할 때 ─────────────────────────────────────────
 * 지금은 사유 없이 나가는 leaveAction() 을 씁니다.
 * 사유를 받게 바꾸려면 confirm() 대신 입력 창을 띄우고
 * leaveActionWithReason(supabase, actionId, reason) 하나만 부르면 됩니다.
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
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { leaveAction } from '@/lib/mutations';
import { useToast } from '@/components/ui/Toast';

const danger =
  'inline-flex h-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 text-[12px] font-semibold text-red-600 transition-colors';

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
