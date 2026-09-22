/**
 * 모집 항목 저장 전 검사. 담당: 민호
 *
 * `saveActionItems()` 가 쓰던 검사를 그대로 떼어낸 것입니다 —
 * 값만 보고 판단하는 순수 함수라 DB 없이 테스트할 수 있습니다.
 * (`lib/mutations.ts` 는 `@/` 별칭으로 **값**을 가져와서 Node 테스트 러너가 import 하지 못합니다)
 *
 * ★ 이 파일에 `@/` **값** import 를 넣지 마세요 — 넣는 순간 테스트가 깨집니다.
 *   아래 `import type` 은 괜찮습니다. 타입만 가져와서 실행 시점에 지워지기 때문입니다.
 *
 * ★ 이 파일이 지키는 규칙 — CLAUDE.md 규칙 10
 *
 *   빈 배열은 「항목을 전부 지웠다」 는 뜻입니다. 거절하지 마세요.
 *   임시저장은 통과, 공개(requireAtLeastOne)만 거절합니다.
 *
 *   전에는 빈 배열을 무조건 거절했습니다. 그래서 임시저장 중에 항목을 X 로 다 지우면
 *   화면은 비었는데 DB 에는 그대로 남고, 그런데도 「저장했어요」 가 떴습니다.
 *   새로고침하거나 뒤로 갔다 오면 지운 항목이 되살아났습니다 (수정 NO10 3쪽).
 *
 *   `tests/action-items-save.test.ts` 가 이 분기를 지킵니다.
 */
import type { ActionItemInput } from '@/lib/mutations';

/**
 * 문제가 있으면 **사용자에게 그대로 보여줄 한국어 메시지**를, 없으면 `null` 을 돌려줍니다.
 *
 * @param opts.requireAtLeastOne 공개할 때만 `true`. 임시저장 경로에 넘기면
 *   위 주석의 버그가 그대로 되살아납니다.
 */
export function getActionItemsError(
  items: ActionItemInput[],
  opts?: { requireAtLeastOne?: boolean },
): string | null {
  if (items.length === 0 && opts?.requireAtLeastOne)
    return '모집 항목을 하나 이상 추가해주세요.';

  for (const it of items) {
    if (it.targetType === 'RANGE' && (it.maxAllowed ?? null) === null)
      return `「${it.name}」의 최대 인원을 입력해주세요.`;
    if (it.targetType === 'RANGE' && (it.maxAllowed as number) < it.minRequired)
      return `「${it.name}」의 최대 인원이 최소보다 작습니다.`;
  }

  return null;
}
