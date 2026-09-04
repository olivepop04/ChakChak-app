import { LIMITS } from '../constants/index.ts';

export function getBioValidationError(
  value: string | null | undefined,
): string | null {
  if ((value ?? '').length > LIMITS.BIO_MAX) {
    return `자기소개는 ${LIMITS.BIO_MAX}자까지 입력할 수 있어요.`;
  }
  return null;
}
