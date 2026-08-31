/**
 * 목록이 비었을 때 보여주는 화면.
 *
 * 모든 목록 화면에 반드시 넣으세요. "없습니다" 만 있으면 사용자가 막힙니다.
 * 다음에 할 행동(action)을 함께 주는 게 핵심입니다.
 *
 *   <EmptyState
 *     icon="🔍"
 *     title="아직 참여한 액션이 없어요"
 *     description="마음에 드는 액션을 찾아보세요."
 *     action={{ label: '액션 찾아보기', href: '/discover' }}
 *   />
 */
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; href: string };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 px-6 py-16 text-center',
        className,
      )}
    >
      {icon && (
        <span className="mb-1 text-3xl" aria-hidden="true">
          {icon}
        </span>
      )}
      <p className="text-[15px] font-semibold text-neutral-800">{title}</p>
      {description && (
        <p className="text-[13px] leading-relaxed text-neutral-500">
          {description}
        </p>
      )}
      {action && (
        <Link
          href={action.href}
          className="mt-3 inline-flex h-10 items-center rounded-xl bg-neutral-900 px-4 text-[13px] font-semibold text-white"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
