import test from 'node:test';
import assert from 'node:assert/strict';

import {
  sameProvince,
  scoreAdaptiveTraits,
} from '../lib/utils/discover-ranking.ts';
import { scoreAction, type ScoringProfile } from '../lib/utils/scoring.ts';
import type { ActionCardData } from '../lib/types/view.ts';

test('재능 활용과 소규모 선호가 모두 맞는 액션이 추가 점수를 받는다', () => {
  const result = scoreAdaptiveTraits({
    profileSkills: ['사진 촬영'],
    historyCategories: [],
    actionCategory: '동물',
    actionSkills: ['사진 촬영'],
    actionGroupSize: 8,
    answers: {
      talentPreference: 'use',
      groupSizePreference: 'small',
      fieldPreference: null,
    },
  });

  assert.equal(result.score, 25);
  assert.deepEqual(result.matched, ['사진 촬영 재능 활용', '10명 이내 소규모']);
});

test('새 분야 선호자는 과거에 없던 카테고리를 더 높게 평가한다', () => {
  const familiar = scoreAdaptiveTraits({
    profileSkills: [],
    historyCategories: ['동물'],
    actionCategory: '동물',
    actionSkills: [],
    actionGroupSize: null,
    answers: {
      talentPreference: null,
      groupSizePreference: null,
      fieldPreference: 'new',
    },
  });
  const novel = scoreAdaptiveTraits({
    profileSkills: [],
    historyCategories: ['동물'],
    actionCategory: '환경',
    actionSkills: [],
    actionGroupSize: null,
    answers: {
      talentPreference: null,
      groupSizePreference: null,
      fieldPreference: 'new',
    },
  });

  assert.equal(familiar.score, -10);
  assert.equal(novel.score, 10);
});

test('같은 시도 이동 범위는 구가 달라도 광역 단위가 같으면 맞는다', () => {
  assert.equal(
    sameProvince('서울특별시 성동구 왕십리로', ['서울특별시 강남구']),
    true,
  );
  assert.equal(
    sameProvince('경기도 수원시 팔달구', ['서울특별시 강남구']),
    false,
  );
});

test('육체·과업·집중형 선택 시 과업형 액션에 15점이 부여되고 매칭 사유에 기록된다', () => {
  const taskResult = scoreAdaptiveTraits({
    profileSkills: [],
    historyCategories: [],
    actionCategory: '환경',
    actionSkills: [],
    actionGroupSize: null,
    actionTargetGroups: ['육체·과업·집중형'],
    answers: {
      talentPreference: null,
      groupSizePreference: null,
      fieldPreference: null,
      targetGroupPreference: 'task',
    },
  });
  assert.equal(taskResult.score, 15);
  assert.deepEqual(taskResult.matched, ['과업·집중형 활동']);

  const socialResult = scoreAdaptiveTraits({
    profileSkills: [],
    historyCategories: [],
    actionCategory: '노인',
    actionSkills: [],
    actionGroupSize: null,
    actionTargetGroups: ['교류·교육·소통형'],
    answers: {
      talentPreference: null,
      groupSizePreference: null,
      fieldPreference: null,
      targetGroupPreference: 'task',
    },
  });
  // 육체과업형을 골랐는데 소통형 액션인 경우 0점이며 매칭 사유에 포함되지 않는다
  assert.equal(socialResult.score, 0);
  assert.equal(socialResult.matched.includes('과업·집중형 활동'), false);
});

test('교류·교육·소통형 선택 시 소통형 액션에 15점이 부여되고 매칭 사유에 기록된다', () => {
  const result = scoreAdaptiveTraits({
    profileSkills: [],
    historyCategories: [],
    actionCategory: '노인',
    actionSkills: [],
    actionGroupSize: null,
    actionTargetGroups: ['교류·교육·소통형'],
    answers: {
      talentPreference: null,
      groupSizePreference: null,
      fieldPreference: null,
      targetGroupPreference: 'social',
    },
  });
  assert.equal(result.score, 15);
  assert.deepEqual(result.matched, ['교류·소통형 활동']);
});

test('환경 선호(실내/실외/실내외 병행)가 액션 메타데이터와 올바르게 매칭된다', () => {
  const indoorMatch = scoreAdaptiveTraits({
    profileSkills: [],
    historyCategories: [],
    actionCategory: '교육',
    actionSkills: [],
    actionGroupSize: null,
    actionActivityTypes: ['실내 활동'],
    answers: {
      talentPreference: null,
      groupSizePreference: null,
      fieldPreference: null,
      activityTypePreference: 'indoor',
    },
  });
  assert.equal(indoorMatch.score, 10);
  assert.deepEqual(indoorMatch.matched, ['실내 활동']);

  const outdoorMatch = scoreAdaptiveTraits({
    profileSkills: [],
    historyCategories: [],
    actionCategory: '환경',
    actionSkills: [],
    actionGroupSize: null,
    actionActivityTypes: ['실외 활동'],
    answers: {
      talentPreference: null,
      groupSizePreference: null,
      fieldPreference: null,
      activityTypePreference: 'outdoor',
    },
  });
  assert.equal(outdoorMatch.score, 10);
  assert.deepEqual(outdoorMatch.matched, ['야외 활동']);
});

test('모임 규모가 actionParticipationModes 문자열 메타데이터로도 정확히 매칭된다', () => {
  const result = scoreAdaptiveTraits({
    profileSkills: [],
    historyCategories: [],
    actionCategory: '지역사회',
    actionSkills: [],
    actionGroupSize: null, // 인원수 컬럼이 비어있어도
    actionParticipationModes: ['10명 이내 소그룹'], // 메타데이터로 매칭
    answers: {
      talentPreference: null,
      groupSizePreference: 'small',
      fieldPreference: null,
    },
  });
  assert.equal(result.score, 10);
  assert.deepEqual(result.matched, ['10명 이내 소규모']);
});

test('사용자가 인터뷰에서 장애/환경을 골랐다면 프로필에 동물이 있어도 동물 액션에 관심분야 점수가 들어가지 않는다', () => {
  const profile: ScoringProfile = {
    categories: ['동물'], // 가입 시 등록했던 프로필 카테고리
    skills: [],
    historyCategories: [],
    timePrefs: [],
    availableTimes: [],
    regions: [],
    followingIds: [],
  };

  const animalAction = {
    id: 'act-animal',
    title: '유기견 산책',
    category: '동물',
    categories: ['동물'],
    address: '서울특별시 마포구',
    activityStartAt: null,
    owner: { id: 'host-1', nickname: '호스트' },
  } as unknown as ActionCardData;

  const envAction = {
    id: 'act-env',
    title: '플로깅',
    category: '환경',
    categories: ['환경'],
    address: '서울특별시 마포구',
    activityStartAt: null,
    owner: { id: 'host-2', nickname: '호스트' },
  } as unknown as ActionCardData;

  // 사용자가 이번 인터뷰에서 '장애, 환경'을 선택함
  const scoringAnswers = {
    categories: ['장애', '환경'],
    category: '장애',
  };

  const animalScore = scoreAction(animalAction, profile, scoringAnswers);
  const envScore = scoreAction(envAction, profile, scoringAnswers);

  // 동물 액션은 관심분야 점수 25점을 받지 못해야 함
  assert.equal(animalScore.matched.some((m) => m.includes('관심 분야')), false);
  // 환경 액션은 관심분야 점수 25점을 받아야 함
  assert.equal(envScore.matched.includes('관심 분야(환경)'), true);
  assert.equal(envScore.score >= 25, true);
});


