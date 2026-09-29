/**
 * 404 — 없는 주소 · 없거나 삭제된 액션(notFound() 10개 화면) · 없는 사람 프로필(5개 화면)이
 * 전부 이 한 화면으로 옵니다. 그래서 설명은 「액션」이 아니라 공통 문구입니다.
 *
 * 2026-09-30 Day19 통일안 (소정님 확정, B안):
 *   · 위: 「〈 이전으로 돌아가기」 — 공용 상단 바(Header)와 같은 모양이지만
 *     글자까지 한 덩어리 버튼이라 글자를 눌러도 뒤로 갑니다.
 *     돌아갈 화면이 없으면(링크로 바로 열기) 홈으로 — Header 와 같은 동작.
 *   · 본문: 회색 원 + SearchX · 제목2(페이퍼로지 700 20px) · 설명 13px. 본문 버튼 없음(홈은 하단 탭).
 */
'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft, SearchX } from 'lucide-react';

export default function NotFound() {
  const router = useRouter();

  function handleBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 items-center bg-white px-3">
        <button
          type="button"
          onClick={handleBack}
          className="flex min-h-11 items-center gap-2 rounded-full pr-3 text-[#333333] transition-colors hover:bg-neutral-100 active:bg-neutral-200"
        >
          <span className="flex h-9 w-9 items-center justify-center">
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-body font-bold">이전으로 돌아가기</span>
        </button>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-[var(--nav-h)] text-center">
        <span
          aria-hidden="true"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100"
        >
          <SearchX className="h-8 w-8 text-neutral-500" />
        </span>
        <h1 className="mt-5 font-paperlogy text-xl font-bold text-[#333333]">
          페이지를 찾을 수 없어요
        </h1>
        <p className="mt-2 text-label leading-relaxed text-neutral-500 break-keep">
          주소가 잘못됐거나, 삭제된 페이지예요.
        </p>
      </main>
    </div>
  );
}
