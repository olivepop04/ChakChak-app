/**
 * 모집 수량 표시 규칙.
 *
 * 팀 합의(2026-08-31) — 모집 방식은 딱 두 가지다.
 *
 *   target_type  min  max    의미
 *   RANGE        3    3      정확히 3명
 *   RANGE        3    5      3~5명
 *   MINIMUM      10   null   최소 10명, 계속 모집
 *
 * 핵심 규칙 세 개 (2026-09-01 개편):
 *  1. MINIMUM 형에는 퍼센트를 쓰지 않는다.
 *     15/10 = 150% 는 사용자에게 아무 의미가 없다.
 *  2. RANGE 형의 분모는 "3~5명" 으로 끝까지 고정이다.
 *     예전에는 최소를 넘기면 분모가 min→max 로 바뀌었는데,
 *     숫자가 갑자기 변해서 오히려 헷갈린다는 지적을 받았다.
 *  3. 변수 뒤에 조사를 붙이지 않는다.
 *     "40포이 더 필요해요" 같은 오타가 나고, kg·EA·ml 같은
 *     영문 단위에서는 조사 규칙 자체가 성립하지 않는다.
 *     그래서 "목표까지 40포 남았어요" 처럼 조사가 안 붙는 문장만 쓴다.
 *
 * 화면에서 이 함수를 거치지 않고 직접 숫자를 조합하지 말 것.
 * 그리고 신청 가능 여부의 최종 판단은 서버(join_action RPC)가 한다.
 * 여기 canJoin 은 버튼을 비활성화하기 위한 표시용이다.
 */

import type { ItemType, TargetType, GenderRequirement } from '@/lib/constants';

export interface QuotaItem {
  type: ItemType;
  name: string;
  target_type: TargetType;
  min_required: number;
  max_allowed: number | null;
  unit: string;
  gender_requirement?: GenderRequirement;
}

export interface QuotaState {
  /** "3 / 3~5명" 또는 "15명 참여" */
  countLabel: string;
  /** "목표까지 2명 남았어요" 같은 안내 한 줄 */
  hint: string;
  /** 프로그레스바 채움 비율 0~1. MINIMUM 이 최소를 넘기면 항상 1 */
  ratio: number;
  /** 퍼센트 숫자를 화면에 쓸 수 있는가 (MINIMUM 은 false) */
  showPercent: boolean;
  isMinMet: boolean;
  isFull: boolean;
  /** 표시용. 최종 판단은 서버가 한다 */
  canJoin: boolean;
}

/** 사람이면 "인원", 물품이면 "수량" — 문구가 갈린다 */
function nounOf(type: ItemType): string {
  return type === 'PERSON' ? '인원' : '수량';
}

/** 모집 조건을 한 줄로: "정확히 3명" / "3~5명" / "최소 10명" */
export function describeTarget(item: QuotaItem): string {
  const { target_type, min_required, max_allowed, unit } = item;

  if (target_type === 'MINIMUM') {
    return `최소 ${min_required}${unit}`;
  }
  if (max_allowed === min_required) {
    return `정확히 ${min_required}${unit}`;
  }
  return `${min_required}~${max_allowed}${unit}`;
}

export function getQuotaState(item: QuotaItem, current: number): QuotaState {
  const { type, target_type, min_required, max_allowed, unit } = item;
  const isMinMet = current >= min_required;

  // ── 최소 수량형: 퍼센트를 쓰지 않는다 ──────────────────────────
  if (target_type === 'MINIMUM') {
    const remaining = min_required - current;

    const hint = !isMinMet
      ? `목표까지 ${remaining}${unit} 남았어요`
      : type === 'PERSON'
        ? '최소 인원은 채웠지만 더 많이 참여할수록 좋아요'
        : '최소 수량을 채웠지만 더 많이 모일수록 좋아요';

    // 물품은 「N개 모였어요」 입니다 (2026-09-17 결정 14).
    //   같은 카드에 describeTarget 의 「최소 10개」 가 함께 나오는데,
    //   「4개 모집」 이면 4가 지금 모인 양인지 모집 목표인지 구분되지 않습니다.
    //   RANGE 는 `5 / 3~10개` 라 분자·분모가 드러나는데 MINIMUM 만 조사 없는 명사였습니다.
    return {
      countLabel:
        type === 'PERSON'
          ? `${current}${unit} 참여`
          : `${current}${unit} 모였어요`,
      hint,
      ratio: isMinMet ? 1 : current / min_required,
      showPercent: false,
      isMinMet,
      isFull: false, // 상한이 없으므로 마감되지 않는다
      canJoin: true,
    };
  }

  // ── 정해진 수량형 ──────────────────────────────────────────────
  const max = max_allowed ?? min_required;
  const isFull = current >= max;
  const isExact = max === min_required;

  let hint: string;
  if (isFull) {
    hint = '모집이 완료됐어요. 다른 방식으로 참여해주세요';
  } else if (isMinMet) {
    const left = max - current;
    hint =
      type === 'PERSON'
        ? `최소 인원을 채웠지만 ${left}${unit} 더 함께할 수 있어요`
        : `최소 수량을 채웠지만 ${left}${unit} 더 신청할 수 있어요`;
  } else {
    const need = min_required - current;
    hint = `목표까지 ${need}${unit} 남았어요`;
  }

  // 분모는 "3~5명" 으로 고정. 정확히 N명이면 "3명"
  const denominator = isExact
    ? `${min_required}${unit}`
    : `${min_required}~${max}${unit}`;

  return {
    countLabel: `${current} / ${denominator}`,
    hint,
    ratio: Math.min(current / max, 1),
    showPercent: true,
    isMinMet,
    isFull,
    canJoin: !isFull,
  };
}

/** 결과 화면 문장 */
export function describeResult(item: QuotaItem, final: number): string {
  const { type, target_type, min_required, max_allowed, unit } = item;
  const noun = nounOf(type);
  const short = min_required - final;

  if (final < min_required) {
    return `목표까지 ${short}${unit} 모자랐습니다.`;
  }
  if (target_type === 'RANGE' && max_allowed === min_required) {
    return `모집 ${noun}을 충족했습니다.`;
  }
  return `최소 ${noun}을 충족했습니다. 최종 ${final}${unit}.`;
}

/** 결과 화면 상단 숫자: "15명" 또는 "3명 / 3~5명" */
export function describeResultCount(item: QuotaItem, final: number): string {
  const { target_type, min_required, max_allowed, unit } = item;

  if (target_type === 'MINIMUM') {
    return `${final}${unit}`;
  }
  const max = max_allowed ?? min_required;
  const denominator =
    max === min_required ? `${min_required}${unit}` : `${min_required}~${max}${unit}`;
  return `${final}${unit} / ${denominator}`;
}

/**
 * 성별 조건이 맞는지. 표시용이며 최종 판단은 서버가 한다.
 * gender 가 없으면(비로그인) 일단 통과시키고 로그인 뒤에 확인한다.
 */
export function meetsGender(
  item: QuotaItem,
  userGender: 'MALE' | 'FEMALE' | null | undefined,
): boolean {
  const req = item.gender_requirement ?? 'ANY';
  if (req === 'ANY') return true;
  if (!userGender) return true;
  return req === userGender;
}
