'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function LogoutButton() {
  const router = useRouter();

  async function handle() {
    if (!confirm('로그아웃할까요?')) return;
    await createClient().auth.signOut();
    router.push('/');
    // 서버 컴포넌트가 로그아웃 상태를 다시 읽게 한다
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handle}
      className="flex w-full items-center justify-between px-5 py-4 text-left text-[14px] text-neutral-700 hover:bg-neutral-50"
    >
      로그아웃
      <span className="text-neutral-300">›</span>
    </button>
  );
}
