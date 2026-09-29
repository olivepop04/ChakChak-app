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
 * 핵심 규칙 (2026-09-01 개편 · 4번은 2026-09-29):
 *  1. MINIMUM 형에는 퍼센트를 쓰지 않는다.
 *     15/10 = 150% 는 사용자에게 아무 의미가 없다.
 *  2. RANGE 형의 분모는 "3~5명" 으로 끝까지 고정이다.
 *     예전에는 최소를 넘기면 분모가 min→max 로 바뀌었는데,
 *     숫자가 갑자기 변해서 오히려 헷갈린다는 지적을 받았다.
 *  3. 변수 뒤에 조사를 붙이지 않는다.
 *     "40포이 더 필요해요" 같은 오타가 나고, kg·EA·ml 같은
 *     영문 단위에서는 조사 규칙 자체가 성립하지 않는다.
 *     그래서 "목표까지 40포 남았어요" 처럼 조사가 안 붙는 문장만 쓴다.
 *  4. MINIMUM 형도 "현재 / 목표" 로 쓴다 — "35개 / 30개". 목표를 넘겨도 분모는 목표 그대로.
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
  /** "3 / 3~5명" 또는 "15명 / 10명" */
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

    // 최소형도 「현재 / 목표」 입니다 — `35개 / 30개` (2026-09-29 확정).
    //   9/22 소정님 개편으로 화면(QuotaProgress)이 먼저 이렇게 바뀌었고, 9/29 에 유지로 정했습니다.
    //   그 전 결정(9/17 결정 14)은 「N개 모였어요」 였는데, 화면이 바뀐 뒤로 어디에도 안 나와서 맞췄습니다.
    //   분모가 있으니 지금 모인 양인지 목표인지 헷갈리지 않습니다. 퍼센트는 여전히 쓰지 않습니다.
    return {
      countLabel: `${current}${unit} / ${min_required}${unit}`,
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
  const { type, target_type, min_required, max_allowed } = item;
  const noun = nounOf(type);

  // 1. 미달 완료: final < min_required
  if (final < min_required) {
    return '아쉽지만 다 채우지 못했어요.';
  }

  // 2. 초과 달성:
  // RANGE인 경우 max_allowed 초과, MINIMUM인 경우 min_required 초과
  const isOver =
    target_type === 'RANGE' && max_allowed
      ? final > max_allowed
      : final > min_required;

  if (isOver) {
    return `최소 ${noun}을 초과 달성했어요.`;
  }

  // 3. 정상 충족:
  return `모집 ${noun}을 충족했어요.`;
}

/** 결과 화면 수치 표기: 결과치 / 목표치 통일 (예: "18명 / 15명", "50개 / 50개", "4명 / 4~6명", "4명 / 5~8명") */
export function describeResultCount(item: QuotaItem, final: number): string {
  const { target_type, min_required, max_allowed, unit } = item;

  const denominator =
    target_type === 'RANGE' && max_allowed && max_allowed !== min_required
      ? `${min_required}~${max_allowed}${unit}`
      : `${min_required}${unit}`;

  return `${final}${unit} / ${denominator}`;
}

/** 결과 화면 게이지(그래프) 비율 및 상태 */
export function describeResultRatio(item: QuotaItem, final: number): {
  ratio: number;
  isMet: boolean;
  isOver: boolean;
} {
  const { target_type, min_required, max_allowed } = item;
  const isMet = final >= min_required;
  const isOver =
    target_type === 'RANGE' && max_allowed
      ? final > max_allowed
      : final > min_required;

  let ratio = 1;
  if (!isMet) {
    ratio = Math.max(min_required > 0 ? final / min_required : 0, 0.08);
  }

  return { ratio: Math.min(ratio, 1), isMet, isOver };
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
