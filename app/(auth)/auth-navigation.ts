/**
 * 로그인·가입 뒤 돌아갈 주소 — 우리 사이트 안의 경로만 받습니다.
 *
 * 역슬래시·제어문자도 막습니다 (2026-09-30 배포 전 검수). 브라우저는 `/\evil.example` 이나
 * `/<탭>/evil.example` 을 `//evil.example` 처럼 읽어서, 앞 두 검사만으로는 다른 사이트로 넘어갔습니다.
 */
export function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f]/.test(value)) {
    return '/';
  }
  return value;
}

export function withNext(path: string, next: string): string {
  return next === '/' ? path : `${path}?next=${encodeURIComponent(next)}`;
}

/** 환영 화면에서 다시 열 수 있는 실제 액션 경로만 반환합니다. */
export function getSignupWelcomeReturnPath(value: string | null): string | null {
  const next = safeNextPath(value);

  if (!/^\/action\/(?!create(?:[/?#]|$))[^/?#]+(?:[/?#].*)?$/.test(next)) {
    return null;
  }

  return next;
}

/** 가입을 마친 뒤 환영 화면을 먼저 보여주고, 실제 액션 경로만 선택적으로 보존합니다. */
export function getSignupCompletionPath(next: string): string {
  const returnPath = getSignupWelcomeReturnPath(next);
  return returnPath ? withNext('/signup/welcome', returnPath) : '/signup/welcome';
}
