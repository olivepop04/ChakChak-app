/**
 * 목록이 비었을 때 보여주는 화면.
 *
 * 모든 목록 화면에 반드시 넣으세요. "없습니다" 만 있으면 사용자가 막힙니다.
 * 다음에 할 행동(action)을 함께 주는 게 핵심입니다.
 *
 *   import { SearchX } from 'lucide-react';
 *
 *   <EmptyState
 *     icon={SearchX}
 *     title="아직 참여한 액션이 없어요"
 *     description="마음에 드는 액션을 찾아보세요."
 *     action={{ label: '액션 찾아보기', href: '/discover' }}
 *   />
 *
 * 2026-09-30 오버레이 통일안 — 아이콘은 **lucide 컴포넌트**를 넘깁니다(이모지 금지).
 * 회색 원 48px + 아이콘 24px 로, 프로필·알림·트렌드·내 액션 빈 화면과 같은 모양입니다.
 * 문자열(이모지)도 아직 받기는 하지만 다른 브랜치가 깨지지 않게 남긴 것뿐입니다 — 새로 쓰지 마세요.
 *
 * 버튼 색 — `action.variant`
 *   'secondary'(기본) 흰 판 + 회색 테두리 — 「액션 보러 가기」 처럼 돌아가는 버튼
 *   'primary'         초록 채움          — 「액션 만들기」 처럼 앞으로 나아가는 버튼
 */
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type EmptyActionVariant = 'primary' | 'secondary';

interface EmptyStateProps {
  icon?: LucideIcon | string;
  title: string;
  description?: string;
  action?: { label: string; href: string; variant?: EmptyActionVariant };
  actions?: Array<{
    label: string;
    href: string;
    variant?: EmptyActionVariant;
    className?: string;
  }>;
  children?: React.ReactNode;
  className?: string;
}

// 버튼 모양 — 모달 버튼과 같은 44px · 14px 600 · 모서리 12 (2026-09-30)
const ACTION_VARIANT: Record<EmptyActionVariant, string> = {
  primary: 'bg-brand text-white hover:bg-brand/90',
  secondary: 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50',
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  actions,
  children,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 px-6 py-16 text-center',
        className,
      )}
    >
      {Icon && (
        <span
          aria-hidden="true"
          className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100"
        >
          {typeof Icon === 'string' ? (
            <span className="text-2xl leading-none">{Icon}</span>
          ) : (
            <Icon className="h-6 w-6 text-neutral-500" />
          )}
        </span>
      )}
      <p className="text-body font-semibold text-neutral-800">{title}</p>
      {description && (
        <p className="text-label leading-relaxed text-neutral-500">
          {description}
        </p>
      )}
      {action && (
        <Link
          href={action.href}
          className={cn(
            'mt-3 inline-flex min-h-11 items-center rounded-xl px-4 py-3 text-sm font-semibold transition-colors',
            ACTION_VARIANT[action.variant ?? 'secondary'],
          )}
        >
          {action.label}
        </Link>
      )}
      {actions && actions.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
          {actions.map((act) => (
            <Link
              key={act.href + act.label}
              href={act.href}
              className={cn(
                'inline-flex min-h-11 w-32 items-center justify-center whitespace-nowrap rounded-xl py-3 text-sm font-semibold transition-colors',
                ACTION_VARIANT[act.variant ?? 'primary'],
                act.className,
              )}
            >
              {act.label}
            </Link>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}
