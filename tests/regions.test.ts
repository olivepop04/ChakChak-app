import test from 'node:test';
import assert from 'node:assert/strict';

import {
  matchesRegion,
  mergeRegionSelection,
} from '../lib/constants/regions.ts';

test('서울특별시 전체는 서울의 어느 구에 있는 액션과도 일치한다', () => {
  assert.equal(
    matchesRegion('서울특별시 성동구 왕십리로 100', ['서울특별시 전체']),
    true,
  );
  assert.equal(
    matchesRegion('경기도 성남시 분당구 판교로 1', ['서울특별시 전체']),
    false,
  );
});

test('기존 시군구 선택은 그대로 해당 지역만 일치한다', () => {
  assert.equal(
    matchesRegion('서울특별시 성동구 왕십리로 100', ['서울특별시 성동구']),
    true,
  );
  assert.equal(
    matchesRegion('서울특별시 강남구 테헤란로 1', ['서울특별시 성동구']),
    false,
  );
});

test('시도 전체를 고르면 같은 시도의 세부 지역은 하나로 정리한다', () => {
  assert.deepEqual(
    mergeRegionSelection(
      ['서울특별시 성동구', '서울특별시 강남구', '부산광역시 해운대구'],
      '서울특별시 전체',
      5,
    ),
    ['부산광역시 해운대구', '서울특별시 전체'],
  );
});

test('세부 지역을 고르면 같은 시도의 전체 선택을 세부 지역으로 바꾼다', () => {
  assert.deepEqual(
    mergeRegionSelection(
      ['서울특별시 전체', '부산광역시 해운대구'],
      '서울특별시 성동구',
      5,
    ),
    ['부산광역시 해운대구', '서울특별시 성동구'],
  );
});
