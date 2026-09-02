/**
 * 추천 점수 계산.
 *
 * ★ 점수는 코드가 계산합니다. AI 는 의도 해석과 추천 이유 설명만 합니다.
 *   AI 에게 순위를 매기게 하면 매번 결과가 달라져서 검증할 수 없습니다.
 *
 * 배점 (합계 100)
 *   관심 카테고리 일치      30
 *   활동 가능 지역 일치      25
 *   참여 가능 요일 일치      20
 *   참여 방식 일치          15
 *   팔로우한 사람의 액션     10
 *
 * 거리(km)는 계산하지 않습니다. 액션에 좌표가 없고, 지오코딩을 붙이면
 * MVP 범위를 넘어섭니다. 시·군·구 이름이 겹치는지로만 봅니다 (팀 합의 D13).
 */
import { matchesRegion, NATIONWIDE } from '@/lib/constants/regions';
import { isWeekend } from '@/lib/utils/date';
import type { TimePref, TimeSlot } from '@/lib/constants';
import type { ActionCardData } from '@/lib/types/view';

export interface ScoringProfile {
  categories: string[];
  /** 새 2단계 참여 가능 시간. 있으면 이 값을 우선 사용합니다. */
  timePrefs: TimePref[];
  /** 아직 time_prefs 가 없는 기존 회원을 위한 이전 값 */
  availableTimes: string[];
  regions: string[];
  /** 내가 팔로우하는 사람들의 id */
  followingIds: string[];
}

export interface ScoringAnswers {
  /** 사용자가 Discover 에서 고른 참여 방식 */
  participationMode?: string | null;
  /** 사용자가 고른 관심 분야 */
  category?: string | null;
  /** 'near' | 'city' | 'any' */
  range?: string | null;
}

export interface ScoredAction {
  action: ActionCardData;
  score: number;
  /** 어떤 항목에서 점수를 받았는지. 추천 이유를 만들 때 AI 에게 넘깁니다. */
  matched: string[];
}

/** 액션의 참여 방식을 대략 추정합니다 (AI 색인이 없을 때의 대비책) */
function guessMode(action: ActionCardData): string {
  return action.category === '환경' ? '직접 행동으로' : '시간을 내서';
}

function getTimeSlot(iso: string | null): TimeSlot | null {
  if (!iso) return null;
  const hour = new Date(iso).getHours();
  if (hour >= 5 && hour < 12) return '오전';
  if (hour >= 12 && hour < 18) return '오후';
  if (hour >= 18 && hour < 22) return '저녁';
  return '밤';
}

function matchesTimePreference(
  action: ActionCardData,
  preferences: TimePref[],
): { matched: boolean; label: string } {
  if (!action.activityStartAt || preferences.length === 0) {
    return { matched: false, label: '' };
  }

  const day = isWeekend(action.activityStartAt) ? '주말' : '평일';
  const slot = getTimeSlot(action.activityStartAt);
  const found = preferences.find((preference) => {
    const dayMatches = preference.day === '상관없음' || preference.day === day;
    const slotMatches =
      preference.slots.length === 0 ||
      preference.slots.includes('상관없음') ||
      (slot !== null && preference.slots.includes(slot));
    return dayMatches && slotMatches;
  });

  if (!found) return { matched: false, label: '' };
  const label = slot ? `${day} ${slot} 활동` : `${day} 활동`;
  return { matched: true, label };
}

export function scoreAction(
  action: ActionCardData,
  profile: ScoringProfile,
  answers: ScoringAnswers,
  aiModes: string[] = [],
): ScoredAction {
  let score = 0;
  const matched: string[] = [];

  // 1) 관심 카테고리 — 프로필과 이번 답변 둘 다 봅니다
  //
  // '전체' 는 "가리지 않는다" 는 뜻이므로 어떤 카테고리와도 맞는 것으로 봅니다.
  // 이 방어가 없으면 '전체' 를 고른 사람은 8개 중 어느 것과도 안 맞아
  // 관심 분야 30점이 영구히 0점이 됩니다. 에러가 안 나서 알아채기 어렵습니다.
  const wanted = new Set(
    [...profile.categories, answers.category].filter(Boolean) as string[],
  );
  const wantsAll = wanted.has('전체');
  if (wantsAll || wanted.has(action.category)) {
    score += 30;
    matched.push(wantsAll ? '관심 분야' : `관심 분야(${action.category})`);
  }

  // 2) 활동 가능 지역
  if (answers.range === 'any' || profile.regions.includes(NATIONWIDE)) {
    score += 25 * 0.6; // 어디든 좋다면 지역 점수는 절반만 (변별력이 없으므로)
  } else if (matchesRegion(action.address, profile.regions)) {
    score += 25;
    matched.push('가까운 지역');
  }

  // 3) 참여 가능 요일·시간대 — 새 2단계 설정을 우선 사용합니다.
  // 아직 time_prefs 가 비어 있는 기존 회원만 available_times 로 보완합니다.
  const timeMatch = matchesTimePreference(action, profile.timePrefs);
  const weekend = isWeekend(action.activityStartAt);
  const legacyTimeMatch =
    profile.timePrefs.length === 0 &&
    ((weekend && profile.availableTimes.includes('주말')) ||
      (!weekend && profile.availableTimes.includes('평일')) ||
      profile.availableTimes.includes('시간이 생길 때마다'));
  if (timeMatch.matched || legacyTimeMatch) {
    score += 20;
    matched.push(timeMatch.label || (weekend ? '주말 활동' : '평일 활동'));
  }

  // 4) 참여 방식
  const modes = aiModes.length > 0 ? aiModes : [guessMode(action)];
  if (answers.participationMode && modes.includes(answers.participationMode)) {
    score += 15;
    matched.push(answers.participationMode);
  }

  // 5) 팔로우한 사람이 만든 액션
  if (profile.followingIds.includes(action.owner.id)) {
    score += 10;
    matched.push('팔로우한 사람의 액션');
  }

  return { action, score: Math.round(score), matched };
}

/** 점수 높은 순으로 정렬해 상위 N개를 돌려줍니다 */
export function rankActions(
  actions: ActionCardData[],
  profile: ScoringProfile,
  answers: ScoringAnswers,
  modesByAction: Record<string, string[]> = {},
  take = 3,
): ScoredAction[] {
  return actions
    .map((a) => scoreAction(a, profile, answers, modesByAction[a.id] ?? []))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // 점수가 같으면 활동일이 가까운 것을 먼저
      const at = a.action.activityStartAt ?? '';
      const bt = b.action.activityStartAt ?? '';
      return at.localeCompare(bt);
    })
    .slice(0, take);
}

/** AI 가 실패했을 때 쓰는 기본 추천 이유 */
export function fallbackReason(scored: ScoredAction): string {
  if (scored.matched.length === 0) {
    return `${scored.action.category} 분야의 액션이에요.`;
  }
  return `${scored.matched.slice(0, 2).join(' · ')} 조건에 맞아요.`;
}
