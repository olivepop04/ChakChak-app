/**
 * 모집 항목 저장 — 「빈 배열은 전부 지웠다는 뜻」 분기를 지킵니다.
 *
 * CLAUDE.md 규칙 10 이 「이 분기를 지키는 테스트가 아직 없습니다」 라고 적어둔 자리입니다.
 * 이 버그는 **두 겹**이라 한쪽만 고치면 안 고쳐졌습니다 — 그래서 두 겹을 다 지킵니다.
 *
 *   ① 함수  `saveActionItems()` 가 빈 배열을 거절하지 않는다 (공개할 때만 거절)
 *   ② 화면  `ActionForm.tsx` 이 항목 0개면 함수를 아예 안 부르던 것
 *
 * ②는 컴포넌트를 렌더할 도구가 없어서(Node 내장 러너만 씁니다) 소스를 읽어 지킵니다.
 * 모양새를 검사하는 게 아니라, **되살아나면 안 되는 분기 세 개**만 봅니다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getActionItemsError } from '../lib/utils/action-items-validation.ts';

type 항목 = Parameters<typeof getActionItemsError>[0][number];

/** 기본값 — 최소 인원만 받는 사람 항목 하나 */
function 사람항목(덮어쓰기: Partial<항목> = {}): 항목 {
  return {
    type: 'PERSON',
    name: '플로깅 참가자',
    targetType: 'MINIMUM',
    minRequired: 10,
    ...덮어쓰기,
  };
}

// ── ① 함수: 빈 배열 분기 ──────────────────────────────────────

test('★ 임시저장 — 항목을 전부 지운 것도 통과한다', () => {
  // 전에는 여기서 무조건 거절했습니다. 그래서 화면은 비었는데 DB 에는 남고
  // 「저장했어요」 가 떴습니다. 되살아나면 이 테스트가 먼저 깨집니다.
  assert.equal(getActionItemsError([]), null);
  assert.equal(getActionItemsError([], {}), null);
  assert.equal(getActionItemsError([], { requireAtLeastOne: false }), null);
});

test('★ 공개 — 항목이 하나도 없으면 거절한다', () => {
  const 메시지 = getActionItemsError([], { requireAtLeastOne: true });
  assert.equal(메시지, '모집 항목을 하나 이상 추가해주세요.');
});

test('항목이 있으면 requireAtLeastOne 과 무관하게 통과한다', () => {
  assert.equal(getActionItemsError([사람항목()]), null);
  assert.equal(getActionItemsError([사람항목()], { requireAtLeastOne: true }), null);
});

test('이름 없는 항목 — 공개는 거절, 임시저장은 통과 (2026-09-30)', () => {
  const 빈이름 = [사람항목({ name: '   ' })];
  assert.equal(
    getActionItemsError(빈이름, { requireAtLeastOne: true }),
    '모집 항목의 이름을 입력해주세요.',
  );
  assert.equal(getActionItemsError(빈이름), null);
});

// ── ① 함수: 정원 검사 (모집 수량 규칙) ────────────────────────

test('RANGE 인데 최대 인원이 없으면 거절한다', () => {
  const 메시지 = getActionItemsError([사람항목({ targetType: 'RANGE', maxAllowed: null })]);
  assert.equal(메시지, '「플로깅 참가자」의 최대 인원을 입력해주세요.');
});

test('RANGE 의 최대가 최소보다 작으면 거절한다', () => {
  const 메시지 = getActionItemsError([
    사람항목({ targetType: 'RANGE', minRequired: 5, maxAllowed: 3 }),
  ]);
  assert.equal(메시지, '「플로깅 참가자」의 최대 인원이 최소보다 작습니다.');
});

test('RANGE 에서 최대와 최소가 같은 것은 「정확히 N명」 이라 통과한다', () => {
  // 모집 수량 규칙: RANGE 3/3 = 정확히 3명
  assert.equal(
    getActionItemsError([사람항목({ targetType: 'RANGE', minRequired: 3, maxAllowed: 3 })]),
    null,
  );
});

test('MINIMUM 은 최대가 없어도 통과한다', () => {
  // 모집 수량 규칙: MINIMUM 은 max_allowed 가 NULL
  assert.equal(getActionItemsError([사람항목({ targetType: 'MINIMUM' })]), null);
});

test('여러 항목 중 하나만 틀려도 그 항목 이름으로 알려준다', () => {
  const 메시지 = getActionItemsError([
    사람항목(),
    사람항목({ name: '쓰레기봉투', type: 'GOODS', targetType: 'RANGE', maxAllowed: null }),
  ]);
  assert.equal(메시지, '「쓰레기봉투」의 최대 인원을 입력해주세요.');
});

// ── ② 화면: 항목 0개에서도 저장 함수를 부르는가 ────────────────

const 폼소스 = readFileSync(new URL('../components/action/ActionForm.tsx', import.meta.url), 'utf8');

test('★ 화면이 항목 개수로 저장 함수를 건너뛰지 않는다', () => {
  // 원래 버그의 나머지 절반입니다. `if (items.length > 0 || requireItems)` 로 감싸서
  // 항목이 0개면 saveActionItems 를 **아예 부르지 않았습니다.**
  // 함수만 고쳐서는 안 고쳐졌던 이유입니다 (2026-09-17에 화면도 고쳤습니다).
  assert.ok(
    폼소스.includes('saveActionItems('),
    'ActionForm 이 saveActionItems 를 부르지 않습니다',
  );
  assert.ok(
    !/items\.length/.test(폼소스),
    'ActionForm 에 items.length 검사가 생겼습니다 — 저장 경로를 개수로 가르면 ' +
      '항목을 전부 지운 것이 저장되지 않습니다 (CLAUDE.md 규칙 10)',
  );
});

test('★ 임시저장 경로는 requireItems 를 넘기지 않는다', () => {
  // handleSave 는 saveDraft(), handleReview 만 saveDraft({ requireItems: true }).
  // 임시저장에 requireItems 를 넘기면 버그가 그대로 되살아납니다.
  assert.ok(
    /const id = await saveDraft\(\);/.test(폼소스),
    '임시저장이 saveDraft() 를 옵션 없이 부르지 않습니다',
  );
  assert.ok(
    /saveDraft\(\{\s*requireItems:\s*true\s*\}\)/.test(폼소스),
    '공개 경로가 saveDraft({ requireItems: true }) 를 부르지 않습니다',
  );
});

test('saveDraft 의 requireItems 기본값은 false 다', () => {
  assert.ok(
    /saveDraft\(\{\s*requireItems\s*=\s*false\s*\}\s*=\s*\{\}\)/.test(폼소스),
    'saveDraft 의 requireItems 기본값이 false 가 아닙니다 — 기본이 true 면 ' +
      '임시저장이 항목을 요구하게 됩니다',
  );
});

test('저장 함수에 넘기는 옵션이 requireItems 를 그대로 전달한다', () => {
  assert.ok(
    /saveActionItems\(\s*supabase,\s*id,\s*items,\s*\{\s*requireAtLeastOne:\s*requireItems,?\s*\}/.test(
      폼소스,
    ),
    'saveActionItems 에 requireAtLeastOne: requireItems 를 넘기지 않습니다',
  );
});
