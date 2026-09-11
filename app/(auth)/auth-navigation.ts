export function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
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
