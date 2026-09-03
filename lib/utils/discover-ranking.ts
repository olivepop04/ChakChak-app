export interface AdaptiveScoringAnswers {
  talentPreference: 'use' | 'any' | null;
  groupSizePreference: 'small' | 'any' | null;
  fieldPreference: 'familiar' | 'new' | 'any' | null;
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
  answers,
}: {
  profileSkills: string[];
  historyCategories: string[];
  actionCategory: string;
  actionSkills: string[];
  actionGroupSize: number | null;
  answers: AdaptiveScoringAnswers;
}): { score: number; matched: string[] } {
  let score = 0;
  const matched: string[] = [];

  if (answers.talentPreference === 'use') {
    const sharedSkill = profileSkills.find((skill) => actionSkills.includes(skill));
    if (sharedSkill) {
      score += 15;
      matched.push(`${sharedSkill} 재능 활용`);
    }
  }

  if (
    answers.groupSizePreference === 'small' &&
    actionGroupSize !== null &&
    actionGroupSize <= 10
  ) {
    score += 10;
    matched.push('10명 이내 소규모');
  }

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
