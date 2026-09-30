/**
 * 인풋. 화면마다 손으로 짜지 말고 이걸 쓰세요.
 *
 *   <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
 *
 * 높이 44px·모서리 12px·글자 15px (Day9 확정).
 * 위아래 여백은 8px — 12px 이면 글자 줄높이(22.5px)와 더해져 실제 49px 이 됐다 (2026-09-30 실측).
 * 높이를 못 박지 않고 min-h 로 두는 건 폰 글자 200% 에서 칸이 같이 커지게 하려는 것. 테두리는 평소 Hairline(#E0E0E0),
 * 포커스 시 진한색(#333333)으로 바뀝니다.
 */
import { forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'min-h-11 rounded-xl border border-hairline px-4 py-2 text-body outline-none transition-colors focus:border-hairline-focus',
          className,
        )}
        {...props}
      />
    );
  },
);
