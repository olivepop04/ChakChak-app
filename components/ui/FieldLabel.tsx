/**
 * 입력칸 라벨 (④ 층).
 *
 * "이메일" · "닉네임" · "결과 사진" 처럼 입력칸·업로더 위에 붙는 이름표입니다.
 * 12px · semibold · neutral-500 — 섹션 제목(15px·bold·neutral-900)과
 * 2px·굵기 한 단계 차이로는 같은 층처럼 읽혀서, 3px·색 2단계로 더 벌렸습니다
 * (app/my/_components/TimePreferenceEditor.tsx:80 에 있던 조합을 그대로 가져왔습니다).
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
    <span className={cn('text-[12px] font-semibold text-neutral-500', className)}>
      {children}
      {required && <span className="text-red-500"> *</span>}
    </span>
  );
}
