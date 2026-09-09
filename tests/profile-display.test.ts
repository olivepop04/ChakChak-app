import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildProfileStats,
  getFollowerCountAfterToggle,
  shouldShowFollowEmptyHint,
} from '../lib/utils/profile-display.ts';

test('프로필 통계는 호스트한 액션을 맨 앞에 두고 참여 문구를 완성형으로 표시한다', () => {
  const stats = buildProfileStats({
    ledCount: 4,
    participatedCount: 7,
    followerCount: 2,
    followingCount: 3,
    ledHref: '/activity?tab=created',
    participatedHref: '/activity',
    followersHref: '/followers',
    followingHref: '/following',
  });

  assert.deepEqual(
    stats.map(({ label, value, href }) => ({ label, value, href })),
    [
      { label: '호스트한 액션', value: 4, href: '/activity?tab=created' },
      { label: '참여한 액션', value: 7, href: '/activity' },
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
