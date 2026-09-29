/**
 * 아바타 8종 (2026-09-29, supabase/20).
 *
 * 가입 때 고른 값(profiles.avatar)을 그리고, 값이 없을 때만 이름으로 8종 중 하나를 고릅니다.
 * DB 가 받는 목록(is_avatar_key)과 화면 목록(AVATAR_KEYS)이 어긋나면 고른 아바타가
 * 저장은 안 되고 화면에는 나오거나, 그 반대가 됩니다 — 그래서 두 목록을 대조합니다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { AVATAR_KEYS } from '../lib/constants/index.ts';
import { avatarSrc, isAvatarKey } from '../lib/utils/avatar.ts';

test('DB 가 받는 목록과 화면 목록이 같다', () => {
  const sql = readFileSync(new URL('../supabase/20_update.sql', import.meta.url), 'utf8');
  const block = sql.match(/FUNCTION is_avatar_key[\s\S]*?ARRAY\[([\s\S]*?)\]/);
  assert.ok(block, 'supabase/20 에서 is_avatar_key 목록을 못 찾음');
  const keys = [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(keys, [...AVATAR_KEYS]);
});

test('8종 그림 파일이 모두 있다', () => {
  for (const key of AVATAR_KEYS) {
    assert.ok(existsSync(new URL(`../public/avatars/${key}.svg`, import.meta.url)), `${key}.svg 없음`);
  }
});

test('고른 아바타가 있으면 그 그림', () => {
  assert.equal(avatarSrc('avatar_03', '누구든'), '/avatars/avatar_03.svg');
});

test('없거나 목록 밖이면 이름으로 8종 중 하나 — 같은 이름은 늘 같은 그림', () => {
  for (const bad of [null, undefined, '', 'avatar_09', 'avatar_10', '../x']) {
    const src = avatarSrc(bad, '올리브');
    assert.match(src, /^\/avatars\/avatar_0[1-8]\.svg$/);
    assert.equal(src, avatarSrc(bad, '올리브'));
  }
  assert.equal(isAvatarKey('avatar_09'), false, '옛 10종의 9·10번은 이제 쓰지 않는다');
});
