/**
 * 404 — 없는 주소 · 없거나 삭제된 액션(notFound() 10개 화면) · 없는 사람 프로필(5개 화면)이
 * 전부 이 한 화면으로 옵니다. 그래서 설명은 「액션」이 아니라 공통 문구입니다.
 *
 * 2026-09-30 Day19 통일안 (소정님 확정, B안):
 *   · 위: 「〈 이전으로 돌아가기」(PreviousPageBar — 오류 화면과 같이 씀)
 *   · 본문: 회색 원 + SearchX · 부제(17px 굵게 #333, 빈 상태·모달 제목과 같음) · 설명 13px. 본문 버튼 없음(홈은 하단 탭).
 */
import { SearchX } from 'lucide-react';
import { PreviousPageBar } from '@/components/layout/PreviousPageBar';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <PreviousPageBar />

      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-[var(--nav-h)] text-center">
        <span
          aria-hidden="true"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100"
        >
          <SearchX className="h-8 w-8 text-neutral-500" />
        </span>
        <h1 className="mt-5 text-subtitle font-bold text-charcoal">
          페이지를 찾을 수 없어요
        </h1>
        <p className="mt-2 text-label leading-relaxed text-neutral-500 break-keep">
          주소가 잘못됐거나, 삭제된 페이지예요.
        </p>
      </main>
    </div>
  );
}
