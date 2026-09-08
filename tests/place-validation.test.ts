import test from 'node:test';
import assert from 'node:assert/strict';
import { getPlaceErrors } from '../lib/utils/place-validation.ts';

test('주소와 장소명이 제대로 있으면 통과한다', () => {
  const errors = getPlaceErrors({
    address: '경기도 파주시 시청로 50',
    placeName: '파주시청',
  });
  assert.deepEqual(errors, []);
});

test('"파주" 처럼 한 마디만 적으면 막는다', () => {
  const errors = getPlaceErrors({ address: '파주', placeName: '파주시청' });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /파주/);
  assert.match(errors[0], /어디로 가야 할지/);
});

test('주소를 아예 안 적으면 막는다', () => {
  const errors = getPlaceErrors({ address: '', placeName: '파주시청' });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /주소를 입력/);
});

test('장소 이름을 안 적으면 막는다', () => {
  const errors = getPlaceErrors({
    address: '경기도 파주시 시청로 50',
    placeName: '   ',
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /장소 이름/);
});

test('둘 다 없으면 두 가지를 다 알려준다', () => {
  const errors = getPlaceErrors({ address: null, placeName: null });
  assert.equal(errors.length, 2);
});

test('시·도와 시·군·구만 있어도 통과한다 — 장소명이 구체적인 곳을 가리킨다', () => {
  // "부산광역시 중구" 는 두 마디 7글자. 정확한 지점은 장소명이 맡습니다.
  const errors = getPlaceErrors({
    address: '부산광역시 중구',
    placeName: '중구청 앞 광장',
  });
  assert.deepEqual(errors, []);
});

test('앞뒤 공백은 무시한다', () => {
  const errors = getPlaceErrors({
    address: '  경기도 파주시 시청로 50  ',
    placeName: '  파주시청  ',
  });
  assert.deepEqual(errors, []);
});
