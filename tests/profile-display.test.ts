import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildProfileStats,
  getFollowerCountAfterToggle,
  shouldShowFollowEmptyHint,
} from '../lib/utils/profile-display.ts';

// 「참여 완료 액션」 입니다 — 「참여한 액션」 이 아닙니다 (2026-09-11 회의).
// 이 숫자는 소감까지 쓴 것만 세는데 Activity 탭의 「참여한 액션」 은 참여 예정까지
// 전부 보여줍니다. 두 곳이 같은 이름이라 "목록엔 1개인데 숫자는 0" 으로 보였습니다.
test('프로필 통계는 호스트한 액션을 맨 앞에 두고 참여는 「참여 완료 액션」 으로 표시한다', () => {
  const stats = buildProfileStats({
    ledCount: 4,
    participatedCount: 7,
    followerCount: 2,
    followingCount: 3,
    ledHref: '/activity',
    participatedHref: '/activity?tab=joined',
    followersHref: '/followers',
    followingHref: '/following',
  });

  assert.deepEqual(
    stats.map(({ label, value, href }) => ({ label, value, href })),
    [
      { label: '호스트한 액션', value: 4, href: '/activity' },
      { label: '참여 완료 액션', value: 7, href: '/activity?tab=joined' },
      { label: '팔로워', value: 2, href: '/followers' },
      { label: '팔로잉', value: 3, href: '/following' },
    ],
  );
});

test('팔로우 성공과 실패 복구 콜백에 맞춰 팔로워 숫자를 더하고 뺀다', () => {
  assert.equal(getFollowerCountAfterToggle(8, true), 9);
  assert.equal(getFollowerCountAfterToggle(9, false), 8);
  assert.equal(getFollowerCountAfterToggle(0, false), 0);
});

test('팔로워·팔로잉 빈 화면의 이용 안내는 본인 프로필에서만 보여준다', () => {
  assert.equal(shouldShowFollowEmptyHint('viewer-1', 'viewer-1'), true);
  assert.equal(shouldShowFollowEmptyHint('viewer-1', 'other-user'), false);
  assert.equal(shouldShowFollowEmptyHint(null, 'other-user'), false);
});
