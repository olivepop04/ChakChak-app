/**
 * 문의·건의하기 — 종류와 글자 수 규칙.
 *
 * DB 함수 submit_feedback() (supabase/22) 와 같은 기준입니다. 숫자를 바꾸면 둘 다 고치세요.
 * 화면에서 먼저 막아 안내를 빨리 보여주고, DB 가 한 번 더 막습니다.
 *
 * 런타임에 `@/` 를 타지 않아 Node 테스트 러너가 그대로 읽습니다 (tests/feedback.test.ts).
 */

export const FEEDBACK_CATEGORIES = ['INQUIRY', 'SUGGESTION', 'BUG'] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_CATEGORY_LABEL: Record<FeedbackCategory, string> = {
  INQUIRY: '문의',
  SUGGESTION: '건의',
  BUG: '오류 신고',
};

export const FEEDBACK_BODY_MIN = 5;
export const FEEDBACK_BODY_MAX = 2000;

export function isFeedbackCategory(value: unknown): value is FeedbackCategory {
  return (
    typeof value === 'string' &&
    (FEEDBACK_CATEGORIES as readonly string[]).includes(value)
  );
}

/** 보내기 전 검사. 문제가 없으면 null */
export function getFeedbackValidationError(
  category: string | null,
  body: string,
): string | null {
  if (!isFeedbackCategory(category)) return '문의 종류를 골라주세요.';
  const length = body.trim().length;
  if (length < FEEDBACK_BODY_MIN) return `내용을 ${FEEDBACK_BODY_MIN}자 이상 적어주세요.`;
  if (length > FEEDBACK_BODY_MAX) return `내용은 ${FEEDBACK_BODY_MAX}자까지 적을 수 있어요.`;
  return null;
}
