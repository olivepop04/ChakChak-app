'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ReasonModal } from '@/components/action/ReasonModal';

export function LogoutButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handle() {
    if (busy) return;

    setBusy(true);
    try {
      await createClient().auth.signOut();
      setOpen(false);
      router.push('/');
      // 서버 컴포넌트가 로그아웃 상태를 다시 읽게 한다
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={busy}
        className="flex w-full items-center justify-between px-5 py-4 text-left text-[14px] text-neutral-700 hover:bg-neutral-50"
      >
        로그아웃
        <span className="text-neutral-300">›</span>
      </button>
      <ReasonModal
        open={open}
        title="로그아웃할까요?"
        confirmLabel="로그아웃"
        busy={busy}
        onClose={() => setOpen(false)}
        onConfirm={handle}
      />
    </>
  );
}
