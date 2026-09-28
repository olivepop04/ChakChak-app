/**
 * 재능 목록 — 조장님이 정한 16종과 화면이 어긋나지 않게 지킵니다 (2026-09-28).
 *
 * 화면(가입 3단계 · 프로필 수정)은 [...SKILLS, '기타'] 로 칩을 만듭니다.
 * 그래서 SKILLS 에는 15개만 두고, 「기타」 는 직접 입력 칸으로 따로 붙습니다.
 *
 * 지키는 것
 *   ① 화면에 보이는 목록이 조장님 16종과 이름·순서까지 같다
 *   ② 「기타」 가 SKILLS 에 들어가 칩이 두 번 나오지 않는다
 *   ③ 원래 있던 9개가 이름·순서 그대로다 — 바뀌면 이미 가입한 사람의 값이 안 맞게 됩니다
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { SKILLS } from '../lib/constants/index.ts';
import { SKILL_OTHER_OPTION } from '../app/my/_components/skill-selection.ts';

/** 조장님 요청 원문 (2026-09-28 11:51) — Discover 대화·AI 분류에도 같은 목록을 씁니다 */
const REQUESTED = [
  '사진 촬영', '영상 촬영·편집', '디자인', '글쓰기', 'SNS 홍보', '요리', '운전',
  '교육·멘토링', '통역·번역', '컴퓨터·IT', '원예·식물관리', '청소·정리',
  '미술·공예', '음악·공연', '수리·시공', '기타',
];

/** 2026-09-03 부터 쓰던 9개 — profiles.skills 에 이미 저장돼 있는 값들 */
const ORIGINAL_NINE = [
  '사진 촬영', '영상 촬영·편집', '디자인', '글쓰기', 'SNS 홍보', '요리', '운전',
  '교육·멘토링', '통역·번역',
];

test('화면에 보이는 재능 목록이 조장님 16종과 같다', () => {
  assert.deepEqual([...SKILLS, SKILL_OTHER_OPTION], REQUESTED);
});

test('「기타」 는 SKILLS 에 없다 — 있으면 칩이 두 번 나온다', () => {
  assert.equal((SKILLS as readonly string[]).includes(SKILL_OTHER_OPTION), false);
});

test('원래 9개는 이름·순서 그대로다 — 이미 저장된 값이 계속 맞아야 한다', () => {
  assert.deepEqual(SKILLS.slice(0, ORIGINAL_NINE.length), ORIGINAL_NINE);
});

test('SKILLS 에 중복이 없다', () => {
  assert.equal(new Set(SKILLS).size, SKILLS.length);
});
