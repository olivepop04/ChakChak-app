/**
 * 「〈 이전으로 돌아가기」 상단 줄 — 404 · 화면 오류 · 앱 전체 오류가 같이 씁니다 (2026-09-30 Day19).
 *
 * 공용 상단 바(Header)와 같은 모양(높이 56px · ChevronLeft 20px · 15px 굵게 #333)이지만,
 * Header 는 글자 자리가 「화면 이름」 이라 눌러도 아무 일이 없습니다. 이 줄은 〈 와 글자가
 * 한 덩어리 버튼이라 글자를 눌러도 뒤로 갑니다.
 *
 * 돌아갈 화면이 없으면(링크로 바로 열기) 홈으로 — Header 와 같은 동작입니다.
 */
'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

export function PreviousPageBar() {
  const router = useRouter();

  function handleBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  }

  return (
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
  );
}
