import test from 'node:test';
import assert from 'node:assert/strict';

import {
  safeNextPath,
  withNext,
} from '../app/(auth)/auth-navigation.ts';

test('가입 후 돌아갈 내부 경로는 유지한다', () => {
  assert.equal(safeNextPath('/action/abc/join'), '/action/abc/join');
});

test('외부 주소와 이중 슬래시는 홈으로 막는다', () => {
  assert.equal(safeNextPath('https://evil.example'), '/');
  assert.equal(safeNextPath('//evil.example/path'), '/');
  assert.equal(safeNextPath(null), '/');
});

test('로그인과 가입 사이에서 돌아갈 경로를 보존한다', () => {
  assert.equal(
    withNext('/signup', '/action/abc/join'),
    '/signup?next=%2Faction%2Fabc%2Fjoin',
  );
  assert.equal(withNext('/signup', '/'), '/signup');
});
