import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-5 text-center">
      <span className="text-4xl">🔍</span>
      <h1 className="text-lg font-bold text-neutral-900">
        페이지를 찾을 수 없습니다
      </h1>
      <p className="text-xs text-neutral-500">
        존재하지 않거나 삭제된 액션입니다.
      </p>
      <Link
        href="/"
        className="mt-3 inline-flex h-11 items-center justify-center rounded-xl bg-neutral-900 px-5 text-sm font-semibold text-white transition-colors active:bg-neutral-800"
      >
        홈으로 돌아가기
      </Link>
    </main>
  );
}
