/**
 * 화면 오류 — 화면을 그리다 오류가 나면(서버에서 데이터를 불러오다 실패한 경우 포함) 이 화면이 뜹니다.
 * 전에는 파일이 없어서 Next.js 기본 영어 문구(「Application error…」)만 흰 화면에 떴습니다.
 *
 * 2026-09-30 Day19 통일안 (소정님 확정) — 404 와 같은 틀:
 *   · 위: 「〈 이전으로 돌아가기」(PreviousPageBar)
 *   · 본문: 회색 원 + TriangleAlert · 부제(17px 굵게 #333, 빈 상태·모달 제목과 같음) · 설명 13px
 *   · 「다시 시도」 는 초록 바탕 없이 글자로만(#333 · 14px 굵게 + RotateCw) 
 *     누르면 서버 데이터를 다시 받고(router.refresh) 이 화면을 다시 그립니다(reset) — reset 만 부르면
 *     브라우저 안에서만 다시 그려서, 서버에서 난 오류는 그대로 남습니다 (2026-10-01)
 *   · 바깥 틀(layout)은 멀쩡한 경우라 하단 탭이 그대로 보입니다 → 「홈으로」 는 따로 두지 않음
 *
 * 바깥 틀까지 깨진 경우는 global-error.tsx 가 그립니다.
 */
'use client';

import { startTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCw, TriangleAlert } from 'lucide-react';
import { PreviousPageBar } from '@/components/layout/PreviousPageBar';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // 원인 추적용 — 브라우저 개발자 도구 콘솔에 남깁니다
    console.error(error);
  }, [error]);

  function retry() {
    startTransition(() => {
      router.refresh();
      reset();
    });
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <PreviousPageBar />

      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-[var(--nav-h)] text-center">
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
          onClick={retry}
          className="mt-4 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-semibold text-[#333333] transition-colors hover:bg-neutral-100"
        >
          <RotateCw className="h-4 w-4" aria-hidden="true" />
          다시 시도
        </button>
      </main>
    </div>
  );
}
