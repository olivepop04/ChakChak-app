export function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

export function withNext(path: string, next: string): string {
  return next === '/' ? path : `${path}?next=${encodeURIComponent(next)}`;
}

/** 가입을 마친 뒤에는 이전 화면으로 바로 보내지 않고 시작 선택지를 보여줍니다. */
export function getSignupCompletionPath(_next: string): string {
  return '/signup/welcome';
}
