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
 * 핵심 규칙 두 개:
 *  1. MINIMUM 형에는 퍼센트를 쓰지 않는다.
 *     15/10 = 150% 는 사용자에게 아무 의미가 없다.
 *  2. RANGE 형에서 최소 인원을 넘기면 분모가 min 에서 max 로 바뀐다.
 *     "2 / 3명" → (3명 도달) → "3 / 5명"
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
  /** "3 / 5명" 또는 "15명 참여" */
  countLabel: string;
  /** "최소 인원이 충족되었어요." 같은 안내 한 줄 */
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
  const { target_type, min_required, max_allowed, unit } = item;
  const isMinMet = current >= min_required;

  // ── 최소 인원형: 퍼센트를 쓰지 않는다 ──────────────────────────
  if (target_type === 'MINIMUM') {
    const remaining = min_required - current;

    let hint: string;
    if (!isMinMet) {
      hint = `최소 ${remaining}${unit}이 더 필요해요.`;
    } else if (current >= min_required * 2) {
      hint = '함께하는 Crew가 계속 늘고 있어요.';
    } else if (current > min_required) {
      hint = '최소 인원이 충족되었어요. 더 많은 Crew가 함께할 수 있어요.';
    } else {
      hint = '최소 인원이 충족되었어요.';
    }

    return {
      countLabel: `${current}${unit} 참여`,
      hint,
      ratio: isMinMet ? 1 : current / min_required,
      showPercent: false,
      isMinMet,
      isFull: false, // 상한이 없으므로 마감되지 않는다
      canJoin: true,
    };
  }

  // ── 정해진 인원형 ──────────────────────────────────────────────
  const max = max_allowed ?? min_required;
  const isFull = current >= max;
  // 최소를 넘기기 전에는 분모가 min, 넘기면 max
  const denominator = isMinMet ? max : min_required;
  const isExact = max === min_required;

  let hint: string;
  if (isFull) {
    hint = isExact ? '모집이 완료되었어요.' : '모집이 완료되었어요.';
  } else if (isMinMet) {
    const left = max - current;
    hint = `필요한 최소 인원이 충족되었어요. ${left}자리 남음`;
  } else {
    const need = min_required - current;
    hint = `${need}${unit} 더 필요해요.`;
  }

  return {
    countLabel: `${current} / ${denominator}${unit}`,
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
  const { target_type, min_required, max_allowed, unit } = item;

  if (target_type === 'MINIMUM') {
    return final >= min_required
      ? '최소 인원을 충족했습니다.'
      : `최소 인원에 ${min_required - final}${unit} 모자랐습니다.`;
  }
  if (max_allowed === min_required) {
    return final >= min_required
      ? '모집 인원을 충족했습니다.'
      : `모집 인원에 ${min_required - final}${unit} 모자랐습니다.`;
  }
  return final >= min_required
    ? `최소 인원은 충족했으며, 총 ${final}${unit}이 참여했습니다.`
    : `최소 인원에 ${min_required - final}${unit} 모자랐습니다.`;
}

/** 결과 화면 상단 숫자: "15명" 또는 "3명 / 3명" */
export function describeResultCount(item: QuotaItem, final: number): string {
  if (item.target_type === 'MINIMUM') {
    return `${final}${item.unit}`;
  }
  return `${final}${item.unit} / ${item.max_allowed}${item.unit}`;
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
