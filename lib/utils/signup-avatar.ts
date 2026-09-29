import { isAvatarKey } from './avatar.ts';

/** 가입 2단계에서만 쓰는 아바타 필수 선택 검사입니다. */
export function getSignupAvatarError(avatar: unknown): string | null {
  return isAvatarKey(avatar) ? null : '프로필 아바타를 선택해주세요.';
}
