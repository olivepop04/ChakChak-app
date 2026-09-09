import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyCodeFindings,
  withoutRepeats,
  type CodeWarning,
  type ReviewLike,
} from '../lib/utils/review-result.ts';

function AI(덮어쓰기: Partial<ReviewLike> = {}): ReviewLike {
  return {
    decision: 'PASS',
    hard_errors: [],
    warnings: [],
    suggestions: [],
    questions: [],
    ...덮어쓰기,
  };
}

const 주소경고: CodeWarning = {
  topic: '주소',
  message: '주소가 "파주" 라서 참여자가 어디로 가야 할지 정하기 어려울 수 있어요.',
  dropSuggestions: true,
};

const 제목경고: CodeWarning = {
  topic: '제목',
  message: '제목만 보고도 무슨 활동인지 알 수 있게 조금만 더 적어주시면 좋아요.',
  dropSuggestions: false,
};

test('코드가 짚은 것이 없으면 AI 결과를 그대로 둔다', () => {
  const ai = AI({ decision: 'PASS', suggestions: ['제목을 이렇게 바꿔보면 어때요'] });
  assert.deepEqual(applyCodeFindings(ai, []), ai);
});

test('코드가 짚은 것이 있으면 PASS 로 넘어가지 않는다', () => {
  // "파주" 뿐인데 통과하면 기획 수정 25쪽 문제가 되돌아옵니다.
  const result = applyCodeFindings(AI({ decision: 'PASS' }), [주소경고]);
  assert.equal(result.decision, 'REVISE');
  assert.deepEqual(result.warnings, [주소경고.message]);
});

test('BLOCK 은 코드 경고가 있어도 그대로 BLOCK 이다', () => {
  const ai = AI({ decision: 'BLOCK', hard_errors: ['개인정보가 들어 있어요.'] });
  const result = applyCodeFindings(ai, [주소경고]);
  assert.equal(result.decision, 'BLOCK');
  assert.deepEqual(result.hard_errors, ['개인정보가 들어 있어요.']);
});

test('코드가 이미 말한 주제를 AI 가 되풀이하면 지운다', () => {
  // 2026-09-09 실측: 프롬프트로 막아도 모델이 세 칸에 나눠서 되풀이했습니다.
  const ai = AI({
    decision: 'REVISE',
    warnings: ['주소가 너무 넓어요.'],
    suggestions: ['주소를 좀 더 구체적으로 적어주세요.'],
    questions: ['정확한 주소를 알려주실 수 있나요?'],
  });
  const result = applyCodeFindings(ai, [주소경고]);
  assert.deepEqual(result.warnings, [주소경고.message]);
  assert.deepEqual(result.suggestions, []);
  assert.deepEqual(result.questions, []);
});

test('주제가 다른 AI 문장은 남긴다', () => {
  const ai = AI({
    decision: 'REVISE',
    warnings: ['무엇을 준비해 가야 하는지 알 수 없어요.'],
    questions: ['몇 시에 모이면 되나요?'],
  });
  const result = applyCodeFindings(ai, [주소경고]);
  assert.deepEqual(result.warnings, [
    주소경고.message,
    '무엇을 준비해 가야 하는지 알 수 없어요.',
  ]);
  assert.deepEqual(result.questions, ['몇 시에 모이면 되나요?']);
});

test('제목은 AI 가 제안한 문장을 남긴다 — 그대로 가져다 쓸 수 있으니까', () => {
  const ai = AI({
    decision: 'PASS',
    warnings: ['제목이 짧아요.'],
    suggestions: ['제목: 서울숲에서 함께 쓰레기 줍기'],
  });
  const result = applyCodeFindings(ai, [제목경고]);
  assert.deepEqual(result.warnings, [제목경고.message]);
  assert.deepEqual(result.suggestions, ['제목: 서울숲에서 함께 쓰레기 줍기']);
});

test('코드와 AI 가 똑같은 문장을 내면 한 번만 보여준다', () => {
  const ai = AI({ decision: 'REVISE', warnings: [제목경고.message] });
  const result = applyCodeFindings(ai, [제목경고]);
  assert.deepEqual(result.warnings, [제목경고.message]);
});

test('코드 문장을 AI 문장보다 앞에 둔다', () => {
  const ai = AI({ decision: 'REVISE', warnings: ['설명이 짧아요.'] });
  const result = applyCodeFindings(ai, [주소경고]);
  assert.equal(result.warnings[0], 주소경고.message);
});

test('withoutRepeats 는 주제가 없으면 아무것도 지우지 않는다', () => {
  const 문장들 = ['가', '나'];
  assert.deepEqual(withoutRepeats(문장들, []), 문장들);
});
