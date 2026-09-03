export const SKILL_NONE_OPTION = '없음';
export const SKILL_UNSURE_OPTION = '모르겠음';
export const SKILL_OTHER_OPTION = '기타';

export function buildStoredSkills(
  selected: string[],
  other: string,
  fixedSkills: readonly string[],
): string[] | null {
  if (selected.includes(SKILL_UNSURE_OPTION)) return null;
  if (selected.includes(SKILL_NONE_OPTION)) return [];

  const stored = selected.filter((skill) => fixedSkills.includes(skill));
  const custom = other.trim();
  if (selected.includes(SKILL_OTHER_OPTION) && custom) stored.push(custom);

  return stored.length > 0 ? [...new Set(stored)] : null;
}

export function splitStoredSkills(
  stored: string[] | null,
  fixedSkills: readonly string[],
): { selected: string[]; other: string } {
  if (stored === null) {
    return { selected: [], other: '' };
  }
  if (stored.length === 0) {
    return { selected: [SKILL_NONE_OPTION], other: '' };
  }

  const fixed = stored.filter((skill) => fixedSkills.includes(skill));
  const custom = stored.filter((skill) => !fixedSkills.includes(skill));
  return {
    selected:
      custom.length > 0 ? [...fixed, SKILL_OTHER_OPTION] : fixed,
    other: custom.join(', '),
  };
}
