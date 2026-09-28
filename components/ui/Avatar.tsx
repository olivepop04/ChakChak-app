/**
 * 표정 아바타.
 *
 * 팀 합의(2026-08-31): 프로필 사진 업로드는 하지 않는다.
 * 저장 용량과 관리 부담 때문이며, 대신 닉네임을 해시해서
 * 사람마다 다른 표정을 준다. The Crew·팔로잉 목록처럼
 * 아바타가 여러 개 늘어선 화면에서 서로 구분된다.
 *
 * 2026-09-27: 이니셜 + 10색 → 회색 픽셀 표정 이미지 10종(public/avatars/)으로 교체.
 *   타입페이스 표정 모티프(Day6 결정)를 아바타에 적용한 최종안.
 *   배경 원(#E0E0E0)이 이미지 안에 들어 있어서 여기서는 배경색을 주지 않는다.
 */
import { cn } from '@/lib/utils/cn';

const AVATARS = [
  '/avatars/avatar_01.svg',
  '/avatars/avatar_02.svg',
  '/avatars/avatar_03.svg',
  '/avatars/avatar_04.svg',
  '/avatars/avatar_05.svg',
  '/avatars/avatar_06.svg',
  '/avatars/avatar_07.svg',
  '/avatars/avatar_08.svg',
  '/avatars/avatar_09.svg',
  '/avatars/avatar_10.svg',
] as const;

const SIZES = {
  xs: 'h-5 w-5',
  sm: 'h-8 w-8',
  md: 'h-11 w-11',
  lg: 'h-16 w-16',
  xl: 'h-24 w-24',
} as const;

/** 같은 닉네임이면 항상 같은 표정이 나오도록 */
function hashIndex(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % AVATARS.length;
}

interface AvatarProps {
  /** 표시 기준이 되는 이름. 보통 닉네임을 넘긴다. */
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}

export function Avatar({ name, size = 'md', className }: AvatarProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 select-none overflow-hidden rounded-full',
        SIZES[size],
        className,
      )}
      aria-hidden="true"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={AVATARS[hashIndex(name)]}
        alt=""
        draggable={false}
        className="h-full w-full"
      />
    </span>
  );
}
