export type QuestionKey =
  | 'skills'
  | 'talent_preference'
  | 'group_size'
  | 'field_preference'
  | 'travel_range';

export interface AdaptiveAnswers {
  talentPreference?: 'use' | 'any' | null;
  groupSizePreference?: 'small' | 'any' | null;
  fieldPreference?: 'familiar' | 'new' | 'any' | null;
  travelRange?: 'exact' | 'province' | 'any' | null;
}

export function extractAdaptiveAnswers(messages: string[]): AdaptiveAnswers {
  const text = messages.join(' ');
  const answers: AdaptiveAnswers = {};

  if (/재능.*활용|재능을 쓰|내 재능으로/.test(text)) {
    answers.talentPreference = 'use';
  } else if (/재능.*상관|재능 없이도/.test(text)) {
    answers.talentPreference = 'any';
  }

  if (/10명 이내|소규모/.test(text)) {
    answers.groupSizePreference = 'small';
  } else if (/많아도|인원.*상관|규모.*상관/.test(text)) {
    answers.groupSizePreference = 'any';
  }

  if (/새로운 분야|새 분야|도전/.test(text)) {
    answers.fieldPreference = 'new';
  } else if (/비슷한 분야|하던 분야|익숙한 분야/.test(text)) {
    answers.fieldPreference = 'familiar';
  } else if (/분야.*상관|둘 다/.test(text)) {
    answers.fieldPreference = 'any';
  }

  if (/선택 지역만|가까운 곳만/.test(text)) {
    answers.travelRange = 'exact';
  } else if (/같은 시.?도|조금 멀어도/.test(text)) {
    answers.travelRange = 'province';
  } else if (/지역.*상관|어디든/.test(text)) {
    answers.travelRange = 'any';
  }

  return answers;
}

export function getRemainingQuestionKeys({
  skills,
  skillsAnswered = false,
  hasHistory,
  answers,
}: {
  skills: string[] | null;
  skillsAnswered?: boolean;
  hasHistory: boolean;
  answers: AdaptiveAnswers;
}): QuestionKey[] {
  const remaining: QuestionKey[] = [];

  if (skills === null && !skillsAnswered) remaining.push('skills');
  if (
    skills !== null &&
    skills.length > 0 &&
    !answers.talentPreference
  ) {
    remaining.push('talent_preference');
  }
  if (hasHistory && !answers.fieldPreference) {
    remaining.push('field_preference');
  }
  if (!answers.groupSizePreference) remaining.push('group_size');
  if (!answers.travelRange) remaining.push('travel_range');

  return remaining;
}

export function shouldRecommendNow({
  userTurnCount,
  enough,
  remainingCount,
}: {
  userTurnCount: number;
  enough: boolean;
  remainingCount: number;
}): boolean {
  return remainingCount === 0 || userTurnCount >= 4 || (enough && userTurnCount > 0);
}
