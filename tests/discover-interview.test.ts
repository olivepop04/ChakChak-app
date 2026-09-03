import test from 'node:test';
import assert from 'node:assert/strict';

import {
  extractAdaptiveAnswers,
  getRemainingQuestionKeys,
  shouldRecommendNow,
} from '../app/api/ai/discover/interview.ts';

test('프로필에 재능이 있으면 재능 보유 여부를 다시 묻지 않는다', () => {
  const remaining = getRemainingQuestionKeys({
    skills: ['사진 촬영'],
    hasHistory: false,
    answers: {},
  });

  assert.equal(remaining.includes('skills'), false);
  assert.equal(remaining.includes('talent_preference'), true);
});

test('재능이 없다고 답한 사용자는 재능 활용 선호도 묻지 않는다', () => {
  const remaining = getRemainingQuestionKeys({
    skills: [],
    hasHistory: false,
    answers: {},
  });

  assert.equal(remaining.includes('skills'), false);
  assert.equal(remaining.includes('talent_preference'), false);
});

test('과거 참여 이력이 없으면 기존 분야 유지 여부를 억지로 묻지 않는다', () => {
  const remaining = getRemainingQuestionKeys({
    skills: null,
    hasHistory: false,
    answers: {},
  });

  assert.equal(remaining.includes('field_preference'), false);
});

test('재능을 아직 모르겠다고 답한 같은 대화에서는 재능을 다시 묻지 않는다', () => {
  const remaining = getRemainingQuestionKeys({
    skills: null,
    skillsAnswered: true,
    hasHistory: false,
    answers: {},
  });

  assert.equal(remaining.includes('skills'), false);
});

test('정보가 충분하거나 네 번 답했으면 추천으로 전환한다', () => {
  assert.equal(
    shouldRecommendNow({ userTurnCount: 1, enough: true, remainingCount: 2 }),
    true,
  );
  assert.equal(
    shouldRecommendNow({ userTurnCount: 4, enough: false, remainingCount: 3 }),
    true,
  );
  assert.equal(
    shouldRecommendNow({ userTurnCount: 0, enough: true, remainingCount: 0 }),
    true,
  );
});

test('선택지 답변에서 네 가지 성향을 누적해 읽는다', () => {
  const answers = extractAdaptiveAnswers([
    '재능을 활용하고 싶어요',
    '10명 이내가 좋아요',
    '새로운 분야',
    '같은 시·도까지',
  ]);

  assert.deepEqual(answers, {
    talentPreference: 'use',
    groupSizePreference: 'small',
    fieldPreference: 'new',
    travelRange: 'province',
  });
});
