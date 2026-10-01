/**
 * 로그인 실패 문구 고르기.
 *
 * 전에는 어떤 실패든 「이메일 또는 비밀번호가 맞지 않아요」 였습니다.
 * 인터넷이 끊겼을 때도 그렇게 나와서, 비밀번호를 다시 치게 만들었습니다 (2026-10-01).
 *
 * supabase-js 가 주는 오류를 보고 가릅니다 (@supabase/auth-js 의 fetch.js 기준).
 *
 *   AuthRetryableFetchError · status 0   요청이 서버까지 못 감 (오프라인·DNS·CORS)
 *   AuthRetryableFetchError · 5xx·52x    서버가 응답을 못 줌
 *   AuthApiError · 429                   너무 자주 시도함
 *   그 밖(400 등)                        자격 증명이 맞지 않음
 *
 * ★ 계정이 있는지 없는지는 끝까지 흘리지 않습니다. 400 계열은 전부 같은 문구입니다.
 */
export interface LoginErrorLike {
  name?: string;
  status?: number;
}

export const LOGIN_ERROR_CREDENTIALS = '이메일 또는 비밀번호가 맞지 않아요.';
export const LOGIN_ERROR_NETWORK =
  '지금 서버에 연결하지 못했어요. 인터넷 상태를 확인하고 다시 시도해주세요.';
export const LOGIN_ERROR_TOO_MANY =
  '로그인 시도가 너무 많아요. 잠시 후 다시 시도해주세요.';

export function getLoginErrorMessage(
  error: LoginErrorLike | null | undefined,
): string {
  if (!error) return '';

  const status = error.status ?? 0;
  if (error.name === 'AuthRetryableFetchError' || status === 0 || status >= 500) {
    return LOGIN_ERROR_NETWORK;
  }
  if (status === 429) return LOGIN_ERROR_TOO_MANY;
  return LOGIN_ERROR_CREDENTIALS;
}
