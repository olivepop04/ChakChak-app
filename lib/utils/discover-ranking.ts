export interface AdaptiveScoringAnswers {
  talentPreference: 'use' | 'any' | null;
  groupSizePreference: 'small' | 'medium' | 'large' | 'any' | null;
  fieldPreference: 'familiar' | 'new' | 'any' | null;
  targetGroupPreference?: 'social' | 'task' | 'any' | null;
  difficultyPreference?: 'easy' | 'physical' | 'expert' | 'any' | null;
  activityTypePreference?: 'indoor' | 'outdoor' | 'both' | 'any' | null;
  selectedSkill?: string | null;
  userKeywords?: string[];
}

export function sameProvince(
  address: string | null,
  preferredRegions: string[],
): boolean {
  const province = address?.trim().split(/\s+/)[0] ?? '';
  if (!province) return false;
  return preferredRegions.some(
    (region) => region.trim().split(/\s+/)[0] === province,
  );
}

export function scoreAdaptiveTraits({
  profileSkills,
  historyCategories,
  actionCategory,
  actionSkills,
  actionGroupSize,
  actionTargetGroups = [],
  actionDifficulty = null,
  actionActivityTypes = [],
  actionKeywords = [],
  answers,
}: {
  profileSkills: string[];
  historyCategories: string[];
  actionCategory: string;
  actionSkills: string[];
  actionGroupSize: number | null;
  actionTargetGroups?: string[];
  actionDifficulty?: string | null;
  actionActivityTypes?: string[];
  actionKeywords?: string[];
  answers: AdaptiveScoringAnswers;
}): { score: number; matched: string[] } {
  let score = 0;
  const matched: string[] = [];

  // 1) 재능 활용 (skills) — 15점
  if (answers.talentPreference === 'use') {
    const candidateSkills = answers.selectedSkill
      ? [answers.selectedSkill, ...profileSkills]
      : profileSkills;
    const sharedSkill = candidateSkills.find((skill) => actionSkills.includes(skill));
    if (sharedSkill) {
      score += 15;
      matched.push(`${sharedSkill} 재능 활용`);
    } else if (answers.selectedSkill) {
      const keywordHit = actionKeywords.find(
        (k) => k.includes(answers.selectedSkill!) || answers.selectedSkill!.includes(k),
      );
      if (keywordHit) {
        score += 15;
        matched.push(`${answers.selectedSkill} 재능 활용`);
      }
    }
  } else if (answers.talentPreference === 'any') {
    if (actionSkills.length === 0) {
      score += 10;
      matched.push('누구나 가능한 활동');
    }
  }

  // 2) 모임 규모 (participation_modes) — 10점
  if (answers.groupSizePreference) {
    if (
      answers.groupSizePreference === 'small' &&
      actionGroupSize !== null &&
      actionGroupSize <= 10
    ) {
      score += 10;
      matched.push('10명 이내 소규모');
    } else if (
      answers.groupSizePreference === 'medium' &&
      actionGroupSize !== null &&
      actionGroupSize > 10 &&
      actionGroupSize <= 20
    ) {
      score += 10;
      matched.push('10~20명 중그룹');
    } else if (
      answers.groupSizePreference === 'large' &&
      actionGroupSize !== null &&
      actionGroupSize > 20
    ) {
      score += 10;
      matched.push('20명 이상 대그룹');
    } else if (answers.groupSizePreference === 'any') {
      score += 7;
      matched.push('규모 상관없음');
    }
  }

  // 3) 분야 선호 가산/감점 (fieldPreference) — ±10점
  if (answers.fieldPreference && answers.fieldPreference !== 'any') {
    const familiar = historyCategories.includes(actionCategory);
    const preferenceMatches =
      (answers.fieldPreference === 'familiar' && familiar) ||
      (answers.fieldPreference === 'new' && !familiar);
    score += preferenceMatches ? 10 : -10;
    if (preferenceMatches) {
      matched.push(
        answers.fieldPreference === 'familiar' ? '익숙한 분야' : '새로운 분야',
      );
    }
  }

  // 4) 활동 성격 (target_groups) — 15점
  if (answers.targetGroupPreference) {
    if (
      answers.targetGroupPreference === 'social' &&
      actionTargetGroups.includes('교류·교육·소통형')
    ) {
      score += 15;
      matched.push('교류·소통형 활동');
    } else if (
      answers.targetGroupPreference === 'task' &&
      actionTargetGroups.includes('육체·과업·집중형')
    ) {
      score += 15;
      matched.push('과업·집중형 활동');
    } else if (answers.targetGroupPreference === 'any') {
      score += 10;
      matched.push('성격 상관없음');
    }
  }

  // 5) 참여 난이도 (difficulty) — 15점
  if (answers.difficultyPreference) {
    if (
      answers.difficultyPreference === 'easy' &&
      actionDifficulty === '누구나 참여가능'
    ) {
      score += 15;
      matched.push('부담 없는 난이도');
    } else if (
      answers.difficultyPreference === 'physical' &&
      actionDifficulty === '기초 체력 필요'
    ) {
      score += 15;
      matched.push('기초 체력 활동');
    } else if (
      answers.difficultyPreference === 'expert' &&
      (actionDifficulty === '전문지식/자격/재능 활용' ||
        actionDifficulty === '전문지식·자격 필요')
    ) {
      score += 15;
      matched.push('전문·재능 활용');
    } else if (answers.difficultyPreference === 'any') {
      score += 10;
      matched.push('난이도 상관없음');
    }
  }

  // 6) 활동 환경 (activity_types) — 10점
  if (answers.activityTypePreference) {
    if (
      answers.activityTypePreference === 'indoor' &&
      actionActivityTypes.includes('실내 활동')
    ) {
      score += 10;
      matched.push('실내 활동');
    } else if (
      answers.activityTypePreference === 'outdoor' &&
      actionActivityTypes.includes('실외 활동')
    ) {
      score += 10;
      matched.push('야외 활동');
    } else if (
      answers.activityTypePreference === 'both' &&
      actionActivityTypes.includes('실내외 병행')
    ) {
      score += 10;
      matched.push('실내외 병행 활동');
    } else if (answers.activityTypePreference === 'any') {
      score += 7;
      matched.push('환경 상관없음');
    }
  }

  // 7) 시맨틱 키워드 (keywords) 보너스 — 최대 10점
  if (answers.userKeywords && answers.userKeywords.length > 0 && actionKeywords.length > 0) {
    const hits = answers.userKeywords.filter((word) =>
      actionKeywords.some((k) => k.includes(word) || word.includes(k)),
    );
    if (hits.length > 0) {
      const bonus = Math.min(10, hits.length * 5);
      score += bonus;
      matched.push(`관심 키워드(${hits.slice(0, 2).join('·')})`);
    }
  }

  return { score, matched };
}

export function totalGroupSize(
  items: Array<{
    type: string;
    min_required: number;
    max_allowed: number | null;
  }>,
): number | null {
  const people = items.filter((item) => item.type === 'PERSON');
  if (people.length === 0) return null;
  return people.reduce(
    (total, item) => total + (item.max_allowed ?? item.min_required),
    0,
  );
}
