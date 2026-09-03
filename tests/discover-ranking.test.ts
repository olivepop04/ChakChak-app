import test from 'node:test';
import assert from 'node:assert/strict';

import {
  sameProvince,
  scoreAdaptiveTraits,
} from '../lib/utils/discover-ranking.ts';

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
