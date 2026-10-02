import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getLoginErrorMessage,
  LOGIN_ERROR_CREDENTIALS,
  LOGIN_ERROR_NETWORK,
  LOGIN_ERROR_TOO_MANY,
} from '../app/(auth)/login-error.ts';

test('인터넷이 끊기면 비밀번호 탓으로 말하지 않는다', () => {
  // supabase-js 는 요청이 서버까지 못 가면 status 0 으로 돌려줍니다
  assert.equal(
    getLoginErrorMessage({ name: 'AuthRetryableFetchError', status: 0 }),
    LOGIN_ERROR_NETWORK,
  );
});

test('서버 오류(5xx·52x)도 연결 문제로 본다', () => {
  for (const status of [500, 503, 504, 520, 530]) {
    assert.equal(
      getLoginErrorMessage({ name: 'AuthRetryableFetchError', status }),
      LOGIN_ERROR_NETWORK,
      `status ${status}`,
    );
  }
});

test('시도가 너무 많으면 따로 안내한다', () => {
  assert.equal(
    getLoginErrorMessage({ name: 'AuthApiError', status: 429 }),
    LOGIN_ERROR_TOO_MANY,
  );
});

test('비밀번호가 틀리면 종전 문구 그대로', () => {
  assert.equal(
    getLoginErrorMessage({ name: 'AuthApiError', status: 400 }),
    LOGIN_ERROR_CREDENTIALS,
  );
});

test('계정이 있는지 없는지는 문구로 흘리지 않는다', () => {
  // 400 계열은 사유가 무엇이든 같은 문구여야 합니다
  const messages = [400, 401, 403, 422].map((status) =>
    getLoginErrorMessage({ name: 'AuthApiError', status }),
  );
  assert.deepEqual(new Set(messages), new Set([LOGIN_ERROR_CREDENTIALS]));
});

test('오류가 없으면 빈 문자열', () => {
  assert.equal(getLoginErrorMessage(null), '');
  assert.equal(getLoginErrorMessage(undefined), '');
});
