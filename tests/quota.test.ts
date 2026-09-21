/**
 * 모집 수량 표시 규칙 (CLAUDE.md 「모집 수량 규칙」).
 *
 * 왜 이 파일이 생겼나 — 2026-09-17까지 `lib/utils/quota.ts` 를 검사하는 테스트가
 * **하나도 없었습니다.** 「가장 중요」 로 표시된 규칙인데, 문구·라벨을 바꿔도
 * `npm test` 는 전부 초록이었습니다. 실제로 문구 44건 라운드에서 이 파일이
 * 13줄 바뀐 것을 사람 눈으로 대조해야 했습니다.
 *
 * 그래서 **화면에 나가는 문자열을 그대로 고정**합니다. 문구를 일부러 바꿀 때는
 * 이 테스트도 같이 고치게 되고, 그때 「이게 규칙을 건드리는 변경인가」 를 한 번 보게 됩니다.
 *
 * 고정하는 것 (사람·물품 × 최소형·범위형 네 갈래)
 *   countLabel · hint · showPercent · ratio · isMinMet · isFull · canJoin
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getQuotaState,
  describeTarget,
  describeResult,
  describeResultCount,
  describeResultRatio,
  meetsGender,
} from '../lib/utils/quota.ts';
import type { QuotaItem } from '../lib/utils/quota.ts';

/** 사람 · 최소형 (계속 모집) */
const 사람최소: QuotaItem = {
  type: 'PERSON',
  name: '산책 도우미',
  target_type: 'MINIMUM',
  min_required: 5,
  max_allowed: null,
  unit: '명',
  gender_requirement: 'ANY',
};

/** 물품 · 최소형 */
const 물품최소: QuotaItem = {
  type: 'GOODS',
  name: '사료',
  target_type: 'MINIMUM',
  min_required: 10,
  max_allowed: null,
  unit: '포',
};

/** 사람 · 범위형 3~5명 */
const 사람범위: QuotaItem = {
  type: 'PERSON',
  name: '요리 담당',
  target_type: 'RANGE',
  min_required: 3,
  max_allowed: 5,
  unit: '명',
  gender_requirement: 'ANY',
};

/** 사람 · 정확히 3명 (min === max) */
const 사람정확: QuotaItem = {
  ...사람범위,
  name: '가이드',
  max_allowed: 3,
};

// ─────────────────────────────────────────────────────────────
// 규칙 ① 최소형에는 퍼센트를 쓰지 않는다
// ─────────────────────────────────────────────────────────────

test('최소형은 퍼센트를 쓰지 않는다 — 최소를 넘겨도', () => {
  for (const current of [0, 3, 5, 15]) {
    assert.equal(
      getQuotaState(사람최소, current).showPercent,
      false,
      `${current}명일 때도 showPercent 는 false 여야 합니다`,
    );
  }
});

test('최소형은 상한이 없어서 마감되지 않고, 언제나 신청할 수 있다', () => {
  const s = getQuotaState(사람최소, 999);
  assert.equal(s.isFull, false);
  assert.equal(s.canJoin, true);
});

test('최소형 비율은 최소를 넘기면 1 에서 멈춘다', () => {
  assert.equal(getQuotaState(사람최소, 0).ratio, 0);
  assert.equal(getQuotaState(사람최소, 1).ratio, 0.2);
  assert.equal(getQuotaState(사람최소, 5).ratio, 1);
  assert.equal(getQuotaState(사람최소, 50).ratio, 1, '150% 가 되지 않아야 합니다');
});

// ─────────────────────────────────────────────────────────────
// 규칙 ② 범위형 분모는 끝까지 고정이다 (2026-09-01 결정)
// ─────────────────────────────────────────────────────────────

test('범위형 분모는 최소를 넘겨도 바뀌지 않는다', () => {
  assert.equal(getQuotaState(사람범위, 2).countLabel, '2 / 3~5명');
  assert.equal(
    getQuotaState(사람범위, 3).countLabel,
    '3 / 3~5명',
    '최소(3)에 도달해도 분모가 5 로 바뀌면 안 됩니다',
  );
  assert.equal(getQuotaState(사람범위, 4).countLabel, '4 / 3~5명');
});

test('정확히 N명이면 분모를 한 숫자로 쓴다', () => {
  assert.equal(getQuotaState(사람정확, 1).countLabel, '1 / 3명');
  assert.equal(getQuotaState(사람정확, 3).countLabel, '3 / 3명');
});

test('범위형은 상한을 채우면 마감된다', () => {
  const s = getQuotaState(사람범위, 5);
  assert.equal(s.isFull, true);
  assert.equal(s.canJoin, false);
  assert.equal(s.hint, '모집이 완료됐어요. 다른 방식으로 참여해주세요');
});

// ─────────────────────────────────────────────────────────────
// 규칙 ③ 변수 뒤에 조사를 붙이지 않는다 + 화면 문구 고정
// ─────────────────────────────────────────────────────────────

test('사람 · 최소형 문구', () => {
  const 미달 = getQuotaState(사람최소, 3);
  assert.equal(미달.countLabel, '3명 참여');
  assert.equal(미달.hint, '목표까지 2명 남았어요');
  assert.equal(미달.isMinMet, false);

  const 달성 = getQuotaState(사람최소, 7);
  assert.equal(달성.countLabel, '7명 참여');
  assert.equal(달성.hint, '최소 인원은 채웠지만 더 많이 참여할수록 좋아요');
  assert.equal(달성.isMinMet, true);
});

test('물품 · 최소형 문구 — 「N개 모였어요」 (2026-09-17 결정 14)', () => {
  const 미달 = getQuotaState(물품최소, 4);
  assert.equal(
    미달.countLabel,
    '4포 모였어요',
    '「4포 모집」 이면 지금 모인 양인지 목표인지 구분되지 않습니다',
  );
  assert.equal(미달.hint, '목표까지 6포 남았어요');

  const 달성 = getQuotaState(물품최소, 12);
  assert.equal(달성.countLabel, '12포 모였어요');
  assert.equal(달성.hint, '최소 수량을 채웠지만 더 많이 모일수록 좋아요');
});

test('최소형 안내 두 갈래의 마침표가 엇갈리지 않는다', () => {
  const 사람 = getQuotaState(사람최소, 7).hint;
  const 물품 = getQuotaState(물품최소, 12).hint;
  assert.equal(
    사람.endsWith('.'),
    물품.endsWith('.'),
    '사람·물품 항목이 한 액션에 같이 있으면 두 줄이 나란히 보입니다',
  );
});

test('범위형 문구', () => {
  const 미달 = getQuotaState(사람범위, 1);
  assert.equal(미달.hint, '목표까지 2명 남았어요');

  const 달성 = getQuotaState(사람범위, 4);
  assert.equal(달성.hint, '최소 인원을 채웠지만 1명 더 함께할 수 있어요');
  assert.equal(달성.isMinMet, true);
  assert.equal(달성.isFull, false);
});

// ─────────────────────────────────────────────────────────────
// describeTarget · describeResult
// ─────────────────────────────────────────────────────────────

test('describeTarget — 모집 방식을 한 줄로', () => {
  assert.equal(describeTarget(사람최소), '최소 5명');
  assert.equal(describeTarget(물품최소), '최소 10포');
  assert.equal(describeTarget(사람범위), '3~5명');
  assert.equal(describeTarget(사람정확), '정확히 3명');
});

test('describeResult · describeResultCount · describeResultRatio — 첨부 표 명세 검증', () => {
  const 사람8명최소: QuotaItem = {
    type: 'PERSON',
    name: '봉사자',
    target_type: 'MINIMUM',
    min_required: 8,
    max_allowed: null,
    unit: '명',
  };

  const 물품50개최소: QuotaItem = {
    type: 'GOODS',
    name: '물품',
    target_type: 'MINIMUM',
    min_required: 50,
    max_allowed: null,
    unit: '개',
  };

  // ① 초과 달성 (예: 18명 / 15명, 1200장 / 1000장, 12명 / 8명)
  assert.equal(describeResult(사람8명최소, 12), '최소 인원을 초과 달성했어요.');
  assert.equal(describeResultCount(사람8명최소, 12), '12명 / 8명');
  const 초과비율 = describeResultRatio(사람8명최소, 12);
  assert.equal(초과비율.ratio, 1);
  assert.equal(초과비율.isMet, true);
  assert.equal(초과비율.isOver, true);

  // ② 정상 충족 (예: 50개 / 50개, 3명 / 3~5명)
  assert.equal(describeResult(물품50개최소, 50), '모집 수량을 충족했어요.');
  assert.equal(describeResultCount(물품50개최소, 50), '50개 / 50개');
  const 충족비율1 = describeResultRatio(물품50개최소, 50);
  assert.equal(충족비율1.ratio, 1);
  assert.equal(충족비율1.isMet, true);
  assert.equal(충족비율1.isOver, false);

  assert.equal(describeResult(사람범위, 3), '모집 인원을 충족했어요.');
  assert.equal(describeResultCount(사람범위, 3), '3명 / 3~5명');
  const 충족비율2 = describeResultRatio(사람범위, 3);
  assert.equal(충족비율2.ratio, 1);
  assert.equal(충족비율2.isMet, true);

  // ③ 미달 완료 (예: 6명 / 8명, 2명 / 3~5명)
  assert.equal(describeResult(사람8명최소, 6), '아쉽지만 다 채우지 못했어요.');
  assert.equal(describeResultCount(사람8명최소, 6), '6명 / 8명');
  const 미달비율 = describeResultRatio(사람8명최소, 6);
  assert.equal(미달비율.ratio, 0.75);
  assert.equal(미달비율.isMet, false);
  assert.equal(미달비율.isOver, false);
});

// ─────────────────────────────────────────────────────────────
// meetsGender — 항목별 성별 제한
// ─────────────────────────────────────────────────────────────

test('meetsGender — 항목의 제한과 사용자 성별을 견준다', () => {
  const 제한 = (req: 'ANY' | 'MALE' | 'FEMALE'): QuotaItem => ({
    ...사람범위,
    gender_requirement: req,
  });

  assert.equal(meetsGender(제한('ANY'), 'MALE'), true);
  assert.equal(meetsGender(제한('ANY'), 'FEMALE'), true);
  assert.equal(meetsGender(제한('MALE'), 'MALE'), true);
  assert.equal(meetsGender(제한('MALE'), 'FEMALE'), false);
  assert.equal(meetsGender(제한('FEMALE'), 'FEMALE'), true);
  assert.equal(meetsGender(제한('FEMALE'), 'MALE'), false);
});

test('meetsGender — 성별을 모르면 막지 않는다 (서버가 최종 판단)', () => {
  const 남성만: QuotaItem = { ...사람범위, gender_requirement: 'MALE' };
  assert.equal(
    meetsGender(남성만, null),
    true,
    '표시용 함수라 비회원·미입력을 화면에서 막지 않습니다. 최종 판단은 join_action RPC 가 합니다',
  );
  assert.equal(meetsGender(남성만, undefined), true);
});
