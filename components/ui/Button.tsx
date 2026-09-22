/**
 * 버튼.
 *
 * 화면마다 <button className="..."> 을 직접 쓰지 말고 이걸 쓰세요.
 * 그래야 앱 전체의 버튼 모양이 같아집니다.
 *
 *   <Button onClick={...}>참여 확정하기</Button>
 *   <Button variant="secondary" size="sm">수정</Button>
 *   <Button variant="danger" disabled>삭제</Button>
 *   <Button loading>저장 중</Button>
 */
import { cn } from '@/lib/utils/cn';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  /** true 면 스피너를 보여주고 자동으로 비활성화됩니다 */
  loading?: boolean;
}

const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand/90 active:bg-brand/80',
  secondary:
    'border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50 active:bg-neutral-100',
  danger: 'border border-danger bg-danger-soft text-danger hover:bg-danger/10',
  ghost: 'text-neutral-600 hover:bg-neutral-100',
};

const SIZE: Record<Size, string> = {
  sm: 'min-h-9 px-3 py-2 text-[13px] rounded-xl gap-1.5',
  md: 'min-h-11 px-4 py-3 text-sm rounded-xl gap-2',
  lg: 'min-h-13 px-5 py-3 text-[15px] rounded-xl gap-2',
};

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  loading,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap font-semibold transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-40',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2',
        VARIANT[variant],
        SIZE[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading && (
        <span
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}
