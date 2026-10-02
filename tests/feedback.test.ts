import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  FEEDBACK_BODY_MAX,
  FEEDBACK_BODY_MIN,
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_LABEL,
  getFeedbackValidationError,
  isFeedbackCategory,
} from '../lib/utils/feedback.ts';

const SQL = readFileSync(new URL('../supabase/22_update.sql', import.meta.url), 'utf8');

/** 주석을 지운 SQL — 주석 속 예시 문장에 속지 않게 */
const CODE = SQL.replace(/--.*$/gm, '');

// ── 화면 검사 ────────────────────────────────────────────────

test('종류를 고르지 않으면 막는다', () => {
  assert.equal(getFeedbackValidationError(null, '충분히 긴 내용입니다'), '문의 종류를 골라주세요.');
  assert.equal(getFeedbackValidationError('OTHER', '충분히 긴 내용입니다'), '문의 종류를 골라주세요.');
});

test('내용은 앞뒤 공백을 빼고 5자 이상 2000자 이하', () => {
  assert.match(getFeedbackValidationError('INQUIRY', '    짧음    ') ?? '', /5자 이상/);
  assert.equal(getFeedbackValidationError('INQUIRY', '다섯글자요'), null);
  assert.equal(getFeedbackValidationError('BUG', 'a'.repeat(FEEDBACK_BODY_MAX)), null);
  assert.match(
    getFeedbackValidationError('BUG', 'a'.repeat(FEEDBACK_BODY_MAX + 1)) ?? '',
    /2000자까지/,
  );
});

test('종류마다 화면 이름이 있다', () => {
  for (const c of FEEDBACK_CATEGORIES) {
    assert.ok(isFeedbackCategory(c));
    assert.ok(FEEDBACK_CATEGORY_LABEL[c], `${c} 의 이름이 없습니다`);
  }
});

// ── 화면과 DB 가 같은 기준인지 ───────────────────────────────

test('DB 의 종류 목록이 화면과 같다', () => {
  for (const c of FEEDBACK_CATEGORIES) {
    assert.ok(CODE.includes(`'${c}'`), `22_update.sql 에 '${c}' 가 없습니다`);
  }
  // CHECK 제약과 submit_feedback 검사, 두 곳 모두 같은 목록이어야 합니다
  const lists = CODE.match(/IN \('[A-Z_]+'(?:, '[A-Z_]+')*\)/g) ?? [];
  const expected = `IN (${FEEDBACK_CATEGORIES.map((c) => `'${c}'`).join(', ')})`;
  assert.ok(lists.length >= 2, '종류 목록이 CHECK 와 함수 두 곳에 있어야 합니다');
  for (const l of lists) assert.equal(l, expected);
});

test('DB 의 글자 수 기준이 화면과 같다', () => {
  assert.ok(
    CODE.includes(`BETWEEN ${FEEDBACK_BODY_MIN} AND ${FEEDBACK_BODY_MAX}`),
    'CHECK 제약의 글자 수가 lib/utils/feedback.ts 와 다릅니다',
  );
  assert.ok(CODE.includes(`< ${FEEDBACK_BODY_MIN} THEN`), '함수의 최소 글자 수가 다릅니다');
  assert.ok(CODE.includes(`> ${FEEDBACK_BODY_MAX} THEN`), '함수의 최대 글자 수가 다릅니다');
});

// ── 보안 — 이 기능의 핵심이라 소스에서 지킵니다 ──────────────

test('두 표 모두 RLS 가 켜져 있다', () => {
  assert.match(CODE, /ALTER TABLE admins ENABLE ROW LEVEL SECURITY/);
  assert.match(CODE, /ALTER TABLE feedback ENABLE ROW LEVEL SECURITY/);
});

test('관리자 목록에는 정책이 하나도 없다 — 아무도 직접 읽거나 쓰지 못한다', () => {
  assert.doesNotMatch(CODE, /CREATE POLICY\s+\w+\s+ON admins/i);
});

test('문의는 읽기 정책 하나뿐이고 그 조건은 is_admin() 이다', () => {
  const policies = [...CODE.matchAll(/CREATE POLICY\s+(\w+)\s+ON feedback\s+FOR\s+(\w+)\s+USING\s*\(([^)]*\))\)/gi)];
  assert.equal(policies.length, 1, `feedback 정책이 ${policies.length}개입니다 — 읽기 하나여야 합니다`);
  const [, , command, condition] = policies[0];
  assert.equal(command.toUpperCase(), 'SELECT');
  assert.equal(condition.replace(/\s/g, ''), 'is_admin()');
});

test('문의를 직접 넣거나 고치거나 지우는 정책이 없다', () => {
  assert.doesNotMatch(CODE, /ON feedback\s+FOR\s+(INSERT|UPDATE|DELETE|ALL)/i);
});

test('보내기 함수는 로그인한 사람의 id 로만 넣는다', () => {
  // 화면이 user_id 를 넘기지 못하게 — 함수 인자에 user_id 가 없어야 합니다
  assert.match(CODE, /FUNCTION submit_feedback\(p_category TEXT, p_body TEXT\)/);
  assert.match(CODE, /v_uid\s+UUID := auth\.uid\(\)/);
  assert.match(CODE, /VALUES \(v_uid, p_category, v_body\)/);
});

test('보내기 함수는 로그인한 사람만 부를 수 있다', () => {
  assert.match(CODE, /REVOKE ALL ON FUNCTION submit_feedback\(TEXT, TEXT\) FROM PUBLIC/);
  assert.match(CODE, /GRANT EXECUTE ON FUNCTION submit_feedback\(TEXT, TEXT\) TO authenticated;/);
  assert.doesNotMatch(CODE, /submit_feedback\(TEXT, TEXT\) TO anon/);
});

test('저장소에 관리자 이메일을 적지 않는다', () => {
  // 맨 아래 예시는 주석 안이고 example.com 입니다
  assert.doesNotMatch(CODE, /INSERT INTO admins/i, '관리자 지정은 SQL 편집기에서 따로 합니다');
  const emails = SQL.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? [];
  for (const e of emails) assert.match(e, /@example\.com$/, `실제 이메일처럼 보입니다: ${e}`);
});
