import test from 'node:test';
import assert from 'node:assert/strict';
import { getPlaceErrors, getPlaceWarnings } from '../lib/utils/place-validation.ts';

// ── getPlaceErrors : 비어 있는 것만 막습니다 ──────────────────────────

test('주소와 장소명이 제대로 있으면 통과한다', () => {
  assert.deepEqual(
    getPlaceErrors({ address: '경기도 파주시 시청로 50', placeName: '파주시청' }),
    [],
  );
});

test('주소를 아예 안 적으면 막는다', () => {
  const errors = getPlaceErrors({ address: '', placeName: '파주시청' });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /주소를 알려주세요/);
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
  assert.equal(getPlaceErrors({ address: null, placeName: null }).length, 2);
});

test('"파주" 처럼 짧아도 공개를 막지는 않는다 (2026-09-09)', () => {
  // 예전에는 여기서 막았습니다. 지금은 알려만 주고 호스트가 정합니다.
  assert.deepEqual(getPlaceErrors({ address: '파주', placeName: '파주시청' }), []);
});

test('앞뒤 공백은 무시한다', () => {
  assert.deepEqual(
    getPlaceErrors({ address: '   ', placeName: '  파주시청  ' }).length,
    1,
  );
});

// ── getPlaceWarnings : 찾아가기 어려워 보이는 것 ──────────────────────

test('"파주" 한 마디면 찾아가기 어렵다고 알려준다', () => {
  const warnings = getPlaceWarnings({ address: '파주' });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /파주/);
  assert.match(warnings[0], /어디로 가야 할지/);
});

test('알려주는 문장은 호스트를 탓하지 않는다', () => {
  const [message] = getPlaceWarnings({ address: '서울' });
  assert.doesNotMatch(message, /공개할 수 없|잘못|불충분/);
  assert.match(message, /쉬워져요/);
});

test('도로명 주소는 아무 말도 하지 않는다', () => {
  assert.deepEqual(getPlaceWarnings({ address: '경기도 파주시 시청로 50' }), []);
});

test('시·도와 시·군·구만 있어도 충분하다 — 정확한 지점은 장소명이 맡는다', () => {
  // "부산광역시 중구" 는 두 마디 7글자.
  assert.deepEqual(getPlaceWarnings({ address: '부산광역시 중구' }), []);
});

test('주소가 비었을 때는 여기서 다루지 않는다 — getPlaceErrors 담당', () => {
  assert.deepEqual(getPlaceWarnings({ address: '' }), []);
  assert.deepEqual(getPlaceWarnings({ address: null }), []);
});

test('앞뒤 공백을 지운 뒤에 본다', () => {
  assert.deepEqual(getPlaceWarnings({ address: '  경기도 파주시 시청로 50  ' }), []);
});
