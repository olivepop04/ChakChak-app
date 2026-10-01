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

test('이름이 일부만 겹치는 다른 구는 일치하지 않는다', () => {
  // 「부산 남구」 사용자에게 「서울 강남구」 가 가까운 지역으로 추천되던 것 (2026-10-01)
  assert.equal(
    matchesRegion('서울특별시 강남구 테헤란로 1', ['부산광역시 남구']),
    false,
  );
  assert.equal(
    matchesRegion('경기도 남양주시 경춘로 1', ['경기도 양주시']),
    false,
  );
  assert.equal(
    matchesRegion('서울특별시 성동구 왕십리로 100', ['부산광역시 동구']),
    false,
  );
});

test('같은 이름의 구라도 시도가 다르면 일치하지 않는다', () => {
  assert.equal(
    matchesRegion('대구광역시 남구 중앙대로 1', ['부산광역시 남구']),
    false,
  );
  assert.equal(
    matchesRegion('부산광역시 남구 유엔평화로 1', ['부산광역시 남구']),
    true,
  );
});

test('주소의 시도가 줄여 적혀 있어도 일치한다', () => {
  // 우편번호 검색은 '서울 강남구 …' 처럼 줄인 이름을 줍니다
  assert.equal(matchesRegion('서울 강남구 테헤란로 1', ['서울특별시 강남구']), true);
  assert.equal(matchesRegion('서울 강남구 테헤란로 1', ['서울특별시 전체']), true);
  assert.equal(matchesRegion('충북 청주시 상당로 1', ['충청북도 청주시']), true);
});

test('세종은 시도만 맞아도 일치한다', () => {
  // 시·도 아래 지역이 하나뿐이라 주소에 '세종시' 가 따로 안 적힙니다
  assert.equal(
    matchesRegion('세종특별자치시 한누리대로 2130', ['세종특별자치시 세종시']),
    true,
  );
});

test('주소에 시도가 없으면 시군구만으로 본다', () => {
  assert.equal(matchesRegion('강남구 테헤란로 1', ['서울특별시 강남구']), true);
  // 그 경우에도 토막 단위라 '강남구' 가 '남구' 로 걸리지 않는다
  assert.equal(matchesRegion('강남구 테헤란로 1', ['부산광역시 남구']), false);
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
