/**
 * 조건부 className 합치기.
 *
 * cn('a', cond && 'b', undefined) → 'a b'
 * 외부 라이브러리 없이 쓰기 위해 최소 기능만 구현했다.
 */
type ClassValue = string | number | null | undefined | false;

export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(' ');
}
