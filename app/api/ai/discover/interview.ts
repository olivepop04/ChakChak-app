export type QuestionKey =
  | 'skills'
  | 'talent_preference'
  | 'participation_mode'
  | 'group_size'
  | 'field_preference'
  | 'travel_range';

export interface AdaptiveAnswers {
  talentPreference?: 'use' | 'any' | null;
  participationMode?: 'time' | 'goods' | 'direct' | null;
  groupSizePreference?: 'small' | 'any' | null;
  fieldPreference?: 'familiar' | 'new' | 'any' | null;
  travelRange?: 'exact' | 'province' | 'any' | null;
}

export const DISCOVER_RECOMMENDATION_REPLY =
  '좋아요. 지금까지 알려주신 성향을 바탕으로 잘 맞는 액션을 골라봤어요.';

export function extractAdaptiveAnswers(messages: string[]): AdaptiveAnswers {
  const text = messages.join(' ');
  const answers: AdaptiveAnswers = {};

  if (/재능.*활용|재능을 쓰|내 재능으로/.test(text)) {
    answers.talentPreference = 'use';
  } else if (/재능.*상관|재능 없이도/.test(text)) {
    answers.talentPreference = 'any';
  }

  if (/물건|물품/.test(text)) {
    answers.participationMode = 'goods';
  } else if (/직접 행동|몸으로|몸을 움직/.test(text)) {
    answers.participationMode = 'direct';
  } else if (/시간을 내|시간으로/.test(text)) {
    answers.participationMode = 'time';
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
  skillsAnswered = false,
  answers,
}: {
  skillsAnswered?: boolean;
  answers: AdaptiveAnswers;
}): QuestionKey[] {
  if (!answers.talentPreference) return ['talent_preference'];

  const remaining: QuestionKey[] = [];

  if (answers.talentPreference === 'use' && !skillsAnswered) {
    remaining.push('skills');
  } else if (
    answers.talentPreference === 'any' &&
    !answers.participationMode
  ) {
    remaining.push('participation_mode');
  }
  if (!answers.groupSizePreference) remaining.push('group_size');
  if (!answers.fieldPreference) remaining.push('field_preference');
  if (!answers.travelRange) remaining.push('travel_range');

  return remaining;
}

export function shouldRecommendNow({
  userTurnCount,
}: {
  userTurnCount: number;
}): boolean {
  return userTurnCount >= 5;
}

export function getDiscoverReply({
  recommendNow,
  conversationReply,
}: {
  recommendNow: boolean;
  conversationReply: string;
}): string {
  return recommendNow ? DISCOVER_RECOMMENDATION_REPLY : conversationReply;
}
