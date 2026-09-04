import test from 'node:test';
import assert from 'node:assert/strict';

import { emailExistsByPage } from '../lib/auth/email-availability.ts';
import { getBioValidationError } from '../lib/utils/profile-validation.ts';

test('자기소개는 300자까지 허용하고 301자부터 거절한다', () => {
  assert.equal(getBioValidationError('가'.repeat(300)), null);
  assert.equal(
    getBioValidationError('가'.repeat(301)),
    '자기소개는 300자까지 입력할 수 있어요.',
  );
});

test('이메일 중복 검사는 대소문자와 앞뒤 공백을 구분하지 않는다', async () => {
  const exists = await emailExistsByPage(
    '  MEMBER@EXAMPLE.COM ',
    async () => ({
      users: [{ email: 'member@example.com' }],
      hasMore: false,
    }),
  );

  assert.equal(exists, true);
});

test('첫 페이지에 없으면 다음 페이지까지 확인한다', async () => {
  const visited: number[] = [];
  const exists = await emailExistsByPage('second@example.com', async (page) => {
    visited.push(page);
    if (page === 1) {
      return {
        users: [{ email: 'first@example.com' }],
        hasMore: true,
      };
    }
    return {
      users: [{ email: 'second@example.com' }],
      hasMore: false,
    };
  });

  assert.equal(exists, true);
  assert.deepEqual(visited, [1, 2]);
});

test('모든 페이지를 확인해도 없으면 가입 가능한 이메일이다', async () => {
  const exists = await emailExistsByPage('new@example.com', async () => ({
    users: [{ email: 'member@example.com' }],
    hasMore: false,
  }));

  assert.equal(exists, false);
});
