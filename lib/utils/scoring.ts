/**
 * 추천 점수 계산.
 *
 * ★ 점수는 코드가 계산합니다. AI 는 의도 해석과 추천 이유 설명만 합니다.
 *   AI 에게 순위를 매기게 하면 매번 결과가 달라져서 검증할 수 없습니다.
 *
 * 2026-09-03 회의에서 확정한 V4 최소 범위
 *   관심 분야 25 · 재능 활용 15 · 지역/이동 20 · 시간 15
 *   모임 규모 10 · 참여 방식 10 · 팔로우 5 · 분야 선호 ±10
 *
 * 거리(km)는 계산하지 않습니다. 액션에 좌표가 없고, 지오코딩을 붙이면
 * MVP 범위를 넘어섭니다. 시·군·구 이름이 겹치는지로만 봅니다 (팀 합의 D13).
 */
import { matchesRegion, NATIONWIDE } from '@/lib/constants/regions';
import { isWeekend } from '@/lib/utils/date';
import type { TimePref, TimeSlot } from '@/lib/constants';
import type { ActionCardData } from '@/lib/types/view';
import {
  sameProvince,
  scoreAdaptiveTraits,
  type AdaptiveScoringAnswers,
} from '@/lib/utils/discover-ranking';

export interface ScoringProfile {
  categories: string[];
  skills: string[];
  historyCategories: string[];
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
  talentPreference?: AdaptiveScoringAnswers['talentPreference'];
  groupSizePreference?: AdaptiveScoringAnswers['groupSizePreference'];
  fieldPreference?: AdaptiveScoringAnswers['fieldPreference'];
  travelRange?: 'exact' | 'province' | 'any' | null;
}

export interface ActionScoringMetadata {
  participationModes: string[];
  skills: string[];
  /** 사람 모집 항목의 최대 인원 합계. 최소 모집이면 min_required 합계 */
  groupSize: number | null;
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

/**
 * 시간대(오전·오후·저녁·밤)는 한국 시각으로 봅니다.
 *
 * 이 파일은 서버 라우트(`app/api/ai/discover`)에서만 돕니다. 배포 서버는 UTC 라서
 * `new Date(iso).getHours()` 가 9시간 어긋났습니다 — 토요일 오전 10시 활동이
 * 「밤」 으로 판정돼, 「주말 오전」 만 가능한 사람에게 시간 점수 15점이
 * 통째로 안 붙었습니다 (TZ 를 바꿔 실측). 우리 PC 는 KST 라 로컬에서는
 * 재현되지 않습니다.
 *
 * 요일 판정은 `lib/utils/date.ts` 의 `isWeekend` 가 2026-09-24 에 KST 로
 * 고정됐으므로 그대로 씁니다. 여기서는 시각 판정만 맞춥니다.
 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function getTimeSlot(iso: string | null): TimeSlot | null {
  if (!iso) return null;
  const hour = new Date(new Date(iso).getTime() + KST_OFFSET_MS).getUTCHours();
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
  metadata: ActionScoringMetadata = {
    participationModes: [],
    skills: [],
    groupSize: null,
  },
): ScoredAction {
  let score = 0;
  const matched: string[] = [];

  // 1) 관심 카테고리 — 프로필과 이번 답변 둘 다 봅니다
  //
  // '전체' 는 "가리지 않는다" 는 뜻이므로 어떤 카테고리와도 맞는 것으로 봅니다.
  // 이 방어가 없으면 '전체' 를 고른 사람은 8개 중 어느 것과도 안 맞아
  // 관심 분야 25점이 영구히 0점이 됩니다. 에러가 안 나서 알아채기 어렵습니다.
  const wanted = new Set(
    [...profile.categories, answers.category].filter(Boolean) as string[],
  );
  const wantsAll = wanted.has('전체');
  // 액션이 카테고리를 여러 개 가질 수 있습니다 (14).
  // 그중 하나라도 관심 분야면 점수를 줍니다. 대표만 보면
  // 두 번째 카테고리가 내 관심사인 액션이 추천에서 밀립니다.
  const actionCats = action.categories?.length
    ? action.categories
    : [action.category];
  const hit = actionCats.find((c) => wanted.has(c));
  if (wantsAll || hit) {
    score += 25;
    matched.push(wantsAll ? '관심 분야' : `관심 분야(${hit})`);
  }

  // 2) 활동 가능 지역
  const travelRange = answers.travelRange ?? answers.range;
  if (travelRange === 'any' || profile.regions.includes(NATIONWIDE)) {
    score += 12;
    matched.push('지역 상관없음');
  } else if (matchesRegion(action.address, profile.regions)) {
    score += 20;
    matched.push('가까운 지역');
  } else if (
    travelRange === 'province' &&
    sameProvince(action.address, profile.regions)
  ) {
    score += 16;
    matched.push('같은 시·도');
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
    score += 15;
    matched.push(timeMatch.label || (weekend ? '주말 활동' : '평일 활동'));
  }

  // 4) 참여 방식
  const modes =
    metadata.participationModes.length > 0
      ? metadata.participationModes
      : [guessMode(action)];
  if (answers.participationMode && modes.includes(answers.participationMode)) {
    score += 10;
    matched.push(answers.participationMode);
  }

  // 5) 팔로우한 사람이 만든 액션
  if (profile.followingIds.includes(action.owner.id)) {
    score += 5;
    matched.push('팔로우한 사람의 액션');
  }

  const adaptive = scoreAdaptiveTraits({
    profileSkills: profile.skills,
    historyCategories: profile.historyCategories,
    actionCategory: action.category,
    actionSkills: metadata.skills,
    actionGroupSize: metadata.groupSize,
    answers: {
      talentPreference: answers.talentPreference ?? null,
      groupSizePreference: answers.groupSizePreference ?? null,
      fieldPreference: answers.fieldPreference ?? null,
    },
  });
  score += adaptive.score;
  matched.push(...adaptive.matched);

  return { action, score: Math.round(score), matched };
}

/** 점수 높은 순으로 정렬해 상위 N개를 돌려줍니다 */
export function rankActions(
  actions: ActionCardData[],
  profile: ScoringProfile,
  answers: ScoringAnswers,
  metadataByAction: Record<string, ActionScoringMetadata> = {},
  take = 3,
): ScoredAction[] {
  return actions
    .map((a) =>
      scoreAction(a, profile, answers, metadataByAction[a.id]),
    )
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
