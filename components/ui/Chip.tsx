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
  /**
   * 기본값 'default' — 기존 모습(선택 시 검정) 그대로. 다른 화면(관심 카테고리·시간대 선택 등)이
   * 이 값을 쓰고 있어서 손대지 않음.
   * 'accent' / 'neutral' 은 2026-09-21 홈피드 개편에서 새로 추가한 옵션 —
   * 명시적으로 지정한 곳(app/page.tsx 의 홈 필터)에만 적용되고 다른 화면엔 영향 없음.
   */
  tone = 'default',
  /**
   * 기본값 'md' — 필터 칩 크기(13px), 기존 그대로.
   * 'sm'은 Day10 확정값(카드용 11px, 타입스케일 "캡션") — 카드 카테고리 칩 전용(2026-09-22).
   */
  size = 'md',
}: {
  selected?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  as?: 'button' | 'span';
  tone?: 'default' | 'accent' | 'neutral';
  size?: 'md' | 'sm';
}) {
  return (
    <Component
      type={Component === 'button' ? 'button' : undefined}
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-full border transition-colors',
        size === 'sm'
          ? 'h-[24px] px-2.5 text-caption font-medium'
          : tone === 'neutral'
            ? 'gap-1 border-transparent px-3.5 py-2 text-label'
            : 'px-3.5 py-2 text-label font-medium',
        tone === 'default' &&
        (selected
          ? 'border-neutral-900 bg-neutral-900 text-white'
          : 'border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50'),
        tone === 'accent' &&
        (selected
          ? 'border-transparent bg-brand text-white'
          : 'border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50'),
        // 세그먼트 컨트롤(정렬 필터) — 바깥 컨테이너가 #F5F5F7 배경을 이미 깔고 있어서
        // 선택 안 된 세그먼트는 투명, 선택된 세그먼트만 흰 배경으로 떠 보이게 한다.
        tone === 'neutral' &&
        'flex-1 justify-center',
        tone === 'neutral' &&
        (selected
          ? 'bg-white font-bold text-brand shadow-sm'
          : 'bg-transparent font-medium text-neutral-500 hover:text-neutral-700'),
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
