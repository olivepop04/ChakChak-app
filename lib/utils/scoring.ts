/**
 * 추천 점수 계산.
 *
 * ★ 점수는 코드가 계산합니다. AI 는 의도 해석과 추천 이유 설명만 합니다.
 *   AI 에게 순위를 매기게 하면 매번 결과가 달라져서 검증할 수 없습니다.
 *
 * 2026-09-29 개편 확정 (100점 만점 체계):
 *   활동 지역 25 (시군구 25 / 시도 18 / 무관 12)
 *   활동 시간 15 (시간대 일치 15 / 무관 10)
 *   관심 분야 25 (선택 분야 일치 25)
 *   모임 규모 10 (소/중/대 일치 10 / 무관 7)
 *   활동 성격 10 (소통/과업 일치 10 / 무관 7)
 *   활동 환경 10 (실내/실외/병행 일치 10 / 무관 7)
 *   난이도 및 재능 5 (전문 난이도 선택 시 해당 재능 일치 5)
 *   [소셜 보너스] 팔로우 호스트 +5
 *   (※ 유령 코드인 시맨틱 키워드 10점, 참여 방식 10점 및 왜곡을 유발하는 분야 선호 ±10점은 완전 폐지)
 *
 * 거리(km)는 계산하지 않습니다. 액션에 좌표가 없고, 지오코딩을 붙이면
 * MVP 범위를 넘어섭니다. 시·군·구 이름이 겹치는지로만 봅니다 (팀 합의 D13).
 */
import { matchesRegion, NATIONWIDE } from '../constants/regions.ts';
import { isWeekend } from './date.ts';
import type { TimePref, TimeSlot } from '../constants/index.ts';
import type { ActionCardData } from '../types/view.ts';
import {
  sameProvince,
  scoreAdaptiveTraits,
  type AdaptiveScoringAnswers,
} from './discover-ranking.ts';

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
  categories?: string[];
  /** 'near' | 'city' | 'any' */
  range?: string | null;
  talentPreference?: AdaptiveScoringAnswers['talentPreference'];
  groupSizePreference?: AdaptiveScoringAnswers['groupSizePreference'];
  fieldPreference?: AdaptiveScoringAnswers['fieldPreference'];
  travelRange?: 'exact' | 'province' | 'any' | null;
  targetGroupPreference?: AdaptiveScoringAnswers['targetGroupPreference'];
  difficultyPreference?: AdaptiveScoringAnswers['difficultyPreference'];
  activityTypePreference?: AdaptiveScoringAnswers['activityTypePreference'];
  selectedSkill?: string | null;
  selectedSkills?: string[];
  userKeywords?: string[];
  userTimePreferences?: string[];
  selectedRegion?: string | null;
}

export interface ActionScoringMetadata {
  participationModes: string[];
  skills: string[];
  /** 사람 모집 항목의 최대 인원 합계. 최소 모집이면 min_required 합계 */
  groupSize: number | null;
  targetGroups?: string[];
  difficulty?: string | null;
  activityTypes?: string[];
  keywords?: string[];
  categories?: string[];
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

function getKstHours(iso: string): number {
  const d = new Date(iso);
  return new Date(d.getTime() + KST_OFFSET_MS).getUTCHours();
}

function getTimeSlot(iso: string | null): TimeSlot | null {
  if (!iso) return null;
  const hour = getKstHours(iso);
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

function matchesFlexibleTime(
  action: ActionCardData,
  timePrefs: TimePref[],
  userTimeSlots: string[] = [],
  availableTimes: string[] = [],
): { matched: boolean; label: string } {
  if (userTimeSlots.includes('시간 상관없음')) {
    return { matched: true, label: '시간 상관없음' };
  }

  if (action.activityStartAt && userTimeSlots.length > 0) {
    const day = isWeekend(action.activityStartAt) ? '주말' : '평일';
    const hour = getKstHours(action.activityStartAt);
    let slotLabel = '';
    if (hour >= 5 && hour < 12) slotLabel = '오전';
    else if (hour >= 12 && hour < 18) slotLabel = '오후';
    else if (hour >= 18 && hour < 22) slotLabel = '저녁';
    else slotLabel = '밤';

    const currentCombination = `${day} ${slotLabel}`;
    const hits = userTimeSlots.some((slot) => {
      if (slot === currentCombination) return true;
      if (slot === '평일 낮' && day === '평일' && (slotLabel === '오전' || slotLabel === '오후')) return true;
      if (slot === day) return true;
      return false;
    });

    if (hits) {
      return { matched: true, label: `${currentCombination} 활동` };
    }
  }

  const timeMatch = matchesTimePreference(action, timePrefs);
  if (timeMatch.matched) return timeMatch;

  const weekend = isWeekend(action.activityStartAt);
  const legacyTimeMatch =
    timePrefs.length === 0 &&
    ((weekend && availableTimes.includes('주말')) ||
      (!weekend && availableTimes.includes('평일')) ||
      availableTimes.includes('시간이 생길 때마다'));

  if (legacyTimeMatch) {
    return { matched: true, label: weekend ? '주말 활동' : '평일 활동' };
  }

  return { matched: false, label: '' };
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

  // 1) 관심 카테고리 (categories) — 25점
  // 이번 인터뷰 대화에서 사용자가 명시적으로 카테고리를 고른 경우(복수 지원), 이를 최우선으로 적용하여
  // 다른 무관한 분야(예: 동물)가 프로필 기본값 때문에 25점 가산점을 받는 왜곡을 원천 차단합니다.
  const interviewCats = [
    ...(answers.categories ?? []),
    answers.category,
  ].filter((c): c is string => Boolean(c) && c !== '상관없음');

  const wantedList = interviewCats.length > 0 ? interviewCats : profile.categories;
  const wanted = new Set(wantedList.filter(Boolean));
  const wantsAll = wanted.has('전체') || answers.category === '상관없음' || answers.categories?.includes('상관없음');
  const actionCats = Array.from(
    new Set([
      ...(action.categories ?? []),
      action.category,
      ...(metadata.categories ?? []),
    ]),
  ).filter(Boolean);
  const hit = actionCats.find((c) => wanted.has(c));
  if (wantsAll || hit) {
    score += 25;
    matched.push(wantsAll ? '관심 분야' : `관심 분야(${hit})`);
  }

  // 2) 활동 가능 지역 (region) — 25점
  const targetRegions = answers.selectedRegion ? [answers.selectedRegion] : profile.regions;
  const travelRange = answers.travelRange ?? answers.range;
  if (travelRange === 'any' || targetRegions.includes(NATIONWIDE) || !action.address) {
    score += 12;
    matched.push('지역 상관없음');
  } else if (matchesRegion(action.address, targetRegions)) {
    score += 25;
    matched.push('가까운 지역');
  } else if (
    (travelRange === 'province' || travelRange === undefined) &&
    sameProvince(action.address, targetRegions)
  ) {
    score += 18;
    matched.push('같은 시·도');
  }

  // 3) 참여 가능 시간대 (time) — 15점
  const timeResult = matchesFlexibleTime(
    action,
    profile.timePrefs,
    answers.userTimePreferences ?? [],
    profile.availableTimes,
  );
  if (timeResult.matched) {
    const isAny = timeResult.label.includes('상관없음');
    score += isAny ? 10 : 15;
    matched.push(timeResult.label);
  }

  // 4) 팔로우한 사람이 만든 액션 (소셜 보너스) — 5점
  if (profile.followingIds.includes(action.owner.id)) {
    score += 5;
    matched.push('팔로우한 사람의 액션');
  }

  // 5) 어댑티브 트레이트 점수 합산 (모임규모 10, 성격 10, 환경 10, 재능 5 = 35점)
  const adaptive = scoreAdaptiveTraits({
    profileSkills: profile.skills,
    historyCategories: profile.historyCategories,
    actionCategory: action.category,
    actionSkills: metadata.skills,
    actionGroupSize: metadata.groupSize,
    actionTargetGroups: metadata.targetGroups ?? [],
    actionDifficulty: metadata.difficulty ?? null,
    actionActivityTypes: metadata.activityTypes ?? [],
    actionKeywords: metadata.keywords ?? [],
    actionParticipationModes: metadata.participationModes ?? [],
    answers: {
      talentPreference: answers.talentPreference ?? null,
      groupSizePreference: answers.groupSizePreference ?? null,
      fieldPreference: null, // 분야 선호 점수 가감 폐지 (카테고리 후보 필터링으로만 동작)
      targetGroupPreference: answers.targetGroupPreference ?? null,
      difficultyPreference: answers.difficultyPreference ?? null,
      activityTypePreference: answers.activityTypePreference ?? null,
      selectedSkill: answers.selectedSkill ?? null,
      selectedSkills: answers.selectedSkills ?? (answers.selectedSkill ? [answers.selectedSkill] : []),
      userKeywords: [],
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

/** AI 가 실패하거나 기본 문구가 필요할 때 쓰는 다정한 맞춤 추천 이유 */
export function fallbackReason(scored: ScoredAction): string {
  const matched = scored.matched;
  if (!matched || matched.length === 0) {
    return `${scored.action.category} 분야에서 보람 있게 참여할 수 있는 액션이에요.`;
  }

  const skill = matched.find((m) => m.includes('재능 활용'));
  const vibe = matched.find((m) => m.includes('교류·소통형') || m.includes('과업·집중형'));
  const env = matched.find((m) => m.includes('실내') || m.includes('야외'));
  const category = matched.find((m) => m.includes('분야'));
  const region = matched.find((m) => m.includes('지역') || m.includes('시·도'));

  // 재능명에서 불필요한 접미사 및 중복 정리
  let skillName = skill ? skill.replace(' 재능 활용', '').trim() : null;
  if (skillName && skillName.includes('재능')) {
    skillName = skillName.replace(/재능/g, '').trim();
  }

  // 분야명에서 '분야' 중복 제거
  const rawCat = category
    ? category.replace(/관심 분야\(|\)| 익숙한 분야| 새로운 분야|분야/g, '').trim()
    : scored.action.category.replace(/분야/g, '').trim();
  const catName = rawCat || scored.action.category.replace(/분야/g, '').trim();

  // 환경 문구에서 '으로' 조사 매칭
  const envWithJosa = env ? `${env}으로` : '';

  if (skillName && vibe) {
    return `선택하신 ${catName} 분야에서 ${skillName} 재능을 살릴 수 있는 ${vibe}이에요.`;
  }
  if (skillName) {
    return `선택하신 ${catName} 분야에서 ${skillName} 재능을 나누며 함께할 수 있는 액션이에요.`;
  }
  if (vibe && env) {
    return `선택하신 ${catName} 분야에서 ${envWithJosa} 진행되는 따뜻한 ${vibe}이에요.`;
  }
  if (vibe) {
    return `선택하신 ${catName} 분야의 성격에 부합하는 ${vibe}이에요.`;
  }
  if (region && env) {
    const regionPhrase = region.includes('상관없음') ? '어디서나' : `${region}에서`;
    return `${regionPhrase} ${envWithJosa} ${catName} 분야의 나눔에 참여할 수 있는 액션이에요.`;
  }
  if (region) {
    if (region.includes('상관없음')) {
      return `어디서든 참여하기 좋은 ${catName} 분야의 뜻깊은 활동을 시작할 수 있는 액션이에요.`;
    }
    return `참여하기 좋은 ${region}에서 ${catName} 분야의 뜻깊은 활동을 시작할 수 있는 액션이에요.`;
  }

  return `${matched.slice(0, 3).join(' · ')} 조건에 잘 어울리는 맞춤 액션이에요.`;
}
