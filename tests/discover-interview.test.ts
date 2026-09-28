import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DISCOVER_RECOMMENDATION_REPLY,
  analyzeUserContext,
  extractAdaptiveAnswers,
  extractAnswersFromDialogue,
  getDiscoverReply,
  getQuestionOptions,
  getQuestionReply,
  getRecommendationReply,
  getRemainingQuestionKeys,
  shouldRecommendNow,
  validateHarmfulSkillInput,
  formatSummaryChips,
  ALL_15_SKILLS,
} from '../app/api/ai/discover/interview.ts';
import { SKILLS } from '../lib/constants/index.ts';
import { fallbackReason, type ScoredAction } from '../lib/utils/scoring.ts';
import type { ActionCardData } from '../lib/types/view.ts';

test('Discover 재능 선택지는 사전 정의된 16개 버튼만 정확히 제공하며 불필요한 버튼은 포함하지 않는다', () => {
  const options = getQuestionOptions('skills', SKILLS);
  assert.equal(options.length, 16);
  assert.equal(options.includes('사진 촬영'), true);
  assert.equal(options.includes('기타'), true);
  assert.equal(options.includes('특별한 재능 없이 참여'), false);
  assert.equal(options.includes('상관없음'), false);
});

test('대화에서 복수의 재능을 선택/입력했을 때 모든 재능이 배열로 추출된다', () => {
  const messages = [
    { role: 'assistant' as const, content: '어떤 재능을 활용하고 싶으신가요?' },
    { role: 'user' as const, content: '사진 촬영, 영상 촬영·편집, 요리' },
  ];
  const answers = extractAnswersFromDialogue(messages);
  assert.equal(answers.talentPreference, 'use');
  assert.deepEqual(answers.selectedSkills, ['사진 촬영', '영상 촬영·편집', '요리']);
  assert.equal(answers.selectedSkill, '사진 촬영');
});

test('재능 직접 입력 시 유해하거나 부적절한 내용은 가드레일에 의해 차단되고 정상 재능은 통과한다', () => {
  // 1. 유해 단어 차단
  assert.equal(validateHarmfulSkillInput('해킹 기술').isHarmful, true);
  assert.equal(validateHarmfulSkillInput('사기 치는 법').isHarmful, true);
  assert.equal(validateHarmfulSkillInput('폭력').isHarmful, true);
  assert.equal(validateHarmfulSkillInput('도박 노하우').isHarmful, true);

  // 2. 건전한 재능 통과
  assert.equal(validateHarmfulSkillInput('바리스타 커피 제조').isHarmful, false);
  assert.equal(validateHarmfulSkillInput('캘리그라피 글씨').isHarmful, false);
  assert.equal(validateHarmfulSkillInput('수어 통역').isHarmful, false);
});

test('상태 C와 D 사용자의 첫 질문 선택지는 익숙한 분야와 새로운 도전을 제공한다', () => {
  assert.deepEqual(getQuestionOptions('talent_preference', SKILLS, 'C'), [
    '비슷한 활동을 이어갈래요',
    '새로운 분야를 찾아볼래요',
    '상관없음',
  ]);
  assert.deepEqual(getQuestionOptions('talent_preference', SKILLS, 'D'), [
    '익숙한 분야가 좋아요',
    '새로운 도전을 해볼래요',
    '상관없음',
  ]);
});

test('모임 규모 질문의 선택지는 메타데이터 기준 4개 버튼을 제공한다', () => {
  assert.deepEqual(getQuestionOptions('group_size'), [
    '소규모 모임 (10명 안팎)',
    '중규모 모임 (10-20명)',
    '대규모 모임 (20명 이상)',
    '상관없음',
  ]);
});

test('카테고리/분야 질문의 선택지는 7대 카테고리 + 기타 + 상관없음을 제공한다', () => {
  assert.deepEqual(getQuestionOptions('field_preference'), [
    '동물',
    '환경',
    '지역사회',
    '아동·청소년',
    '노인',
    '장애',
    '교육',
    '기타',
    '상관없음',
  ]);
  assert.deepEqual(getQuestionOptions('categories'), [
    '동물',
    '환경',
    '지역사회',
    '아동·청소년',
    '노인',
    '장애',
    '교육',
    '기타',
    '상관없음',
  ]);
});

test('활동 환경 및 성격, 난이도 질문의 선택지에 온라인/비대면과 가족·동반이 제외되고 상관없음이 포함된다', () => {
  assert.deepEqual(getQuestionOptions('activity_type'), [
    '실내 활동',
    '실외 활동',
    '실내외 병행',
    '상관없음',
  ]);
  assert.deepEqual(getQuestionOptions('activity_types'), [
    '실내 활동',
    '실외 활동',
    '실내외 병행',
    '상관없음',
  ]);

  assert.deepEqual(getQuestionOptions('vibe_preference'), [
    '교류·교육·소통형',
    '육체·과업·집중형',
    '상관없음',
  ]);
  assert.deepEqual(getQuestionOptions('target_groups'), [
    '교류·교육·소통형',
    '육체·과업·집중형',
    '상관없음',
  ]);

  assert.deepEqual(getQuestionOptions('difficulty'), [
    '누구나 참여가능',
    '기초 체력 필요',
    '전문지식/자격/재능 활용',
    '상관없음',
  ]);
});

test('사용자 상태 A(가입 직후 첫 진입) 오프닝에 한글 액션 표기를 사용한다', () => {
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
      '몇 가지만 편하게 알려주시면 성은님에게 꼭 맞는 액션을 찾아볼게요.',
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
      '이번 활동에서도 사진 촬영 재능을 살릴 수 있는 액션을 찾아볼까요, 아니면 가볍게 시작하고 싶으신가요?',
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
    pastActivitySummary: '지난번 플로깅 액션',
  });

  assert.equal(
    reply,
    [
      '반가워요, 성은님! 😊',
      '지난번 플로깅 액션하셨던 기억이 나네요.',
      '이번에 다시 가볍게 시작해볼 만한 액션을 찾아볼까요?',
    ].join('\n'),
  );
});

test('사용자 상태 F(비로그인 게스트) 오프닝에 친절하게 액션 탐색을 제안한다', () => {
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
      '몇 가지만 편하게 알려주시면 꼭 맞는 액션을 찾아볼게요.',
      '먼저, 이번에는 가진 재능을 살려보고 싶으신가요, 아니면 부담 없이 가볍게 시작하고 싶으신가요?',
    ].join('\n'),
  );
});

test('금지 단어(봉사, 봉사활동, 봉사자, 수혜자) 및 영어 Action이 질문 문구에 일체 포함되지 않는다', () => {
  const keys = [
    'talent_preference',
    'skills',
    'activity_type',
    'vibe_preference',
    'group_size',
    'difficulty',
    'field_preference',
    'travel_range',
    'time_pref',
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
    assert.equal(/Action/i.test(text), false);
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

test('추천 시작 문장에 대화에서 확인한 성향을 자연스럽게 연결하며 한글 액션을 사용한다', () => {
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
      '새로운 분야의 액션으로 골라봤어요. 마음에 드는 활동을 확인해보세요! 😊',
    ].join('\n'),
  );
  assert.equal(/Action/i.test(reply), false);
});

test('질문 턴 수는 최대 15턴까지 허용하며, 6턴에서 강제 종료되지 않는다', () => {
  // 0~3턴: 무조건 추천하지 않음
  assert.equal(shouldRecommendNow({ userTurnCount: 0 }), false);
  assert.equal(shouldRecommendNow({ userTurnCount: 3, enough: false }), false);
  assert.equal(shouldRecommendNow({ userTurnCount: 3, enough: true }), false);

  // 4턴: enough가 true일 때만 추천
  assert.equal(shouldRecommendNow({ userTurnCount: 4, enough: false }), false);
  assert.equal(shouldRecommendNow({ userTurnCount: 4, enough: true }), true);

  // 6턴: 이전과 달리 강제 종료되지 않고 대화 지속 가능
  assert.equal(shouldRecommendNow({ userTurnCount: 6, enough: false }), false);
  assert.equal(shouldRecommendNow({ userTurnCount: 6, enough: true }), true);

  // 10턴: 충분한 정보 파악을 위해 지속 가능
  assert.equal(shouldRecommendNow({ userTurnCount: 10, enough: false }), false);
  assert.equal(shouldRecommendNow({ userTurnCount: 10, enough: true }), true);

  // 15턴: 최대 한도 도달 시 무조건 추천
  assert.equal(shouldRecommendNow({ userTurnCount: 15, enough: false }), true);
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

test('대화 맥락(질문-답변 쌍)에서 사용자가 선택한 상관없음 답변을 각 질문 축에 맞게 정확히 매핑한다', () => {
  const dialogue = [
    { role: 'assistant', content: '어떤 모임 규모에서 함께하기를 원하시나요?' },
    { role: 'user', content: '상관없음' },
    { role: 'assistant', content: '모임 규모는 상관없다고 하셨군요! 다음으로 어떤 참여 난이도를 선호하시나요?' },
    { role: 'user', content: '상관없음' },
    { role: 'assistant', content: '참여 난이도도 상관없다고 하셨군요! 이제 어떤 이동 범위를 원하시는지 선택해 주세요.' },
    { role: 'user', content: '상관없음' },
  ];

  const answers = extractAnswersFromDialogue(dialogue);
  assert.equal(answers.groupSizePreference, 'any');
  assert.equal(answers.difficultyPreference, 'any');
  assert.equal(answers.travelRange, 'any');
});

test('0순위 오프닝은 프로필 등록 여부에 따라 케이스 A/B 멘트와 선택지를 분기한다', () => {
  // 케이스 A: 프로필 지역과 시간이 있는 경우 (1초 프리패스)
  const replyA = getQuestionReply('opening', {
    nickname: '민우',
    answers: {},
    profileSkills: [],
    selectedSkills: [],
    fieldReferenceCategories: [],
    hasHistory: false,
    profileRegion: '서울특별시 강남구',
    profileTimesSummary: '주말 오후, 평일 저녁',
    hasRegionAndTime: true,
  });
  assert.equal(replyA.includes('활동 지역 : 서울특별시 강남구'), true);
  assert.equal(replyA.includes('선호 시간 : 주말 오후, 평일 저녁'), true);
  assert.equal(replyA.includes('이 조건 그대로 액션을 찾아드릴까요?'), true);

  const optionsA = getQuestionOptions('opening', [], 'A', true);
  assert.deepEqual(optionsA, [
    '네, 이 조건으로 찾을게요 👍',
    '이번엔 다른 조건으로 찾을래요 🔄',
  ]);

  // 케이스 B: 프로필 지역/시간이 미등록된 경우
  const replyB = getQuestionReply('opening', {
    nickname: '민우',
    answers: {},
    profileSkills: [],
    selectedSkills: [],
    fieldReferenceCategories: [],
    hasHistory: false,
    hasRegionAndTime: false,
  });
  assert.equal(replyB.includes('활동하실 지역과 시간을 먼저 확인하고 싶어요'), true);

  const optionsB = getQuestionOptions('opening', [], 'A', false);
  assert.deepEqual(optionsB, [
    '활동할 지역 선택하기 📍',
    '지역 상관없이 전국 액션 볼래요 🌏',
  ]);
});

test('난이도에서 누구나 참여가능을 선택하면 재능 질문을 완전히 스킵하고 환경 질문으로 전진한다', () => {
  const remaining = getRemainingQuestionKeys({
    answers: {
      fieldPreference: 'familiar',
      vibePreference: 'social',
      difficultyPreference: 'easy', // '누구나 참여가능' 선택
    },
  });

  // 재능(skills) 질문이 포함되지 않고 바로 activity_type으로 전진
  assert.equal(remaining.includes('skills'), false);
  assert.equal(remaining[0], 'activity_type');
});

test('난이도에서 전문지식/자격/재능 활용을 선택하면 재능 질문으로 진입한다', () => {
  const remaining = getRemainingQuestionKeys({
    answers: {
      fieldPreference: 'familiar',
      vibePreference: 'social',
      difficultyPreference: 'expert', // '전문지식/자격/재능 활용' 선택
    },
  });

  // skills가 다음 질문으로 제시됨
  assert.equal(remaining[0], 'skills');
});

test('5단계 순차 질문 퍼널 순서(분야 ➔ 성격 ➔ 난이도 ➔ 환경 ➔ 규모)가 정확히 유지된다', () => {
  const emptyRemaining = getRemainingQuestionKeys({
    answers: {},
  });

  assert.deepEqual(emptyRemaining, [
    'field_preference',
    'vibe_preference',
    'difficulty',
    'activity_type',
    'group_size',
  ]);
});

test('[피드백 1] 활동 이력이 있는 사용자는 같은 분야 vs 새로운 분야 2지선다를 제공하고 무한 루프 없이 전진한다', () => {
  // 1. 이력 있는 유저에게는 2지선다 선택지 제공
  const options = getQuestionOptions('field_preference', [], 'C', true, {
    hasHistory: true,
  });
  assert.deepEqual(options, [
    '같은 분야로 찾을래요 👍',
    '새로운 분야에 도전해볼래요 ✨',
  ]);

  // 2. '같은 분야로 찾을래요' 선택 시 관심 분야가 확정되고 성격으로 즉시 전진
  const answersFamiliar = extractAdaptiveAnswers(['같은 분야로 찾을래요 👍']);
  assert.equal(answersFamiliar.fieldPreference, 'familiar');
  const remainingFamiliar = getRemainingQuestionKeys({
    answers: answersFamiliar,
    hasHistory: true,
  });
  assert.equal(remainingFamiliar[0], 'vibe_preference');

  // 3. '새로운 분야에 도전해볼래요' 선택 시 7대 카테고리 노출
  const optionsNew = getQuestionOptions('field_preference', [], 'C', true, {
    hasHistory: true,
    answers: { fieldPreference: 'new' },
  });
  assert.equal(optionsNew.includes('노인'), true);
  assert.equal(optionsNew.includes('동물'), true);

  // 4. 유저가 카테고리 칩(예: 노인)을 선택하면 무한 루프 없이 즉시 성격으로 전진
  const answersCat = extractAdaptiveAnswers(['노인']);
  assert.equal(answersCat.selectedCategory, '노인');
  const remainingCat = getRemainingQuestionKeys({
    answers: answersCat,
    hasHistory: true,
  });
  assert.equal(remainingCat[0], 'vibe_preference');
});

test('[피드백 2] 오프닝에서 다른 조건으로 찾을래요 선택 시 지역 ➔ 시간 순으로 질문 키와 선택지가 일치한다', () => {
  const answersChange = extractAdaptiveAnswers(['이번엔 다른 조건으로 찾을래요 🔄']);
  assert.equal(answersChange.openingDecision, 'change');

  // 남은 질문 키의 최우선순위가 travel_range(지역), 그 다음이 time_pref(시간)이어야 함
  const remaining = getRemainingQuestionKeys({
    answers: answersChange,
    hasRegionAndTime: true,
  });
  assert.equal(remaining[0], 'travel_range');
  assert.equal(remaining[1], 'time_pref');

  // 지역 질문 시 카테고리가 아니라 지역 선택지가 제공됨
  const regionOptions = getQuestionOptions('travel_range');
  assert.deepEqual(regionOptions, [
    '활동할 지역 선택하기 📍',
    '지역 상관없이 전국 액션 볼래요 🌏',
  ]);

  // 시간 질문 시 시간대 선택지가 제공됨
  const timeOptions = getQuestionOptions('time_pref');
  assert.deepEqual(timeOptions, [
    '주말 오전',
    '주말 오후',
    '평일 낮',
    '평일 저녁',
    '시간 상관없음',
  ]);
});

test('[피드백 3] 난이도에서 전문지식/자격/재능 활용 선택 시 프로필 재능 확인 2단계 분기가 동작한다', () => {
  const answersExpert = extractAdaptiveAnswers(['전문지식/자격/재능 활용']);
  assert.equal(answersExpert.difficultyPreference, 'expert');

  // 1. 프로필에 재능이 있는 경우: '예, 그럴게요' vs '아니요, 다른 재능으로 할게요' 2지선다 노출
  const profileSkills = ['디자인', '사진 촬영'];
  const talentOptions = getQuestionOptions('skills', [], 'B', true, {
    profileSkills,
    answers: answersExpert,
  });
  assert.deepEqual(talentOptions, [
    '예, 그럴게요 👍',
    '아니요, 다른 재능으로 할게요 🔄',
  ]);

  // 2. '예, 그럴게요 👍' 선택 시 재능 확정 후 환경으로 전진
  const answersUseProfile = {
    ...extractAdaptiveAnswers([
      '전문지식/자격/재능 활용',
      '예, 그럴게요 👍',
    ]),
    fieldPreference: 'familiar' as const,
    vibePreference: 'social' as const,
  };
  assert.equal(answersUseProfile.selectedSkill, 'profile');
  const remainingAfterProfile = getRemainingQuestionKeys({
    answers: answersUseProfile,
    profileSkills,
  });
  // 재능(skills) 질문이 사라지고 activity_type으로 전진
  assert.equal(remainingAfterProfile.includes('skills'), false);
  assert.equal(remainingAfterProfile[0], 'activity_type');

  // 3. '새로운 재능 이용' 선택 시 15종 재능 목록 노출
  const newTalentOptions = getQuestionOptions('skills', [], 'B', true, {
    profileSkills,
    answers: { ...answersExpert, talentPreference: 'new_skill' },
  });
  assert.equal(newTalentOptions.includes('요리'), true);
  assert.equal(newTalentOptions.includes('컴퓨터·IT'), true);
});

test('[지역 선택 버그 수정 검증] 시군구 선택 및 지역명이 대화에 입력되면 selectedRegion이 정확히 추출되고 무한루프 없이 다음 단계로 진행된다', () => {
  // 1. 피커에서 시군구를 선택한 경우 ("📍 서울특별시 성동구")
  const answersFromPicker = extractAdaptiveAnswers([
    '이번엔 다른 조건으로 찾을래요 🔄',
    '📍 서울특별시 성동구',
  ]);
  assert.equal(answersFromPicker.selectedRegion, '서울특별시 성동구');
  assert.equal(answersFromPicker.travelRange, 'exact');

  // 2. 사용자가 자연어로 지역을 직접 입력한 경우 ("서울 성동구")
  const answersFromTyping = extractAdaptiveAnswers([
    '이번엔 다른 조건으로 찾을래요 🔄',
    '서울 성동구',
  ]);
  assert.equal(answersFromTyping.selectedRegion, '서울특별시 성동구');
  assert.equal(answersFromTyping.travelRange, 'exact');

  // 3. '전국 액션 볼래요'를 선택한 경우
  const answersNationwide = extractAdaptiveAnswers([
    '이번엔 다른 조건으로 찾을래요 🔄',
    '지역 상관없이 전국 액션 볼래요 🌏',
  ]);
  assert.equal(answersNationwide.travelRange, 'any');

  // 4. 지역 선택 완료 후 travel_range 질문이 해소되고 시간 질문으로 정상 전진하는지 검증
  const remainingAfterRegion = getRemainingQuestionKeys({
    answers: answersFromPicker,
  });
  assert.equal(remainingAfterRegion.includes('travel_range'), false);
  assert.equal(remainingAfterRegion[0], 'time_pref');

  // 5. 시간대까지 선택 완료 시 1순위 질문(field_preference)으로 정상 전진
  const answersWithTime = {
    ...answersFromPicker,
    ...extractAdaptiveAnswers(['주말 오후']),
  };
  assert.deepEqual(answersWithTime.timePreferences, ['주말 오후']);
  const remainingAfterTime = getRemainingQuestionKeys({
    answers: answersWithTime,
  });
  assert.equal(remainingAfterTime.includes('travel_range'), false);
  assert.equal(remainingAfterTime.includes('time_pref'), false);
  assert.equal(remainingAfterTime[0], 'field_preference');
});

test('오프닝 멘트에 (집 근처) 문구가 포함되지 않는다', () => {
  const reply = getQuestionReply('opening', {
    nickname: '데모',
    answers: {},
    profileSkills: [],
    selectedSkills: [],
    fieldReferenceCategories: [],
    hasHistory: false,
    profileRegion: '서울특별시 성동구',
    profileTimesSummary: '주말 오후, 평일 저녁',
    hasRegionAndTime: true,
  });
  assert.equal(reply.includes('(집 근처)'), false);
  assert.equal(reply.includes('📍 활동 지역 : 서울특별시 성동구'), true);
});

test('파이팅 등 단순 응원/비재능 입력은 재능으로 저장되지 않는다', () => {
  const messages = [
    { role: 'assistant' as const, content: '어떤 재능을 활용하고 싶으신가요?' },
    { role: 'user' as const, content: '파이팅' },
  ];
  const answers = extractAnswersFromDialogue(messages);
  assert.equal(answers.selectedSkill, undefined);
  assert.equal(answers.selectedSkills, undefined);
});

test('시간대 복수 선택(주말 오후, 평일 저녁) 시 모든 시간대가 timePreferences 배열로 추출된다', () => {
  const messages = [
    { role: 'assistant' as const, content: '보통 언제 참여하기 편하신가요? (복수 선택 가능)' },
    { role: 'user' as const, content: '주말 오후, 평일 저녁' },
  ];
  const answers = extractAnswersFromDialogue(messages);
  assert.deepEqual(answers.timePreferences, ['주말 오후', '평일 저녁']);
  assert.equal(answers.timePreference, 'weekday_evening');
});

test('재능 질문에서 기타 선택 시 talentPreference가 any로 처리되고 환경 질문에 안내 멘트가 정상 연결된다', () => {
  const messages = [
    { role: 'assistant' as const, content: '어떤 재능을 활용하고 싶으신가요?' },
    { role: 'user' as const, content: '기타' },
  ];
  const answers = extractAnswersFromDialogue(messages);
  assert.equal(answers.talentPreference, 'any');
  assert.equal(answers.selectedSkill, '기타');
  assert.deepEqual(answers.selectedSkills, ['기타']);

  const nextReply = getQuestionReply('activity_type', {
    nickname: '데모',
    answers,
    profileSkills: [],
    selectedSkills: ['기타'],
    fieldReferenceCategories: [],
    hasHistory: false,
    profileRegion: '서울특별시 성동구',
    profileTimesSummary: '주말 오후',
    hasRegionAndTime: true,
  });
  assert.equal(
    nextReply.includes('재능과 상관없이 누구나 편하게 나눔을 시작할 수 있는 액션들을 찾아볼게요! ✨'),
    true,
  );
});

test('사람 놀리기 같은 비재능/부적절 텍스트는 재능으로 추출되지 않는다', () => {
  const messages = [
    { role: 'assistant' as const, content: '어떤 재능을 활용하고 싶으신가요?' },
    { role: 'user' as const, content: '사람 놀리기' },
  ];
  const answers = extractAnswersFromDialogue(messages);
  assert.equal(answers.selectedSkill, undefined);
  assert.equal(answers.selectedSkills, undefined);
});

test('재능 복수 선택 시 알려주신 재능을 살릴 수 있는 액션으로 함께 찾아볼게요 안내 멘트가 출력된다', () => {
  const messages = [
    { role: 'assistant' as const, content: '어떤 재능을 활용하고 싶으신가요?' },
    { role: 'user' as const, content: '운전, 청소·정리, 수리·시공' },
  ];
  const answers = extractAnswersFromDialogue(messages);
  assert.deepEqual(answers.selectedSkills, ['운전', '청소·정리', '수리·시공']);

  const nextReply = getQuestionReply('activity_type', {
    nickname: '민우',
    answers,
    profileSkills: [],
    selectedSkills: ['운전', '청소·정리', '수리·시공'],
    fieldReferenceCategories: [],
    hasHistory: false,
    profileRegion: '서울특별시 마포구',
    profileTimesSummary: '주말 오후',
    hasRegionAndTime: true,
  });
  assert.equal(
    nextReply.includes('알려주신 재능을 살릴 수 있는 액션으로 함께 찾아볼게요! ✨'),
    true,
  );
  // 특정 하나만 임의로 대표 지정하여 출력하지 않는다
  assert.equal(nextReply.includes('운전 재능을 살릴 수 있는'), false);
});

test('재능 단일 선택 시에도 알려주신 재능을 살릴 수 있는 액션으로 함께 찾아볼게요 안내 멘트가 출력된다', () => {
  const messages = [
    { role: 'assistant' as const, content: '어떤 재능을 활용하고 싶으신가요?' },
    { role: 'user' as const, content: '요리' },
  ];
  const answers = extractAnswersFromDialogue(messages);
  assert.deepEqual(answers.selectedSkills, ['요리']);

  const nextReply = getQuestionReply('activity_type', {
    nickname: '민우',
    answers,
    profileSkills: [],
    selectedSkills: ['요리'],
    fieldReferenceCategories: [],
    hasHistory: false,
    profileRegion: '서울특별시 마포구',
    profileTimesSummary: '주말 오후',
    hasRegionAndTime: true,
  });
  assert.equal(
    nextReply.includes('알려주신 재능을 살릴 수 있는 액션으로 함께 찾아볼게요! ✨'),
    true,
  );
});

test('[난이도 분기 버그 수정 검증] 기초 체력 필요 선택 시 재능 질문을 완전히 생략하고 환경(activity_type)으로 직행한다', () => {
  const messages = [
    {
      role: 'assistant' as const,
      content:
        '활동의 분위기를 명확히 선택하셨군요! 땀 흘리며 함께 하는 활동은 정말 보람차죠. 😊 액션에 따라 난이도가 다를 수 있어요. 어떤 스타일을 원하세요?',
    },
    { role: 'user' as const, content: '기초 체력 필요' },
  ];

  const answers = {
    ...extractAdaptiveAnswers(['기초 체력 필요']),
    ...extractAnswersFromDialogue(messages),
    fieldPreference: 'familiar' as const,
    vibePreference: 'task' as const,
  };

  assert.equal(answers.difficultyPreference, 'physical');

  const remaining = getRemainingQuestionKeys({
    answers,
    profileSkills: ['요리'],
  });

  // 재능(skills) 질문이 절대 포함되지 않고, 첫 질문이 활동 환경(activity_type)이어야 함
  assert.equal(remaining.includes('skills'), false);
  assert.equal(remaining[0], 'activity_type');

  // 환경 질문 멘트에 활기차고 보람찬 액션 연결 문구가 포함됨
  const nextReply = getQuestionReply('activity_type', {
    nickname: '지수',
    answers,
    profileSkills: ['요리'],
    selectedSkills: [],
    fieldReferenceCategories: [],
    hasHistory: false,
    profileRegion: '서울특별시 성동구',
    profileTimesSummary: '주말 오후',
    hasRegionAndTime: true,
  });

  assert.equal(nextReply.includes('땀 흘리며 함께할 수 있는 활기차고 보람찬 액션들로 찾아볼게요! 💪'), true);
  assert.equal(nextReply.includes('어떤 환경에서 활동하고 싶으세요?'), true);
});

test('[난이도 분기 검증] 누구나 참여가능 선택 시에도 재능 질문 생략 후 환경으로 직행한다', () => {
  const answers = {
    ...extractAdaptiveAnswers(['누구나 참여가능']),
    fieldPreference: 'familiar' as const,
    vibePreference: 'social' as const,
  };

  assert.equal(answers.difficultyPreference, 'easy');

  const remaining = getRemainingQuestionKeys({
    answers,
    profileSkills: ['디자인'],
  });

  assert.equal(remaining.includes('skills'), false);
  assert.equal(remaining[0], 'activity_type');

  const nextReply = getQuestionReply('activity_type', {
    nickname: '지수',
    answers,
    profileSkills: ['디자인'],
    selectedSkills: [],
    fieldReferenceCategories: [],
    hasHistory: false,
    profileRegion: '서울특별시 성동구',
    profileTimesSummary: '주말 오후',
    hasRegionAndTime: true,
  });

  assert.equal(nextReply.includes('누구나 부담 없이 편안하게 참여할 수 있는 액션들로 찾아볼게요! 😊'), true);
});

test('[카테고리 복수 추출 검증] 장애/환경 관심사 입력 시 두 분야가 모두 추출된다', () => {
  const answers = extractAdaptiveAnswers(['장애/환경']);
  assert.equal(answers.selectedCategories?.includes('장애'), true);
  assert.equal(answers.selectedCategories?.includes('환경'), true);

  const dialogueAnswers = extractAnswersFromDialogue([
    { role: 'assistant', content: '어떤 분야의 액션에 가장 관심이 가시나요?' },
    { role: 'user', content: '장애, 환경' },
  ]);
  assert.equal(dialogueAnswers.selectedCategories?.includes('장애'), true);
  assert.equal(dialogueAnswers.selectedCategories?.includes('환경'), true);
});

test('[프로필 재능 질문 멘트 검증] 프로필 재능이 있는 경우 맞춤 멘트가 출력된다', () => {
  const reply = getQuestionReply('skills', {
    nickname: '민호',
    answers: { difficultyPreference: 'expert' },
    profileSkills: ['디자인', '사진 촬영'],
    selectedSkills: [],
    fieldReferenceCategories: [],
    hasHistory: false,
    profileRegion: '서울특별시 성동구',
    profileTimesSummary: '주말 오후',
    hasRegionAndTime: true,
  });

  assert.equal(
    reply,
    '프로필에 [디자인, 사진 촬영] 재능이 있다고 알려주셨는데, 이 재능을 살릴 수 있는 액션을 찾아볼까요?',
  );
});

test('[재능 선택 멘트 검증] 16종 목록 제공 시 아래 선택지 표현을 사용한다', () => {
  const reply = getQuestionReply('skills', {
    nickname: '지수',
    answers: { difficultyPreference: 'expert', talentPreference: 'new_skill' },
    profileSkills: [],
    selectedSkills: [],
    fieldReferenceCategories: [],
    hasHistory: false,
    profileRegion: '서울특별시 성동구',
    profileTimesSummary: '주말 오후',
    hasRegionAndTime: true,
  });

  assert.equal(reply.includes('지수님이 활용할 수 있는 재능을 아래 선택지에서 골라주세요.'), true);
  assert.equal(reply.includes('위 16종'), false);
});

test('[추천 이유 폴백 검증] fallbackReason이 건조한 나열이 아닌 자연스럽고 따뜻한 문장을 생성한다', () => {
  const mockScored: ScoredAction = {
    action: {
      id: 'act-1',
      title: '시니어 컴퓨터 교실 보조',
      category: '교육',
      categories: ['교육'],
      address: '서울특별시 구로구',
      owner: { id: 'host-1', nickname: '호스트' },
    } as unknown as ActionCardData,
    score: 85,
    matched: [
      '관심 분야(교육)',
      '가까운 지역',
      '교육·멘토링 재능 활용',
      '교류·소통형 활동',
    ],
  };

  const reason = fallbackReason(mockScored);
  assert.equal(reason.includes('선택하신 교육 분야에서 교육·멘토링 재능을 살릴 수 있는 교류·소통형 활동이에요.'), true);
  assert.equal(reason.includes('조건에 맞아요.'), false);
});

test('[프로필 재능 그대로 활용 선택 검증] 그대로 살릴/그대로 활용/예, 그럴게요 답변 시 profile 재능으로 파싱된다', () => {
  const answers1 = extractAdaptiveAnswers(['프로필 재능 그대로 활용 👍']);
  assert.equal(answers1.selectedSkill, 'profile');
  assert.equal(answers1.talentPreference, 'use');

  const answers2 = extractAdaptiveAnswers(['예, 그럴게요 👍']);
  assert.equal(answers2.selectedSkill, 'profile');
  assert.equal(answers2.talentPreference, 'use');

  const answers3 = extractAdaptiveAnswers(['예 그럴께요']);
  assert.equal(answers3.selectedSkill, 'profile');
  assert.equal(answers3.talentPreference, 'use');
});

test('[요약 칩 포맷팅 검증] 모든 질문에 상관없음 선택 시 항목명이 명시된 칩으로 변환된다', () => {
  const messages = [
    { role: 'assistant', content: '활동할 지역을 알려주세요!' },
    { role: 'user', content: '지역 상관없이 전국 액션 볼래요 🌏' },
    { role: 'assistant', content: '어떤 분야의 액션에 가장 관심이 가시나요?' },
    { role: 'user', content: '상관없음' },
    { role: 'assistant', content: '어떤 분위기의 활동이 더 끌리시나요? 도란도란 소통 vs 집중' },
    { role: 'user', content: '상관없음' },
    { role: 'assistant', content: '액션에 따라 난이도가 다를 수 있어요. 어떤 스타일을 원하세요?' },
    { role: 'user', content: '상관없음' },
    { role: 'assistant', content: '어떤 환경에서 활동하고 싶으세요? 실내 vs 야외' },
    { role: 'user', content: '상관없음' },
    { role: 'assistant', content: '함께하는 크루의 규모는 어느 정도가 편하세요?' },
    { role: 'user', content: '상관없음' },
  ];

  const chips = formatSummaryChips(messages);
  assert.deepEqual(chips, [
    '전국 어디나',
    '분야 상관없음',
    '액션 성격 상관없음',
    '액션 난이도 상관없음',
    '실내외 상관없음',
    '규모 상관없음',
  ]);
});

test('[요약 칩 포맷팅 검증] 특정 조건과 상관없음이 섞인 경우에도 적절한 칩으로 생성된다', () => {
  const messages = [
    { role: 'assistant', content: '활동할 지역을 알려주세요!' },
    { role: 'user', content: '지역 상관없이 전국 액션 볼래요 🌏' },
    { role: 'assistant', content: '어떤 분야의 액션에 가장 관심이 가시나요?' },
    { role: 'user', content: '상관없음' },
    { role: 'assistant', content: '어떤 분위기의 활동이 더 끌리시나요?' },
    { role: 'user', content: '육체·과업·집중형' },
    { role: 'assistant', content: '액션에 따라 난이도가 다를 수 있어요.' },
    { role: 'user', content: '기초 체력 필요' },
    { role: 'assistant', content: '어떤 환경에서 활동하고 싶으세요?' },
    { role: 'user', content: '실외 활동' },
    { role: 'assistant', content: '함께하는 크루의 규모는 어느 정도가 편하세요?' },
    { role: 'user', content: '중규모 모임 (10-20명)' },
  ];

  const chips = formatSummaryChips(messages);
  assert.deepEqual(chips, [
    '전국 어디나',
    '분야 상관없음',
    '육체·과업·집중형',
    '기초 체력 필요',
    '실외 활동',
    '중규모 모임 (10-20명)',
  ]);
});

test('[요약 칩 포맷팅 검증] 프로필 재능 활용 확인 시 프로필 재능명이 칩으로 노출된다', () => {
  const messages = [
    { role: 'assistant', content: '활동 난이도는 어떤 것을 원하세요?' },
    { role: 'user', content: '전문지식/자격/재능 활용' },
    { role: 'assistant', content: '프로필에 [교육·멘토링] 재능이 있다고 알려주셨는데, 이 재능을 살릴 수 있는 액션을 찾아볼까요?' },
    { role: 'user', content: '예, 그럴게요 👍' },
  ];

  const chips = formatSummaryChips(messages);
  assert.deepEqual(chips, [
    '전문지식/자격/재능 활용',
    '교육·멘토링',
  ]);
});






