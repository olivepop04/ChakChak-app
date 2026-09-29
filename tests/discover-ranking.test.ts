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

  // 100점 만점 체계: 전문 재능 일치 5점 + 소규모 일치 10점 = 15점
  assert.equal(result.score, 15);
  assert.deepEqual(result.matched, ['사진 촬영 재능 활용', '10명 이내 소규모']);
});

test('분야 선호(±10점) 폐지로 과거 이력과 무관하게 점수 왜곡이 발생하지 않는다', () => {
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

  // 순위 왜곡을 유발하던 과거 이력 기반 ±10점 가산/감점 폐지 확인
  assert.equal(familiar.score, 0);
  assert.equal(novel.score, 0);
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

test('육체·과업·집중형 선택 시 과업형 액션에 10점이 부여되고 매칭 사유에 기록된다', () => {
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
  assert.equal(taskResult.score, 10);
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

test('교류·교육·소통형 선택 시 소통형 액션에 10점이 부여되고 매칭 사유에 기록된다', () => {
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
  assert.equal(result.score, 10);
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

test('100점 만점 체계: 모든 조건(지역25, 시간15, 분야25, 규모10, 성격10, 환경10, 재능5) 일치 시 정확히 100점을 받는다', () => {
  const profile: ScoringProfile = {
    categories: ['환경'],
    skills: ['사진 촬영'],
    historyCategories: [],
    timePrefs: [{ day: '주말', slots: ['오후'] }],
    availableTimes: [],
    regions: ['서울특별시 마포구'],
    followingIds: [],
  };

  const perfectAction = {
    id: 'act-perfect',
    title: '한강 플로깅 사진 기록',
    category: '환경',
    categories: ['환경'],
    address: '서울특별시 마포구 망원동',
    // 2026-10-03 토요일 14:00 KST (주말 오후)
    activityStartAt: '2026-10-03T14:00:00+09:00',
    owner: { id: 'host-normal', nickname: '일반호스트' },
  } as unknown as ActionCardData;

  const metadata = {
    participationModes: ['10명 이내 소그룹'],
    skills: ['사진 촬영'],
    groupSize: 8,
    targetGroups: ['교류·교육·소통형'],
    difficulty: '전문지식/자격/재능 활용',
    activityTypes: ['실내외 병행', '실외 활동'],
    keywords: ['플로깅', '사진'],
  };

  const answers = {
    category: '환경',
    categories: ['환경'],
    selectedRegion: '서울특별시 마포구',
    userTimePreferences: ['주말 오후'],
    groupSizePreference: 'small' as const,
    targetGroupPreference: 'social' as const,
    activityTypePreference: 'outdoor' as const,
    difficultyPreference: 'expert' as const,
    talentPreference: 'use' as const,
    selectedSkill: '사진 촬영',
    selectedSkills: ['사진 촬영'],
  };

  const scored = scoreAction(perfectAction, profile, answers, metadata);

  // 정규 7대 항목 일치 시 정확히 100점 만점
  assert.equal(scored.score, 100);
  assert.equal(scored.matched.includes('관심 분야(환경)'), true); // 25
  assert.equal(scored.matched.includes('가까운 지역'), true); // 25
  assert.equal(scored.matched.includes('주말 오후 활동'), true); // 15
  assert.equal(scored.matched.includes('10명 이내 소규모'), true); // 10
  assert.equal(scored.matched.includes('교류·소통형 활동'), true); // 10
  assert.equal(scored.matched.includes('실내외 병행 활동'), true); // 10
  assert.equal(scored.matched.includes('사진 촬영 재능 활용'), true); // 5

  // 팔로우 호스트 개설 액션일 경우 +5점 소셜 보너스 가산되어 105점이 된다
  const profileWithFollowing: ScoringProfile = {
    ...profile,
    followingIds: ['host-normal'],
  };
  const followedScore = scoreAction(perfectAction, profileWithFollowing, answers, metadata);
  assert.equal(followedScore.score, 105);
  assert.equal(followedScore.matched.includes('팔로우한 사람의 액션'), true);
});



