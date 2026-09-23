import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DISCOVER_RECOMMENDATION_REPLY,
  analyzeUserContext,
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

test('모임 규모 질문의 선택지는 Action 규모를 제공한다 (혼자 vs 여럿 배제)', () => {
  assert.deepEqual(getQuestionOptions('group_size'), [
    '10명 이내 소규모',
    '10~20명 중규모',
    '20명 이상 대규모',
  ]);
});

test('사용자 상태 A(가입 직후 첫 진입) 오프닝 질문을 생성한다', () => {
  const reply = getQuestionReply('talent_preference', {
    nickname: '성은',
    answers: {},
    profileSkills: [],
    selectedSkills: [],
    fieldReferenceCategories: [],
    hasHistory: false,
    userState: 'A',
  });

  assert.equal(
    reply,
    [
      '반가워요, 성은님! 😊',
      '몇 가지만 편하게 알려주시면 성은님에게 꼭 맞는 Action을 찾아볼게요.',
      '먼저, 이번에는 가진 재능을 살려보고 싶으신가요, 아니면 부담 없이 가볍게 시작하고 싶으신가요?',
    ].join('\n'),
  );
});

test('사용자 상태 B(프로필 있음, 활동 0건) 오프닝에 등록 재능을 확인한다', () => {
  const reply = getQuestionReply('talent_preference', {
    nickname: '성은',
    answers: {},
    profileSkills: ['사진 촬영'],
    selectedSkills: [],
    fieldReferenceCategories: [],
    hasHistory: false,
    userState: 'B',
  });

  assert.equal(
    reply,
    [
      '반가워요, 성은님! 😊',
      '프로필에 사진 촬영 재능을 등록해주셨네요.',
      '이번 활동에서도 사진 촬영 재능을 살릴 수 있는 Action을 찾아볼까요, 아니면 가볍게 시작하고 싶으신가요?',
    ].join('\n'),
  );
});

test('사용자 상태 C(활동 1~2건) 오프닝에 지난 참여 분야를 언급한다', () => {
  const reply = getQuestionReply('talent_preference', {
    nickname: '성은',
    answers: {},
    profileSkills: [],
    selectedSkills: [],
    fieldReferenceCategories: ['동물', '환경'],
    hasHistory: true,
    userState: 'C',
  });

  assert.equal(
    reply,
    [
      '반가워요, 성은님! 😊',
      '지난번에 동물·환경 분야에 참여하셨네요.',
      '이번에도 비슷한 활동을 이어가볼까요, 아니면 새로운 분야를 찾아볼까요?',
    ].join('\n'),
  );
});

test('사용자 상태 D(활동 3건 이상) 오프닝에 익숙함 vs 새로운 도전을 묻는다', () => {
  const reply = getQuestionReply('talent_preference', {
    nickname: '성은',
    answers: {},
    profileSkills: [],
    selectedSkills: [],
    fieldReferenceCategories: ['교육'],
    hasHistory: true,
    userState: 'D',
  });

  assert.equal(
    reply,
    [
      '반가워요, 성은님! 😊',
      '주로 교육 분야에 많이 참여하셨네요.',
      '이번에도 익숙한 스타일로 갈까요, 새로운 도전을 해볼까요?',
    ].join('\n'),
  );
});

test('사용자 상태 E(장기 미활동 30일 이상) 오프닝에 복귀를 환영한다', () => {
  const reply = getQuestionReply('talent_preference', {
    nickname: '성은',
    answers: {},
    profileSkills: [],
    selectedSkills: [],
    fieldReferenceCategories: [],
    hasHistory: true,
    userState: 'E',
    pastActivitySummary: '지난번 플로깅 Action',
  });

  assert.equal(
    reply,
    [
      '반가워요, 성은님! 😊 오랜만이에요.',
      '지난번 플로깅 Action하셨던 기억이 나네요.',
      '이번에 다시 가볍게 시작해볼 만한 Action을 찾아볼까요?',
    ].join('\n'),
  );
});

test('사용자 상태 F(비로그인 게스트) 오프닝에 친절하게 Action 탐색을 제안한다', () => {
  const reply = getQuestionReply('talent_preference', {
    nickname: '게스트',
    answers: {},
    profileSkills: [],
    selectedSkills: [],
    fieldReferenceCategories: [],
    hasHistory: false,
    userState: 'F',
  });

  assert.equal(
    reply,
    [
      '반가워요! 😊',
      '몇 가지만 편하게 알려주시면 꼭 맞는 Action을 찾아볼게요.',
      '먼저, 이번에는 가진 재능을 살려보고 싶으신가요, 아니면 부담 없이 가볍게 시작하고 싶으신가요?',
    ].join('\n'),
  );
});

test('금지 단어(봉사, 봉사활동, 봉사자, 수혜자)가 질문 문구에 일체 포함되지 않는다', () => {
  const keys = [
    'talent_preference',
    'skills',
    'activity_type',
    'vibe_preference',
    'group_size',
    'field_preference',
    'travel_range',
    'participation_mode',
  ] as const;

  for (const key of keys) {
    const text = getQuestionReply(key, {
      nickname: '테스터',
      answers: { talentPreference: 'use', activityType: 'indoor' },
      profileSkills: ['디자인'],
      selectedSkills: ['디자인'],
      fieldReferenceCategories: ['환경'],
      hasHistory: true,
      userState: 'B',
    });

    assert.equal(/봉사|봉사활동|봉사자|수혜자/.test(text), false);
  }
});

test('analyzeUserContext는 사용자 상태 A~F를 정확히 분류한다', () => {
  // 상태 F (게스트)
  const guest = analyzeUserContext({
    profile: { nickname: '게스트', isGuest: true },
  });
  assert.equal(guest.state, 'F');

  // 상태 A (회원가입 직후, 프로필 빈약, 활동 0건)
  const newUser = analyzeUserContext({
    profile: { nickname: '민우' },
    history: [],
  });
  assert.equal(newUser.state, 'A');

  // 상태 B (프로필 정보 있음, 활동 0건)
  const profileUser = analyzeUserContext({
    profile: { nickname: '민우', skills: ['디자인'] },
    history: [],
  });
  assert.equal(profileUser.state, 'B');

  // 상태 C (프로필 있음, 활동 1~2건)
  const userC = analyzeUserContext({
    profile: { nickname: '민우', skills: ['디자인'] },
    history: [{ title: '아이 돌봄', category: '아동' }],
  });
  assert.equal(userC.state, 'C');

  // 상태 D (프로필 있음, 활동 3건 이상)
  const userD = analyzeUserContext({
    profile: { nickname: '민우', skills: ['디자인'] },
    history: [
      { title: '활동 1', category: '환경' },
      { title: '활동 2', category: '환경' },
      { title: '활동 3', category: '환경' },
    ],
  });
  assert.equal(userD.state, 'D');

  // 상태 E (활동 이력 있으나 30일 이상 미활동)
  const userE = analyzeUserContext({
    profile: { nickname: '민우' },
    history: [{ title: '과거 활동', category: '동물' }],
    daysSinceLastActivity: 45,
  });
  assert.equal(userE.state, 'E');
});

test('추천 시작 문장에 대화에서 확인한 성향을 자연스럽게 연결한다', () => {
  const reply = getRecommendationReply({
    nickname: '성은',
    answers: {
      talentPreference: 'use',
      activityType: 'indoor',
      vibePreference: 'social',
      groupSizePreference: 'small',
      fieldPreference: 'new',
    },
    selectedSkills: ['사진 촬영'],
    fieldReferenceCategories: ['동물'],
  });

  assert.equal(
    reply,
    [
      '성은님께서 사진 촬영 재능을 살릴 수 있으면서, 날씨 안 타는 실내에서, 따뜻한 교류를 나누는, 10명 이내 소규모 참여하실 수 있는',
      '새로운 분야의 Action으로 골라봤어요. 마음에 드는 활동을 확인해보세요! 😊',
    ].join('\n'),
  );
});

test('질문 턴 수는 최소 4개, 충분하면 4개에서 즉시 추천, 최대 6개를 넘지 않는다', () => {
  // 0~3턴: 무조건 추천하지 않음
  assert.equal(shouldRecommendNow({ userTurnCount: 0 }), false);
  assert.equal(shouldRecommendNow({ userTurnCount: 3, enough: false }), false);
  assert.equal(shouldRecommendNow({ userTurnCount: 3, enough: true }), false);

  // 4턴: enough가 true일 때만 추천
  assert.equal(shouldRecommendNow({ userTurnCount: 4, enough: false }), false);
  assert.equal(shouldRecommendNow({ userTurnCount: 4, enough: true }), true);

  // 5턴: enough가 true일 때 추천, false면 추가 질문
  assert.equal(shouldRecommendNow({ userTurnCount: 5, enough: false }), false);
  assert.equal(shouldRecommendNow({ userTurnCount: 5, enough: true }), true);

  // 6턴: 무조건 추천 (최대 6개 초과 금지)
  assert.equal(shouldRecommendNow({ userTurnCount: 6, enough: false }), true);
  assert.equal(shouldRecommendNow({ userTurnCount: 7, enough: false }), true);
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

test('선택지 및 자연어 답변에서 성향을 올바르게 누적해 읽는다', () => {
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
