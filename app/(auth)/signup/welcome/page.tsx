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

  // 하단 탭을 숨기는 화면이라(BottomNav.tsx) 탭을 피하려던 pb-28 은 필요 없습니다.
  // 글자를 키웠을 때 아래가 답답하지 않을 만큼만 남깁니다.
  return (
    <main className="flex min-h-dvh flex-col px-5 pb-8 pt-8">
      <div className="flex flex-col items-center text-center">
        <span className="text-5xl" aria-hidden="true">
          🎉
        </span>
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-neutral-900">
          환영합니다!
        </h1>
        <p className="mt-3 text-subtitle font-semibold text-neutral-800">
          착착과 함께 좋은 일을 함께 해요~
        </p>
        <p className="mt-5 max-w-sm text-body leading-relaxed text-neutral-500 break-keep">
          내가 직접 액션을 만들 수도 있고,
          <br />
          다른 사람이 만든 액션에 크루로 참여할 수도 있어요.
        </p>
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-6">
        {returnPath ? (
          <Link
            href={returnPath}
            className="flex min-h-13 w-full items-center justify-center rounded-xl border border-neutral-900 bg-white px-5 py-3 text-body font-semibold text-neutral-900 transition-colors hover:bg-neutral-50 active:bg-neutral-100"
          >
            방금 보던 액션으로
          </Link>
        ) : null}
        <Link
          href="/action/create"
          className="flex min-h-13 w-full items-center justify-center rounded-xl bg-neutral-900 px-5 py-3 text-body font-semibold text-white transition-colors hover:bg-neutral-800 active:bg-neutral-700"
        >
          액션 만들기
        </Link>
        <Link
          href="/discover"
          className="flex min-h-13 w-full items-center justify-center rounded-xl border border-neutral-300 bg-white px-5 py-3 text-body font-semibold text-neutral-800 transition-colors hover:bg-neutral-50 active:bg-neutral-100"
        >
          액션 찾아보기
        </Link>

        {/* ★ 지우지 마세요 (2026-09-11).
            이 화면은 하단 탭을 숨깁니다(BottomNav.tsx). 위의 세 버튼 중 어느 것도
            고르고 싶지 않은 사람에게는 이 링크가 유일한 나갈 길입니다.
            2026-09-01 합의(F02)가 "환영 화면에 나갈 길을 남긴다" 였고, 그 취지를 지킨 것입니다. */}
        <Link
          href="/"
          className="mt-1 flex min-h-11 w-full items-center justify-center py-2 text-label font-medium text-neutral-500 transition-colors hover:text-neutral-900"
        >
          홈으로
        </Link>
      </div>
    </main>
  );
}
