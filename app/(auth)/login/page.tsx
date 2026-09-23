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
import { Input } from '@/components/ui/Input';
import { FieldLabel } from '@/components/ui/FieldLabel';
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
    <main className="flex min-h-dvh flex-col px-5 pb-8 pt-8">
      <div className="mb-8">
        <p className="text-2xl font-bold tracking-tight text-neutral-900">착착</p>
        <p className="mt-2 text-sm leading-relaxed text-neutral-500">
          착한 일을 착착,
          <br />
          쉽고 즐겁게!
        </p>

        {notice && (
          <p className="mt-5 rounded-xl bg-neutral-100 px-4 py-3 text-label leading-relaxed text-neutral-700">
            {notice}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <FieldLabel>이메일</FieldLabel>
          <Input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <FieldLabel>비밀번호</FieldLabel>
          <Input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-label text-red-600">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" fullWidth loading={busy} className="mt-2">
          로그인
        </Button>
      </form>

      <p className="mt-6 text-center text-label text-neutral-500">
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
