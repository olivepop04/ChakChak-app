import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getSignupCompletionPath,
  getSignupWelcomeReturnPath,
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

test('회원가입을 마치면 환영 화면에서 방금 보던 액션으로 돌아갈 수 있다', () => {
  assert.equal(
    getSignupCompletionPath('/action/abc/join'),
    '/signup/welcome?next=%2Faction%2Fabc%2Fjoin',
  );
});

test('실제 액션 경로에서 가입한 경우에만 복귀 경로를 제공한다', () => {
  assert.equal(
    getSignupWelcomeReturnPath('/action/abc/join'),
    '/action/abc/join',
  );
  assert.equal(getSignupWelcomeReturnPath('/action/abc'), '/action/abc');
  assert.equal(getSignupWelcomeReturnPath('/action/create'), null);
  assert.equal(getSignupWelcomeReturnPath('/my'), null);
  assert.equal(getSignupWelcomeReturnPath('//evil.example/action/abc'), null);
  assert.equal(getSignupWelcomeReturnPath('https://evil.example/action/abc'), null);
  assert.equal(getSignupWelcomeReturnPath(null), null);
});

test('복귀할 실제 액션이 없으면 기존 환영 화면 주소를 유지한다', () => {
  assert.equal(getSignupCompletionPath('/'), '/signup/welcome');
  assert.equal(getSignupCompletionPath('/action/create'), '/signup/welcome');
  assert.equal(getSignupCompletionPath('/my'), '/signup/welcome');
});
