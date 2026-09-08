/**
 * 이니셜 아바타.
 *
 * 팀 합의(2026-08-31): 프로필 사진 업로드는 하지 않는다.
 * 저장 용량과 관리 부담 때문이며, 대신 닉네임을 해시해서
 * 사람마다 배경색을 다르게 준다. The Crew·팔로잉 목록처럼
 * 아바타가 여러 개 늘어선 화면에서 서로 구분된다.
 */
import { cn } from '@/lib/utils/cn';

const PALETTE = [
  'bg-rose-100 text-rose-700',
  'bg-orange-100 text-orange-700',
  'bg-amber-100 text-amber-700',
  'bg-lime-100 text-lime-700',
  'bg-emerald-100 text-emerald-700',
  'bg-teal-100 text-teal-700',
  'bg-sky-100 text-sky-700',
  'bg-indigo-100 text-indigo-700',
  'bg-violet-100 text-violet-700',
  'bg-fuchsia-100 text-fuchsia-700',
] as const;

const SIZES = {
  xs: 'h-5 w-5 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-16 w-16 text-xl',
  xl: 'h-24 w-24 text-3xl',
} as const;

/** 같은 닉네임이면 항상 같은 색이 나오도록 */
function hashIndex(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % PALETTE.length;
}

/** 한글은 첫 글자, 영문은 최대 두 글자 */
function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';

  const isHangul = /[가-힣]/.test(trimmed[0]);
  if (isHangul) return trimmed[0];

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

interface AvatarProps {
  /** 표시 기준이 되는 이름. 보통 닉네임을 넘긴다. */
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}

export function Avatar({ name, size = 'md', className }: AvatarProps) {
  const color = PALETTE[hashIndex(name)];

  return (
    <span
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold',
        SIZES[size],
        color,
        className,
      )}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
