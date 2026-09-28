/**
 * 입력칸 라벨 (④ 층).
 *
 * "이메일" · "닉네임" · "결과 사진" 처럼 입력칸·업로더 위에 붙는 이름표입니다.
 * 13px(label) · semibold · neutral-500 — 섹션 제목(15px·bold·neutral-900)과
 * 굵기·색 2단계 차이로 구분합니다 (2026-09-23, 확정 타입 스케일에 맞춰 12px→13px 조정).
 *
 *   <FieldLabel>닉네임</FieldLabel>
 *   <FieldLabel required>결과 사진</FieldLabel>
 *   <FieldLabel>
 *     자기소개 <span className="font-normal text-neutral-400">(선택)</span>
 *   </FieldLabel>
 */
import { cn } from '@/lib/utils/cn';

export function FieldLabel({
  children,
  required,
  className,
}: {
  children: React.ReactNode;
  /** true 면 이름표 뒤에 빨간 * 를 붙입니다. 화면마다 손으로 붙이지 마세요. */
  required?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('text-label font-semibold text-neutral-500', className)}>
      {children}
      {required && <span className="text-red-500"> *</span>}
    </span>
  );
}
