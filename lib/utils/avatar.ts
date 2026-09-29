/**
 * 아바타 그림 경로 (2026-09-29).
 *
 * 고른 아바타(profiles.avatar)가 있으면 그 그림을, 없으면 이름으로 8종 중 하나를 고릅니다.
 * 「없는」 경우는 탈퇴해서 「알 수 없음」 으로 나오는 사람처럼 프로필을 못 읽은 때뿐입니다 —
 * DB 는 가입할 때 반드시 채웁니다 (supabase/20).
 *
 * 테스트가 import 할 수 있게 값은 상대 경로로 가져옵니다 (tests/avatar.test.ts).
 */
import { AVATAR_KEYS } from '../constants/index.ts';

export function isAvatarKey(value: unknown): value is (typeof AVATAR_KEYS)[number] {
  return typeof value === 'string' && (AVATAR_KEYS as readonly string[]).includes(value);
}

/** 같은 이름이면 항상 같은 그림이 나오도록 */
function hashIndex(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % AVATAR_KEYS.length;
}

export function avatarSrc(avatar: string | null | undefined, fallbackName: string): string {
  const key = isAvatarKey(avatar) ? avatar : AVATAR_KEYS[hashIndex(fallbackName)];
  return `/avatars/${key}.svg`;
}
