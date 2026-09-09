import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DISCOVER_RECOMMENDATION_REPLY,
  extractAdaptiveAnswers,
  getDiscoverReply,
  getRemainingQuestionKeys,
  shouldRecommendNow,
} from '../app/api/ai/discover/interview.ts';

test('프로필 재능 유무와 관계없이 첫 질문은 재능 활용 여부다', () => {
  const remaining = getRemainingQuestionKeys({
    skillsAnswered: false,
    answers: {},
  });

  assert.deepEqual(remaining, ['talent_preference']);
});

test('재능 활용을 선택하면 재능 질문 뒤 공통 세 질문을 묻는다', () => {
  const remaining = getRemainingQuestionKeys({
    skillsAnswered: false,
    answers: { talentPreference: 'use' },
  });

  assert.deepEqual(remaining, [
    'skills',
    'group_size',
    'field_preference',
    'travel_range',
  ]);
});

test('재능 미사용을 선택하면 재능 대신 참여 방식을 묻는다', () => {
  const remaining = getRemainingQuestionKeys({
    skillsAnswered: false,
    answers: { talentPreference: 'any' },
  });

  assert.deepEqual(remaining, [
    'participation_mode',
    'group_size',
    'field_preference',
    'travel_range',
  ]);
  assert.equal(remaining.includes('skills'), false);
});

test('재능 답변을 받으면 신규 회원도 분야 선호를 포함한 공통 질문을 이어간다', () => {
  const remaining = getRemainingQuestionKeys({
    skillsAnswered: true,
    answers: { talentPreference: 'use' },
  });

  assert.deepEqual(remaining, [
    'group_size',
    'field_preference',
    'travel_range',
  ]);
});

test('추천은 앞선 정보가 충분해도 다섯 번째 답변 뒤에만 시작한다', () => {
  assert.equal(shouldRecommendNow({ userTurnCount: 0 }), false);
  assert.equal(shouldRecommendNow({ userTurnCount: 4 }), false);
  assert.equal(shouldRecommendNow({ userTurnCount: 5 }), true);
});

test('추천 전환 때 AI가 만든 다음 질문을 고정 추천 안내로 교체한다', () => {
  assert.equal(
    getDiscoverReply({
      recommendNow: true,
      conversationReply: '활동 장소는 어디까지 이동할 수 있나요?',
    }),
    DISCOVER_RECOMMENDATION_REPLY,
  );
  assert.equal(
    getDiscoverReply({
      recommendNow: false,
      conversationReply: '어떤 방식으로 참여하고 싶으세요?',
    }),
    '어떤 방식으로 참여하고 싶으세요?',
  );
});

test('선택지 답변에서 참여 방식을 포함한 다섯 가지 성향을 누적해 읽는다', () => {
  const answers = extractAdaptiveAnswers([
    '재능과 상관없어요',
    '물건으로',
    '10명 이내가 좋아요',
    '새로운 분야',
    '같은 시·도까지',
  ]);

  assert.deepEqual(answers, {
    talentPreference: 'any',
    participationMode: 'goods',
    groupSizePreference: 'small',
    fieldPreference: 'new',
    travelRange: 'province',
  });
});
