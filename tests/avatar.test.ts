/**
 * 아바타 8종 (2026-09-29, supabase/20).
 *
 * 가입 때 고른 값(profiles.avatar)을 그리고, 값이 없을 때만 이름으로 8종 중 하나를 고릅니다.
 * DB 가 받는 목록(is_avatar_key)과 화면 목록(AVATAR_KEYS)이 어긋나면 고른 아바타가
 * 저장은 안 되고 화면에는 나오거나, 그 반대가 됩니다 — 그래서 두 목록을 대조합니다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { AVATAR_KEYS } from '../lib/constants/index.ts';
import { avatarSrc, isAvatarKey } from '../lib/utils/avatar.ts';

const root = new URL('../', import.meta.url);

/** supabase/ 의 번호 파일을 순서대로 읽어, 어떤 함수를 **마지막으로** 정의한 파일의 본문을 돌려준다 */
function lastDefinition(fn: string): string {
  const files = readdirSync(new URL('supabase/', root))
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort();
  let found = '';
  for (const f of files) {
    const sql = readFileSync(new URL(`supabase/${f}`, root), 'utf8');
    const m = sql.match(new RegExp(`FUNCTION ${fn}\\([\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$`));
    if (m) found = m[1];
  }
  assert.ok(found, `supabase/ 에서 ${fn} 를 못 찾음`);
  return found;
}

test('DB 가 받는 목록(마지막 정의)과 화면 목록이 같다', () => {
  const keys = [...lastDefinition('is_avatar_key').matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(keys, [...AVATAR_KEYS]);
});

test('DB 기본값이 목록 길이만큼만 고른다 — 넘치면 가입이 CHECK 에 걸림', () => {
  const m = lastDefinition('default_avatar').match(/%\s*(\d+)/);
  assert.ok(m, 'default_avatar 에서 % N 을 못 찾음');
  assert.equal(Number(m[1]), AVATAR_KEYS.length);
});

test('8종 그림 파일이 모두 있다', () => {
  for (const key of AVATAR_KEYS) {
    assert.ok(existsSync(new URL(`public/avatars/${key}.svg`, root)), `${key}.svg 없음`);
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

test('화면의 모든 <Avatar> 가 고른 아바타를 넘긴다 (CLAUDE.md 규칙 18)', () => {
  const missing: string[] = [];
  for (const dir of ['app', 'components']) {
    for (const rel of readdirSync(new URL(`${dir}/`, root), { recursive: true }) as string[]) {
      if (!/\.tsx$/.test(rel)) continue;
      const path = `${dir}/${rel.replace(/\\/g, '/')}`;
      if (path === 'components/ui/Avatar.tsx') continue;
      const src = readFileSync(new URL(path, root), 'utf8');
      for (const tag of src.matchAll(/<Avatar\b[\s\S]*?\/>/g)) {
        if (!/\bavatar=/.test(tag[0])) missing.push(`${path}: ${tag[0].replace(/\s+/g, ' ').slice(0, 60)}`);
      }
    }
  }
  assert.deepEqual(missing, [], '닉네임만 넘기면 고른 것과 다른 얼굴이 나옵니다 — avatar={…avatar} 를 같이 넘기세요');
});
