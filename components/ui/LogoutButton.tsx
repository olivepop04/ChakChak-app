'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, LogOut } from 'lucide-react';
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
        // 「알림 설정」 줄(app/my/page.tsx)과 같은 모양 — 15px · ChevronRight (2026-09-29)
        className="flex min-h-[52px] w-full items-center justify-between px-6 text-left text-body font-medium text-neutral-800 hover:bg-neutral-50"
      >
        로그아웃
        <ChevronRight className="h-[18px] w-[18px] text-faint" aria-hidden="true" />
      </button>
      <ReasonModal
        open={open}
        title="로그아웃할까요?"
        icon={LogOut}
        confirmLabel="로그아웃"
        busy={busy}
        onClose={() => setOpen(false)}
        onConfirm={handle}
      />
    </>
  );
}
