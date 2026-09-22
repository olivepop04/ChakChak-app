/**
 * 섹션 제목 (h2 층).
 *
 * "모집 현황" · "활동 일정" · "함께하는 크루" 처럼 한 화면 안에서
 * 내용을 큼직하게 나누는 제목에 씁니다. 15px · bold · neutral-900 —
 * 이 값이 기준점입니다. 화면 주제목(17px)보다 작고, 입력칸 라벨(12px)보다 큽니다.
 *
 *   <SectionTitle>모집 현황</SectionTitle>
 *   <SectionTitle className="pb-3">호스트한 액션</SectionTitle>
 *
 * ⚠️ 액션 상세(app/action/[id]/page.tsx)의 맨 아래 큰 CTA 버튼은
 *    우연히 똑같은 text-[15px] font-bold 를 쓰지만 이 컴포넌트 대상이
 *    아닙니다 — 버튼이지 섹션 제목이 아닙니다. 건드리지 마세요.
 */
import { cn } from '@/lib/utils/cn';

export function SectionTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2 className={cn('text-body font-bold text-neutral-900', className)}>
      {children}
    </h2>
  );
}
