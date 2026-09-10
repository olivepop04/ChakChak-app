import test from 'node:test';
import assert from 'node:assert/strict';

import {
  selectProfileActionPreview,
  sortProfileActionsByLatestActivity,
} from '../lib/utils/profile-actions.ts';

test('프로필 액션은 처음에는 조회 결과의 최신 2개만 보여준다', () => {
  const actions = [{ id: 'latest' }, { id: 'second' }, { id: 'older' }];

  assert.deepEqual(
    selectProfileActionPreview(actions).map((action) => action.id),
    ['latest', 'second'],
  );
});

test('프로필 미리보기는 더보기 상태와 관계없이 최신 2개만 보여준다', () => {
  const actions = [{ id: 'latest' }, { id: 'second' }, { id: 'older' }];

  assert.deepEqual(
    selectProfileActionPreview(actions).map((action) => action.id),
    ['latest', 'second'],
  );
});

test('참여한 액션은 활동 시작일이 최근인 순서로 정렬한다', () => {
  const actions = [
    { id: 'older', activityStartAt: '2026-08-01T09:00:00+09:00' },
    { id: 'no-date', activityStartAt: null },
    { id: 'latest', activityStartAt: '2026-09-01T09:00:00+09:00' },
  ];

  assert.deepEqual(
    sortProfileActionsByLatestActivity(actions).map((action) => action.id),
    ['latest', 'older', 'no-date'],
  );
});
