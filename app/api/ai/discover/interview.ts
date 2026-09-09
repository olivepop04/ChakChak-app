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

export interface QuestionCopyContext {
  nickname: string;
  answers: AdaptiveAnswers;
  profileSkills: readonly string[];
  selectedSkills: readonly string[];
  fieldReferenceCategories: readonly string[];
  hasHistory: boolean;
}

export function getQuestionOptions(
  key: QuestionKey,
  skills: readonly string[],
): string[] {
  const options: Record<QuestionKey, readonly string[]> = {
    skills,
    talent_preference: [
      '재능을 활용하고 싶어요',
      '재능과 상관없이 참여하고 싶어요',
    ],
    participation_mode: ['시간을 내서', '물건으로', '직접 행동으로'],
    group_size: ['10명 이내가 좋아요', '인원이 많아도 괜찮아요'],
    field_preference: ['비슷한 분야', '새로운 분야', '둘 다 좋아요'],
    travel_range: ['선택 지역만', '같은 시·도까지', '지역 상관없음'],
  };

  return [...options[key]];
}

function compactList(values: readonly string[]): string {
  return [...new Set(values)].slice(0, 2).join('·');
}

export function getQuestionReply(
  key: QuestionKey,
  context: QuestionCopyContext,
): string {
  const {
    nickname,
    answers,
    profileSkills,
    selectedSkills,
    fieldReferenceCategories,
    hasHistory,
  } = context;

  if (key === 'talent_preference') {
    const welcome = [
      `반가워요, ${nickname}님. 😊`,
      `몇 가지만 편하게 알려주시면 ${nickname}님에게 잘 맞는 액션을 찾아볼게요.`,
    ];
    const skills = compactList(profileSkills);
    if (skills) {
      welcome.push(
        `프로필에 ${skills} 재능을 등록해주셨네요. 이번에는 이 재능을 활용할 수 있는 액션도 찾아볼까요?`,
      );
    } else {
      welcome.push(
        '먼저, 이번에는 가진 재능을 활용할 수 있는 액션을 찾아볼까요?',
      );
    }
    return welcome.join('\n');
  }

  if (key === 'skills') {
    const skills = compactList(profileSkills);
    if (skills) {
      return [
        `좋아요. 프로필에 ${skills} 재능을 등록해주셨네요.`,
        '이번에는 어떤 재능을 우선해서 활용하고 싶으세요?',
      ].join('\n');
    }
    return [
      '좋아요. 가진 재능을 살릴 수 있는 액션을 함께 찾아볼게요.',
      '이번에는 어떤 재능을 활용하고 싶으세요?',
    ].join('\n');
  }

  if (key === 'participation_mode') {
    return [
      '괜찮아요. 특별한 재능이 없어도 참여할 수 있는 액션이 많아요.',
      '시간, 물건, 직접 행동 중 어떤 방식이 가장 편하세요?',
    ].join('\n');
  }

  if (key === 'group_size') {
    const skill = compactList(selectedSkills);
    const bridge = skill
      ? `${skill} 재능을 살릴 수 있는 액션으로 찾아볼게요.`
      : answers.participationMode === 'goods'
        ? '물건으로 힘을 보탤 수 있는 액션으로 찾아볼게요.'
        : answers.participationMode === 'direct'
          ? '직접 참여해 힘을 보탤 수 있는 액션으로 찾아볼게요.'
          : '시간을 내어 참여할 수 있는 액션으로 찾아볼게요.';
    return [
      bridge,
      '함께하는 인원은 10명 이내의 작은 모임이 편하세요, 아니면 더 많은 사람이 함께해도 괜찮으세요?',
    ].join('\n');
  }

  if (key === 'field_preference') {
    const bridge =
      answers.groupSizePreference === 'small'
        ? '작은 모임이 더 편하시군요.'
        : '여러 사람과 함께하는 활동도 괜찮으시군요.';
    const categories = compactList(fieldReferenceCategories);
    if (categories && hasHistory) {
      return [
        bridge,
        `최근 ${categories} 분야 액션에 참여하셨네요. 이번에도 비슷한 활동을 이어가볼까요, 아니면 새로운 분야를 찾아볼까요?`,
      ].join('\n');
    }
    if (categories) {
      return [
        bridge,
        `프로필에 ${categories} 분야를 관심사로 등록하셨네요. 익숙한 분야를 찾아볼까요, 아니면 새로운 분야에도 도전해볼까요?`,
      ].join('\n');
    }
    return [
      bridge,
      '익숙한 분야를 찾아볼까요, 아니면 새로운 분야에도 도전해볼까요?',
    ].join('\n');
  }

  const fieldBridge =
    answers.fieldPreference === 'new'
      ? '새로운 분야에도 도전해보고 싶으시군요.'
      : answers.fieldPreference === 'familiar'
        ? '익숙한 분야를 이어가고 싶으시군요.'
        : '익숙한 분야와 새로운 분야 모두 괜찮으시군요.';
  return [
    fieldBridge,
    '마지막으로, 활동 장소는 어느 정도까지 이동할 수 있나요?',
  ].join('\n');
}

export function getRecommendationReply({
  nickname,
  answers,
  selectedSkills,
  fieldReferenceCategories,
}: {
  nickname: string;
  answers: AdaptiveAnswers;
  selectedSkills: readonly string[];
  fieldReferenceCategories: readonly string[];
}): string {
  const opening: string[] = [];
  const skill = compactList(selectedSkills);

  if (answers.talentPreference === 'use' && skill) {
    opening.push(`${skill} 재능을 활용하면서`);
  } else if (answers.participationMode === 'goods') {
    opening.push('물건으로 힘을 보태면서');
  } else if (answers.participationMode === 'direct') {
    opening.push('직접 행동으로 참여하면서');
  } else if (answers.participationMode === 'time') {
    opening.push('시간을 내어 참여하면서');
  }

  if (answers.groupSizePreference === 'small') {
    opening.push('10명 이내의 작은 모임에서');
  } else if (answers.groupSizePreference === 'any') {
    opening.push('여러 사람과 함께');
  }

  const categories = compactList(fieldReferenceCategories);
  const ending =
    answers.fieldPreference === 'new'
      ? '새로운 분야에 도전해보고 싶으시군요.'
      : answers.fieldPreference === 'familiar' && categories
        ? `${categories}처럼 익숙한 분야를 이어가고 싶으시군요.`
        : answers.fieldPreference === 'familiar'
          ? '익숙한 분야를 이어가고 싶으시군요.'
          : '분야를 가리지 않고 참여하고 싶으시군요.';

  if (opening.length === 0) return DISCOVER_RECOMMENDATION_REPLY;

  return [
    `${nickname}님은 ${opening.join(' ')} ${ending}`,
    '말씀해주신 내용을 바탕으로 잘 맞는 액션을 골라봤어요.',
  ].join('\n');
}

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
