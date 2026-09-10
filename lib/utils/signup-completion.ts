type ProfileSaveResult =
  | { ok: true; data: unknown }
  | { ok: false; message: string };

/** 가입 마지막 단계에서 취향 저장 실패를 숨기지 않고 화면에 전달합니다. */
export function getSignupProfileSaveError(
  result: ProfileSaveResult,
): string | null {
  return result.ok ? null : result.message;
}
