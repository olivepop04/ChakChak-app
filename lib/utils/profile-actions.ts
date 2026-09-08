const PROFILE_ACTION_PREVIEW_LIMIT = 2;

/** 조회 함수가 돌려준 최신순을 유지하면서 첫 화면에는 2개만 보여준다. */
export function selectProfileActionPreview<T>(
  actions: T[],
  expanded: boolean,
): T[] {
  return expanded ? actions : actions.slice(0, PROFILE_ACTION_PREVIEW_LIMIT);
}

/** 참여 액션은 실제 활동일이 최근인 것이 위에 오도록 정렬한다. */
export function sortProfileActionsByLatestActivity<
  T extends { activityStartAt: string | null },
>(actions: T[]): T[] {
  return [...actions].sort((left, right) => {
    const leftTime = left.activityStartAt
      ? Date.parse(left.activityStartAt)
      : Number.NEGATIVE_INFINITY;
    const rightTime = right.activityStartAt
      ? Date.parse(right.activityStartAt)
      : Number.NEGATIVE_INFINITY;
    return rightTime - leftTime;
  });
}
