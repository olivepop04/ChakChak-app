/**
 * 앱 전체 오류 — 맨 바깥 틀(app/layout.tsx)까지 깨졌을 때 Next.js 가 layout 대신 이 파일만 그립니다.
 * 그래서 <html>·<body>·전역 CSS 를 여기서 직접 다시 넣습니다(layout 을 못 믿는 상황이라).
 * 거의 뜨지 않는 화면입니다 — 보통의 오류는 app/error.tsx 가 받습니다.
 *
 * 2026-09-30 Day19 통일안 (소정님 확정):
 *   · app/error.tsx 와 같은 모양(〈 이전으로 돌아가기 · 회색 원 + TriangleAlert · 「다시 시도」 글자)
 *   · 하단 탭이 layout 에 붙어 있어 여기서는 안 보입니다 → 빠져나갈 길로 「홈으로」 글자 링크를 둡니다.
 *     하단 탭을 여기 억지로 넣지 않은 이유: 바깥 틀이 깨진 원인이 그쪽일 수도 있어서입니다.
 */
'use client';

import './globals.css';
import { useEffect } from 'react';
import { RotateCw, TriangleAlert } from 'lucide-react';
import { PreviousPageBar } from '@/components/layout/PreviousPageBar';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 원인 추적용 — 브라우저 개발자 도구 콘솔에 남깁니다
    console.error(error);
  }, [error]);

  return (
    <html lang="ko">
      <body className="antialiased">
        <div className="app-shell flex min-h-dvh flex-col">
          <PreviousPageBar />

          <main className="flex flex-1 flex-col items-center justify-center px-6 pb-8 text-center">
            <span
              aria-hidden="true"
              className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100"
            >
              <TriangleAlert className="h-8 w-8 text-neutral-500" />
            </span>
            <h1 className="mt-5 text-subtitle font-bold text-[#333333]">
              잠시 문제가 생겼어요
            </h1>
            <p className="mt-2 text-label leading-relaxed text-neutral-500 break-keep">
              일시적인 오류예요. 잠시 후 다시 시도해 주세요.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-4 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-semibold text-[#333333] transition-colors hover:bg-neutral-100"
            >
              <RotateCw className="h-4 w-4" aria-hidden="true" />
              다시 시도
            </button>
            {/* 하단 탭이 없는 화면이라 이 링크가 확실한 나갈 길입니다. 지우지 마세요.
                <Link> 대신 <a> — 앱 라우터 상태를 못 믿는 상황이라 전체 새로고침으로 홈에 갑니다. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              className="inline-flex min-h-11 items-center justify-center px-3 text-label font-medium text-neutral-500 transition-colors hover:text-neutral-800"
            >
              홈으로
            </a>
          </main>
        </div>
      </body>
    </html>
  );
}
