/**
 * 로그인.
 *
 * (auth) 처럼 괄호가 붙은 폴더는 주소에 들어가지 않습니다. → /login
 *
 * middleware 가 보호 화면 접근을 막을 때 /login?next=/my 형태로 보냅니다.
 * 로그인에 성공하면 next 로 돌려보냅니다.
 */
'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { safeNextPath, withNext } from '@/app/(auth)/auth-navigation';
import { getLoginNotice } from '@/lib/utils/auth-notice';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get('next'));
  // middleware 가 막아서 온 경우, 왜 로그인 화면이 떴는지 한 줄 알려줍니다.
  // 그냥 눌러서 온 경우(next 가 '/')에는 null 이라 아무것도 안 나옵니다. (2026-09-11 회의)
  const notice = getLoginNotice(next);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    setError('');

    const { error: signInError } = await createClient().auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError('이메일 또는 비밀번호가 맞지 않아요.');
      setBusy(false);
      return;
    }

    router.push(next);
    // 서버 컴포넌트가 로그인 상태를 다시 읽게 한다.
    // 이걸 빠뜨리면 로그인은 됐는데 화면이 로그아웃 상태로 보입니다.
    router.refresh();
  }

  return (
    <main className="flex min-h-dvh flex-col px-6 pb-10 pt-16">
      <div className="mb-10">
        <p className="text-2xl font-bold tracking-tight text-neutral-900">착착</p>
        <p className="mt-2 text-sm leading-relaxed text-neutral-500">
          좋은 일을 찾고,
          <br />
          함께하고, 다시 나누는 곳
        </p>

        {notice && (
          <p className="mt-5 rounded-xl bg-neutral-100 px-4 py-3 text-[13px] leading-relaxed text-neutral-700">
            {notice}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-neutral-700">이메일</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 rounded-xl border border-neutral-300 px-4 text-[15px] outline-none focus:border-neutral-900"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-neutral-700">비밀번호</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 rounded-xl border border-neutral-300 px-4 text-[15px] outline-none focus:border-neutral-900"
          />
        </label>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-600">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" fullWidth loading={busy} className="mt-2">
          로그인
        </Button>
      </form>

      <p className="mt-6 text-center text-[13px] text-neutral-500">
        아직 계정이 없나요?{' '}
        <Link
          href={withNext('/signup', next)}
          className="font-semibold text-neutral-900 underline"
        >
          가입하기
        </Link>
      </p>
    </main>
  );
}

export default function LoginPage() {
  // useSearchParams 를 쓰는 컴포넌트는 Suspense 로 감싸야 빌드가 통과합니다.
  return (
    <Suspense fallback={<div className="p-6 text-sm text-neutral-400">불러오는 중…</div>}>
      <LoginForm />
    </Suspense>
  );
}
