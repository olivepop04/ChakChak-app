import test from 'node:test';
import assert from 'node:assert/strict';
import { getLoginNotice } from '../lib/utils/auth-notice.ts';

test('타인 프로필에서 막히면 프로필 문구를 보여준다 (2026-09-11 회의)', () => {
  assert.equal(
    getLoginNotice('/user/3559be67-11d4-5a8a-94f2-5bc462458cd0'),
    '프로필 확인은 로그인 후 가능합니다.',
  );
  assert.equal(
    getLoginNotice('/user/3559be67-11d4-5a8a-94f2-5bc462458cd0/created'),
    '프로필 확인은 로그인 후 가능합니다.',
  );
});

test('그냥 로그인 화면을 눌러 온 경우에는 아무것도 띄우지 않는다', () => {
  assert.equal(getLoginNotice('/'), null);
});

test('보호되지 않는 화면이 next 로 들어와도 억지 문구를 만들지 않는다', () => {
  // 액션 상세와 결과 보기는 비회원도 볼 수 있는 화면입니다.
  assert.equal(getLoginNotice('/action/abc'), null);
  assert.equal(getLoginNotice('/action/abc/result'), null);
  assert.equal(getLoginNotice('/discover'), null);
  assert.equal(getLoginNotice('/trends'), null);
});

test('보호 화면마다 자기 문구가 나온다', () => {
  assert.equal(getLoginNotice('/my'), '내 프로필은 로그인 후 볼 수 있어요.');
  assert.equal(getLoginNotice('/my/saved'), '내 프로필은 로그인 후 볼 수 있어요.');
  assert.equal(getLoginNotice('/activity'), '내 활동은 로그인 후 볼 수 있어요.');
  assert.equal(getLoginNotice('/notifications'), '알림은 로그인 후 볼 수 있어요.');
});

test('액션 만들기는 액션 하위 규칙보다 먼저 걸린다', () => {
  // 목록 순서가 뒤집히면 '/action/create' 가 액션 하위 문구로 잡힙니다.
  assert.equal(
    getLoginNotice('/action/create'),
    '액션 만들기는 로그인 후 이용할 수 있어요.',
  );
});

test('액션 하위 보호 화면은 한 문구로 묶는다', () => {
  for (const path of [
    '/action/abc/join',
    '/action/abc/welcome',
    '/action/abc/chat',
    '/action/abc/crew',
    '/action/abc/result/write',
    '/action/abc/voice',
    '/action/abc/share',
    '/action/abc/edit',
  ]) {
    assert.equal(
      getLoginNotice(path),
      '이 화면은 로그인 후 이용할 수 있어요.',
      path,
    );
  }
});

test("'/my' 가 '/mypage' 까지 잡지 않는다", () => {
  assert.equal(getLoginNotice('/mypage'), null);
  assert.equal(getLoginNotice('/users'), null);
});

test('next 에 쿼리가 붙어도 경로로 판단한다 — middleware 가 ?… 까지 담아 보냄 (2026-09-30)', () => {
  assert.equal(getLoginNotice('/activity?tab=created'), '내 활동은 로그인 후 볼 수 있어요.');
  assert.equal(getLoginNotice('/action/create?id=abc'), '액션 만들기는 로그인 후 이용할 수 있어요.');
  assert.notEqual(getLoginNotice('/action/abc/join?item=1'), null);
});
