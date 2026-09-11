import Link from 'next/link';

import { getSignupWelcomeReturnPath } from '../../auth-navigation';

export default async function SignupWelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const returnPath = getSignupWelcomeReturnPath(
    Array.isArray(next) ? next[0] : (next ?? null),
  );

  return (
    <main className="flex min-h-dvh flex-col px-6 pb-28 pt-10">
      <div className="flex flex-col items-center text-center">
        <span className="text-5xl" aria-hidden="true">
          🎉
        </span>
        <h1 className="mt-6 text-[28px] font-bold tracking-tight text-neutral-900">
          환영합니다!
        </h1>
        <p className="mt-3 text-[16px] font-semibold text-neutral-800">
          착착과 함께 좋은 일을 함께 해요~
        </p>
        <p className="mt-5 max-w-sm text-[14px] leading-relaxed text-neutral-500 break-keep">
          내가 직접 액션을 만들 수도 있고,
          <br />
          다른 사람이 만든 액션에 크루로 참여할 수도 있어요.
        </p>
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-6">
        {returnPath ? (
          <Link
            href={returnPath}
            className="flex h-13 w-full items-center justify-center rounded-xl border border-neutral-900 bg-white px-5 text-[15px] font-semibold text-neutral-900 transition-colors hover:bg-neutral-50 active:bg-neutral-100"
          >
            방금 보던 액션으로
          </Link>
        ) : null}
        <Link
          href="/action/create"
          className="flex h-13 w-full items-center justify-center rounded-xl bg-neutral-900 px-5 text-[15px] font-semibold text-white transition-colors hover:bg-neutral-800 active:bg-neutral-700"
        >
          액션 만들기
        </Link>
        <Link
          href="/discover"
          className="flex h-13 w-full items-center justify-center rounded-xl border border-neutral-300 bg-white px-5 text-[15px] font-semibold text-neutral-800 transition-colors hover:bg-neutral-50 active:bg-neutral-100"
        >
          액션 찾아보기
        </Link>
      </div>
    </main>
  );
}
