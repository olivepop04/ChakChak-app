/**
 * 인풋. 화면마다 손으로 짜지 말고 이걸 쓰세요.
 *
 *   <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
 *
 * 높이 44px·모서리 12px·글자 15px (Day9 확정). 테두리는 평소 Hairline(#E0E0E0),
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
          'min-h-11 rounded-xl border border-hairline px-4 py-3 text-body outline-none transition-colors focus:border-hairline-focus',
          className,
        )}
        {...props}
      />
    );
  },
);
