import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DISCOVER_RECOMMENDATION_REPLY,
  extractAdaptiveAnswers,
  getDiscoverReply,
  getQuestionOptions,
  getQuestionReply,
  getRecommendationReply,
  getRemainingQuestionKeys,
  shouldRecommendNow,
} from '../app/api/ai/discover/interview.ts';
import { SKILLS } from '../lib/constants/index.ts';

test('Discover 재능 선택지는 프로필의 공통 재능 목록을 그대로 사용한다', () => {
  assert.deepEqual(getQuestionOptions('skills', SKILLS), [...SKILLS]);
});

test('첫 질문 전에 닉네임을 넣어 Discover 역할을 편안하게 안내한다', () => {
  assert.equal(
    getQuestionReply('talent_preference', {
      nickname: '지수',
      answers: {},
      profileSkills: [],
      selectedSkills: [],
      fieldReferenceCategories: [],
      hasHistory: false,
    }),
    [
      '반가워요, 지수님. 😊',
      '몇 가지만 편하게 알려주시면 지수님에게 잘 맞는 액션을 찾아볼게요.',
      '먼저, 이번에는 가진 재능을 활용할 수 있는 액션을 찾아볼까요?',
    ].join('\n'),
  );
});

test('재능을 사용하지 않는 답변을 받아주고 참여 방식으로 연결한다', () => {
  assert.equal(
    getQuestionReply('participation_mode', {
      nickname: '지수',
      answers: { talentPreference: 'any' },
      profileSkills: [],
      selectedSkills: [],
      fieldReferenceCategories: [],
      hasHistory: false,
    }),
    [
      '괜찮아요. 특별한 재능이 없어도 참여할 수 있는 액션이 많아요.',
      '시간, 물건, 직접 행동 중 어떤 방식이 가장 편하세요?',
    ].join('\n'),
  );
});

test('기존 회원의 실제 참여 분야를 받아주며 분야 선택을 묻는다', () => {
  assert.equal(
    getQuestionReply('field_preference', {
      nickname: '지수',
      answers: {
        talentPreference: 'use',
        groupSizePreference: 'small',
      },
      profileSkills: ['사진 촬영'],
      selectedSkills: ['사진 촬영'],
      fieldReferenceCategories: ['동물', '환경'],
      hasHistory: true,
    }),
    [
      '작은 모임이 더 편하시군요.',
      '최근 동물·환경 분야 액션에 참여하셨네요. 이번에도 비슷한 활동을 이어가볼까요, 아니면 새로운 분야를 찾아볼까요?',
    ].join('\n'),
  );
});

test('추천 시작 문장에 대화에서 확인한 성향을 자연스럽게 연결한다', () => {
  assert.equal(
    getRecommendationReply({
      nickname: '지수',
      answers: {
        talentPreference: 'use',
        groupSizePreference: 'small',
        fieldPreference: 'new',
        travelRange: 'province',
      },
      selectedSkills: ['사진 촬영'],
      fieldReferenceCategories: ['동물'],
    }),
    [
      '지수님은 사진 촬영 재능을 활용하면서 10명 이내의 작은 모임에서 새로운 분야에 도전해보고 싶으시군요.',
      '말씀해주신 내용을 바탕으로 잘 맞는 액션을 골라봤어요.',
    ].join('\n'),
  );
});

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

test('추천은 다섯 번째 답변에 도달하면 무조건 시작한다', () => {
  assert.equal(shouldRecommendNow({ userTurnCount: 0 }), false);
  assert.equal(shouldRecommendNow({ userTurnCount: 4 }), false);
  assert.equal(shouldRecommendNow({ userTurnCount: 5 }), true);
});

test('앞선 대화에서 조건이 충분하면(enough: true) 3~4번째 답변에서도 추천을 시작할 수 있다', () => {
  assert.equal(shouldRecommendNow({ userTurnCount: 2, enough: true }), false);
  assert.equal(shouldRecommendNow({ userTurnCount: 3, enough: true }), true);
  assert.equal(shouldRecommendNow({ userTurnCount: 4, enough: true }), true);
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
