/**
 * 선택 칩. 관심 카테고리·참여 가능 시간처럼 여러 개를 고를 때 씁니다.
 *
 *   <ChipGroup
 *     options={CATEGORIES}
 *     selected={form.categories}
 *     onToggle={(v) => toggle(v)}
 *   />
 */
'use client';

import { cn } from '@/lib/utils/cn';

export function Chip({
  selected,
  onClick,
  children,
  className,
  as: Component = 'button',
}: {
  selected?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  as?: 'button' | 'span';
}) {
  return (
    <Component
      type={Component === 'button' ? 'button' : undefined}
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors',
        selected
          ? 'border-neutral-900 bg-neutral-900 text-white'
          : 'border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50',
        className,
      )}
    >
      {children}
    </Component>
  );
}

export function ChipGroup<T extends string>({
  options,
  selected,
  onToggle,
  className,
}: {
  options: readonly T[];
  selected: readonly T[];
  onToggle: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {options.map((o) => (
        <Chip key={o} selected={selected.includes(o)} onClick={() => onToggle(o)}>
          {o}
        </Chip>
      ))}
    </div>
  );
}

/** 배열에서 값을 넣거나 빼는 도우미. 칩과 함께 자주 씁니다. */
export function toggleInArray<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}
