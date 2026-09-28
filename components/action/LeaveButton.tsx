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
import { useRouter } from 'next/navigation';
import { CircleX } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { leaveActionWithReason } from '@/lib/mutations';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils/cn';
import { ReasonModal } from '@/components/action/ReasonModal';

// 카드 하단 트리거 버튼은 "크루 채팅" 옆 92px 고정폭 · 진한 회색(text-ink) 테두리.
// 튀지 않게(조장 요청, 2026-09-28) — 실제 파괴적 확인은 아래 모달의 '나가기 진행' 버튼에서 받습니다.
const secondary =
  'inline-flex min-h-11 w-[92px] shrink-0 items-center justify-center whitespace-nowrap rounded-xl border border-[#333333] bg-white px-3 text-body font-semibold text-[#333333] transition-colors';

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

  function openModal() {
    setOpen(true);
  }

  function closeModal() {
    if (!busy) setOpen(false);
  }

  async function handleLeave(reason: string) {
    const trimmedReason = reason.trim();
    if (busy || trimmedReason.length < 5) return;

    setBusy(true);
    const res = await leaveActionWithReason(createClient(), actionId, trimmedReason);
    if (!res.ok) {
      toast(res.message, 'error');
    } else {
      toast('참여를 취소했어요.');
      setOpen(false);
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
      <ReasonModal
        open={open}
        title="참여를 취소할까요?"
        icon={CircleX}
        warning={
          <>
            사유는 크루 게시판에 공개되고 <b className="font-bold">지울 수 없어요</b>. 나가면
            게시판에도 들어갈 수 없어요.
          </>
        }
        warningTone="warning"
        reason={{
          label: '참여 취소 사유',
          placeholder: '크루가 이해할 수 있게 5자 이상 적어주세요.',
        }}
        confirmLabel="나가기"
        confirmVariant="muted"
        busy={busy}
        onClose={closeModal}
        onConfirm={handleLeave}
      />
    </>
  );
}
