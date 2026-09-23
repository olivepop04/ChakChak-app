/**
 * Discover AI 인터뷰 및 대화 로직
 *
 * 원칙 (개편 명세):
 * 1. Discover AI는 '정보 수집 설문조사'가 아니라 '함께 액션을 찾아주는 친절한 AI 어시스턴트'다.
 * 2. 영어 'Action'을 절대 쓰지 않고 반드시 한글 '액션'으로 표기한다.
 * 3. '봉사', '봉사활동', '봉사자', '수혜자' 표현을 일체 쓰지 않는다.
 * 4. 메타데이터에 없는 가상의 활동(정화활동, 세미나, 캠페인 등)을 묻지 않는다.
 * 5. 10대 데이터 항목(카테고리, 환경, 성격, 인원규모, 난이도, 재능, 시간, 지역 등)을 충실히 확인한다.
 * 6. 선택지 옵션은 메타데이터 기준과 1:1 일치하는 전체 버튼 목록 + '상관없음'을 빠짐없이 제공한다.
 * 7. 질문 턴 수는 최대 15턴까지 허용하며, 충분한 정보가 모이면 조기 추천으로 유연하게 전환한다.
 */

export type QuestionKey =
  | 'talent_preference'
  | 'skills'
  | 'activity_type'
  | 'vibe_preference'
  | 'group_size'
  | 'field_preference'
  | 'difficulty'
  | 'travel_range'
  | 'time_pref'
  | 'participation_mode';

export type UserStateCategory = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export interface AdaptiveAnswers {
  talentPreference?: 'use' | 'any' | null;
  selectedSkill?: string | null;
  activityType?: 'indoor' | 'outdoor' | 'any' | null;
  vibePreference?: 'social' | 'task' | 'any' | null;
  groupSizePreference?: 'small' | 'medium' | 'large' | 'any' | null;
  difficultyPreference?: 'easy' | 'physical' | 'expert' | 'any' | null;
  fieldPreference?: 'familiar' | 'new' | 'any' | null;
  travelRange?: 'exact' | 'province' | 'any' | null;
  timePreference?: string | null;
  participationMode?: 'time' | 'goods' | 'direct' | null;
}

export const DISCOVER_RECOMMENDATION_REPLY =
  '좋아요. 지금까지 나눈 이야기를 바탕으로 꼭 맞는 액션을 찾아봤어요. 😊';

export interface UserContextSummary {
  state: UserStateCategory;
  stateLabel: string;
  knownFacts: string[];
  missingAxes: QuestionKey[];
  pastActivitySummary?: string;
}

export interface QuestionCopyContext {
  nickname: string;
  answers: AdaptiveAnswers;
  profileSkills: readonly string[];
  selectedSkills: readonly string[];
  fieldReferenceCategories: readonly string[];
  hasHistory: boolean;
  userState?: UserStateCategory;
  knownFacts?: string[];
  pastActivitySummary?: string;
}

/**
 * 사용자 상태 6단계 (A~F) 분석
 */
export function analyzeUserContext({
  profile,
  history = [],
  pastMetas = [],
  daysSinceLastActivity,
}: {
  profile: {
    nickname: string;
    skills?: readonly string[] | null;
    categories?: readonly string[];
    regions?: readonly string[];
    timePrefs?: readonly unknown[];
    availableTimes?: readonly string[];
    bio?: string | null;
    isGuest?: boolean;
  };
  history?: readonly {
    title: string;
    category: string;
    id?: string;
    participated_at?: string;
    created_at?: string;
  }[];
  pastMetas?: readonly {
    action_id?: string;
    categories?: string[];
    activity_types?: string[];
    target_groups?: string[];
    participation_modes?: string[];
    skills?: string[];
  }[];
  daysSinceLastActivity?: number;
}): UserContextSummary {
  const isGuest =
    profile.isGuest ||
    !profile.nickname ||
    profile.nickname === '게스트' ||
    profile.nickname.trim() === '';

  const hasSkills = Array.isArray(profile.skills) && profile.skills.length > 0;
  const hasCategories = Array.isArray(profile.categories) && profile.categories.length > 0 && !profile.categories.includes('전체');
  const hasRegions = Array.isArray(profile.regions) && profile.regions.length > 0;
  const hasTimes =
    (Array.isArray(profile.timePrefs) && profile.timePrefs.length > 0) ||
    (Array.isArray(profile.availableTimes) && profile.availableTimes.length > 0);

  const profileFactorCount = [hasSkills, hasCategories, hasRegions, hasTimes].filter(Boolean).length;
  const hasHistory = history.length > 0;

  // 장기 미활동 여부 (30일 이상)
  const isLongInactive =
    typeof daysSinceLastActivity === 'number'
      ? daysSinceLastActivity >= 30
      : false;

  let state: UserStateCategory = 'F';
  let stateLabel = '비로그인(게스트) 사용자';

  if (isGuest) {
    state = 'F';
    stateLabel = '비로그인(게스트) 사용자';
  } else if (hasHistory) {
    if (isLongInactive) {
      state = 'E';
      stateLabel = '장기 미활동자 (30일 이상 미활동)';
    } else if (history.length >= 3) {
      state = 'D';
      stateLabel = '프로필 있음 + 활동 3건 이상 (성향 뚜렷)';
    } else {
      state = 'C';
      stateLabel = '프로필 있음 + 활동 1~2건 (성향 단서 있음)';
    }
  } else {
    // 활동 이력 0건
    if (profileFactorCount > 0) {
      state = 'B';
      stateLabel = '프로필 기본 정보 있음, 활동 이력 없음';
    } else {
      state = 'A';
      stateLabel = '회원가입 직후 첫 진입 (프로필 빈약, 활동 0건)';
    }
  }

  const knownFacts: string[] = [];
  if (hasSkills && profile.skills) {
    knownFacts.push(`프로필 재능: ${profile.skills.slice(0, 2).join('·')}`);
  }
  if (hasCategories && profile.categories) {
    knownFacts.push(`관심 분야: ${profile.categories.slice(0, 2).join('·')}`);
  }
  if (hasRegions && profile.regions) {
    knownFacts.push(`선호 지역: ${profile.regions[0]}`);
  }
  if (hasTimes) {
    knownFacts.push('활동 가능 시간 등록됨');
  }

  let pastActivitySummary: string | undefined;
  if (hasHistory) {
    const latest = history[0];
    const meta = pastMetas[0];
    const env = meta?.activity_types?.[0] ? ` ${meta.activity_types[0]}` : '';
    const size = meta?.participation_modes?.[0] ? ` ${meta.participation_modes[0]}` : '';
    pastActivitySummary = `지난번 ${latest.category} 분야${env}${size} 액션 참여`;
    knownFacts.push(pastActivitySummary);
  }

  // 아직 모르는 정보 축 도출
  const missingAxes: QuestionKey[] = [];
  if (!hasCategories) missingAxes.push('field_preference');
  missingAxes.push('activity_type');
  missingAxes.push('vibe_preference');
  missingAxes.push('group_size');
  missingAxes.push('difficulty');
  if (!hasSkills) missingAxes.push('talent_preference');
  if (!hasRegions) missingAxes.push('travel_range');
  if (!hasTimes) missingAxes.push('time_pref');

  return {
    state,
    stateLabel,
    knownFacts,
    missingAxes,
    pastActivitySummary,
  };
}

/**
 * 10대 메타데이터 기준과 1:1 일치하는 전체 선택지 목록 (+ '상관없음')
 */
export function getQuestionOptions(
  key: QuestionKey,
  skills: readonly string[] = [],
): string[] {
  const options: Record<QuestionKey, readonly string[]> = {
    talent_preference: [
      '가진 재능을 살릴래요',
      '부담 없이 가볍게 시작할래요',
      '상관없음',
    ],
    skills: [
      ...(skills.length > 0
        ? skills
        : [
            '사진 촬영',
            '디자인',
            '요리',
            '교육·멘토링',
            '컴퓨터·IT',
            '글쓰기',
            '음악·공연',
            '청소·정리',
          ]),
      '특별한 재능 없이 참여',
      '상관없음',
    ],
    activity_type: [
      '실내 활동',
      '실외 활동',
      '실내외 병행',
      '온라인/비대면',
      '상관없음',
    ],
    vibe_preference: [
      '교류·교육·소통형',
      '육체·과업·집중형',
      '가족·동반가능',
      '상관없음',
    ],
    group_size: [
      '소규모 모임 (10명 안팎)',
      '중규모 모임 (10-20명)',
      '대규모 모임 (20명 이상)',
      '상관없음',
    ],
    difficulty: [
      '누구나 참여가능',
      '기초 체력 필요',
      '전문지식·자격 필요',
      '상관없음',
    ],
    field_preference: [
      '동물',
      '환경',
      '지역사회',
      '아동·청소년',
      '어르신',
      '장애인',
      '교육',
      '문화·예술',
      '기타',
      '상관없음',
    ],
    travel_range: [
      '집 근처 (선택 지역)',
      '같은 시·도까지',
      '지역 상관없음',
    ],
    time_pref: [
      '주말 오전',
      '주말 오후',
      '평일 저녁',
      '평일 낮',
      '시간 상관없음',
    ],
    participation_mode: [
      '시간으로',
      '물품으로',
      '직접 행동으로',
      '상관없음',
    ],
  };

  return [...(options[key] ?? ['좋아요', '상관없어요'])];
}

function compactList(values: readonly string[]): string {
  return [...new Set(values)].slice(0, 2).join('·');
}

/**
 * 턴별 맞춤 질문 및 연결 멘트 생성 (영어 Action 배제, 메타데이터 외 질문 금지)
 */
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
    userState = 'A',
    pastActivitySummary,
  } = context;

  // Turn 0: 첫 질문 / 오프닝 (상태 A~F 반영)
  if (key === 'talent_preference') {
    // 상태 F: 비로그인(게스트)
    if (userState === 'F') {
      return [
        '반가워요! 😊',
        '몇 가지만 편하게 알려주시면 꼭 맞는 액션을 찾아볼게요.',
        '먼저, 이번에는 가진 재능을 살려보고 싶으신가요, 아니면 부담 없이 가볍게 시작하고 싶으신가요?',
      ].join('\n');
    }

    // 상태 E: 장기 미활동자 (30일 이상)
    if (userState === 'E') {
      const pastMention = pastActivitySummary ? `${pastActivitySummary}하셨던 기억이 나네요.` : '오랜만이에요.';
      return [
        `반가워요, ${nickname}님! 😊 오랜만이에요.`,
        pastMention,
        '이번에 다시 가볍게 시작해볼 만한 액션을 찾아볼까요?',
      ].join('\n');
    }

    // 상태 D: 활동 3건 이상 (성향 뚜렷)
    if (userState === 'D') {
      const cat = compactList(fieldReferenceCategories);
      const target = cat ? `${cat} 분야` : '다양한 활동';
      return [
        `반가워요, ${nickname}님! 😊`,
        `주로 ${target}에 많이 참여하셨네요.`,
        '이번에도 익숙한 스타일로 갈까요, 새로운 도전을 해볼까요?',
      ].join('\n');
    }

    // 상태 C: 활동 1~2건
    if (userState === 'C') {
      const cat = compactList(fieldReferenceCategories);
      const target = cat ? `${cat} 분야` : '지난번 활동';
      return [
        `반가워요, ${nickname}님! 😊`,
        `지난번에 ${target}에 참여하셨네요.`,
        '이번에도 비슷한 활동을 이어가볼까요, 아니면 새로운 분야를 찾아볼까요?',
      ].join('\n');
    }

    // 상태 B: 프로필 기본 정보 있음, 활동 0건
    if (userState === 'B') {
      const skills = compactList(profileSkills);
      if (skills) {
        return [
          `반가워요, ${nickname}님! 😊`,
          `프로필에 ${skills} 재능을 등록해주셨네요.`,
          `이번 활동에서도 ${skills} 재능을 살릴 수 있는 액션을 찾아볼까요, 아니면 가볍게 시작하고 싶으신가요?`,
        ].join('\n');
      }
      return [
        `반가워요, ${nickname}님! 😊`,
        `몇 가지만 편하게 알려주시면 ${nickname}님에게 꼭 맞는 액션을 찾아볼게요.`,
        '먼저, 이번에는 가진 재능을 살려보고 싶으신가요, 아니면 부담 없이 가볍게 시작하고 싶으신가요?',
      ].join('\n');
    }

    // 상태 A: 회원가입 직후 첫 진입
    return [
      `반가워요, ${nickname}님! 😊`,
      `몇 가지만 편하게 알려주시면 ${nickname}님에게 꼭 맞는 액션을 찾아볼게요.`,
      '먼저, 이번에는 가진 재능을 살려보고 싶으신가요, 아니면 부담 없이 가볍게 시작하고 싶으신가요?',
    ].join('\n');
  }

  if (key === 'skills') {
    const skills = compactList(profileSkills);
    if (skills) {
      return [
        `좋아요! 프로필에 등록해주신 ${skills} 재능을 우선해서 찾아볼게요.`,
        '혹시 이번에 특별히 더 살리고 싶은 세부 재능이 있다면 골라주세요.',
      ].join('\n');
    }
    return [
      '멋져요! 가진 재능을 살릴 수 있는 액션을 함께 찾아볼게요.',
      '어떤 재능을 발휘하고 싶으신가요?',
    ].join('\n');
  }

  // 활동 환경 질문 (activity_types)
  if (key === 'activity_type') {
    const bridge = answers.talentPreference === 'any'
      ? '괜찮아요. 특별한 재능 없이도 누구나 즐겁게 참여할 수 있는 액션이 정말 많아요. 😊'
      : '재능을 나누는 따뜻한 마음이 참 멋져요! 😊';
    return [
      bridge,
      '활동 환경은 어떤 곳이 편하세요? 날씨 걱정 없는 실내 활동이 좋으신가요, 활기찬 야외 활동이 끌리시나요?',
    ].join('\n');
  }

  // 활동 성격 질문 (target_groups)
  if (key === 'vibe_preference') {
    const bridge = answers.activityType === 'indoor'
      ? '실내 활동이 편하시군요.'
      : answers.activityType === 'outdoor'
        ? '활기찬 야외 활동이 좋으시군요.'
        : '환경은 자유롭게 열어둘게요.';
    return [
      bridge,
      '활동 스타일은 사람들과 대화·교육을 나누는 **교류·소통형**이 좋으신가요, 아니면 몸 쓰며 깔끔하게 일에 집중하는 **과업형**이 끌리시나요?',
    ].join('\n');
  }

  // 모임 인원 규모 질문 (participation_modes)
  if (key === 'group_size') {
    const bridge = answers.vibePreference === 'social'
      ? '사람들과 소통하는 활동을 선호하시는군요.'
      : answers.vibePreference === 'task'
        ? '일에 집중하는 깔끔한 활동을 선호하시는군요.'
        : '다양한 스타일로 찾아볼게요.';
    return [
      bridge,
      '함께하는 모임 규모는 10명 안팎의 작은 모임이 편하신가요, 아니면 사람이 조금 많아도 괜찮으세요?',
    ].join('\n');
  }

  // 참여 난이도 / 문턱 질문 (difficulty)
  if (key === 'difficulty') {
    return [
      '활동 참여 문턱이나 난이도는 어느 정도가 편하세요? 첫 참여라 부담 없는 활동이 좋으신가요, 아니면 체력이나 전문성을 발휘해보고 싶으신가요?',
    ].join('\n');
  }

  // 활동 분야 질문 (categories)
  if (key === 'field_preference') {
    const bridge = answers.groupSizePreference === 'small'
      ? '오붓한 소규모 모임이 더 편하시군요.'
      : '북적북적 함께하는 규모도 좋으시군요.';
    const categories = compactList(fieldReferenceCategories);
    if (categories && hasHistory) {
      return [
        bridge,
        `이전에 ${categories} 관련 액션에 함께하셨는데, 이번에는 어떤 분야에 관심이 가시나요?`,
      ].join('\n');
    }
    if (categories) {
      return [
        bridge,
        `프로필에 관심사로 두신 ${categories} 분야를 비롯해 어떤 분야를 가장 해보고 싶으세요?`,
      ].join('\n');
    }
    return [
      bridge,
      '특별히 관심이 가는 활동 분야가 있으신가요?',
    ].join('\n');
  }

  // 활동 시간대 질문 (time_pref)
  if (key === 'time_pref') {
    return [
      '주로 활동하기 편하신 시간대가 언제인가요? 주말이나 평일 중 원하시는 시간대를 알려주세요.',
    ].join('\n');
  }

  // 이동 범위 질문 (travel_range)
  const fieldBridge = answers.fieldPreference === 'new'
    ? '새로운 분야에도 도전해보고 싶으시군요.'
    : answers.fieldPreference === 'familiar'
      ? '익숙한 분야를 이어가고 싶으시군요.'
      : '분야는 넓게 열어둘게요.';
  return [
    fieldBridge,
    '마지막으로, 활동 장소는 집 근처가 좋으신가요, 아니면 조금 이동해도 괜찮으세요?',
  ].join('\n');
}

/**
 * 추천 완료 시점의 따뜻한 공감 및 요약 문장 생성
 */
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
  const parts: string[] = [];
  const skill = compactList(selectedSkills);

  if (answers.talentPreference === 'use' && skill) {
    parts.push(`${skill} 재능을 살릴 수 있으면서`);
  } else if (answers.talentPreference === 'use') {
    parts.push('재능을 살릴 수 있으면서');
  } else if (answers.participationMode === 'goods') {
    parts.push('물품으로 힘을 보태면서');
  } else if (answers.participationMode === 'direct') {
    parts.push('직접 행동으로 함께하면서');
  } else if (answers.participationMode === 'time') {
    parts.push('시간을 내어 참여하면서');
  } else if (answers.talentPreference === 'any') {
    parts.push('부담 없이 가볍게 참여할 수 있으면서');
  }

  if (answers.activityType === 'indoor') {
    parts.push('날씨 안 타는 실내에서');
  } else if (answers.activityType === 'outdoor') {
    parts.push('활기찬 야외에서');
  }

  if (answers.vibePreference === 'social') {
    parts.push('따뜻한 교류를 나누는');
  } else if (answers.vibePreference === 'task') {
    parts.push('활동에 집중할 수 있는');
  }

  if (answers.groupSizePreference === 'small') {
    parts.push('10명 이내 소규모');
  } else if (answers.groupSizePreference === 'medium') {
    parts.push('10~20명 규모');
  } else if (answers.groupSizePreference === 'large') {
    parts.push('20명 이상 규모');
  }

  const categories = compactList(fieldReferenceCategories);
  const ending =
    answers.fieldPreference === 'new'
      ? '새로운 분야의 액션으로 골라봤어요.'
      : answers.fieldPreference === 'familiar' && categories
        ? `${categories} 분야의 액션으로 골라봤어요.`
        : '액션들을 골라봤어요.';

  if (parts.length === 0) return DISCOVER_RECOMMENDATION_REPLY;

  return [
    `${nickname}님께서 ${parts.join(', ')} 참여하실 수 있는`,
    `${ending} 마음에 드는 활동을 확인해보세요! 😊`,
  ].join('\n');
}

/**
 * 자연어 메시지에서 사용자 의도 추출
 */
export function extractAdaptiveAnswers(messages: string[]): AdaptiveAnswers {
  const text = messages.join(' ');
  const answers: AdaptiveAnswers = {};

  // 재능 선호
  if (/재능.*활용|재능을 살|내 재능으로|재능.*기부|가진.*재능|재능 쓸래/.test(text)) {
    answers.talentPreference = 'use';
  } else if (/재능.*상관|재능 없이|특별한 재능|누구나|가볍게|첫 참여|부담 없이/.test(text)) {
    answers.talentPreference = 'any';
  }

  // 참여 방식 (하위 호환성)
  if (/물건|물품/.test(text)) {
    answers.participationMode = 'goods';
  } else if (/직접 행동|몸으로|몸을 움직|현장 활동/.test(text)) {
    answers.participationMode = 'direct';
  } else if (/시간을 내|시간으로/.test(text)) {
    answers.participationMode = 'time';
  }

  // 활동 환경
  if (/실내|날씨 안 타|비 안 맞|안에서|실내 활동/.test(text)) {
    answers.activityType = 'indoor';
  } else if (/실외|야외|바깥|공원|밖에서|야외 활동/.test(text)) {
    answers.activityType = 'outdoor';
  } else if (/환경.*상관|실내외.*상관|어디든 상관/.test(text)) {
    answers.activityType = 'any';
  }

  // 모임 성격 / 교류 형태
  if (/교류|대화|교육|소통|말벗|멘토링|가르침|아이돌봄/.test(text)) {
    answers.vibePreference = 'social';
  } else if (/과업|몸 쓰|땀|집중|청소|플로깅|배달|일만|결과물/.test(text)) {
    answers.vibePreference = 'task';
  } else if (/스타일.*상관|성격.*상관/.test(text)) {
    answers.vibePreference = 'any';
  }

  // 모임 인원 규모 (혼자하는 것 문의도 소규모로 반영)
  if (/10명 이내|소규모|작은|적은|오붓|10명 안팎|혼자|혼자하는/.test(text)) {
    answers.groupSizePreference = 'small';
  } else if (/10~20|10-20|10명에서 20명|중규모|중그룹/.test(text)) {
    answers.groupSizePreference = 'medium';
  } else if (/20명 이상|대규모|사람 많|북적|인원.*상관|규모.*상관|많아도/.test(text)) {
    answers.groupSizePreference = 'large';
  }

  // 난이도 / 문턱
  if (/누구나|첫 참여|쉬운|부담 없|초보/.test(text)) {
    answers.difficultyPreference = 'easy';
  } else if (/체력|몸 쓰는|힘쓰는|힘든/.test(text)) {
    answers.difficultyPreference = 'physical';
  } else if (/전문|자격|역량|기술/.test(text)) {
    answers.difficultyPreference = 'expert';
  }

  // 관심 분야
  if (/새로운 분야|새 분야|도전|다양한|새로운 것/.test(text)) {
    answers.fieldPreference = 'new';
  } else if (/비슷한 분야|하던 분야|익숙한 분야|원래 하던|기존/.test(text)) {
    answers.fieldPreference = 'familiar';
  } else if (/분야.*상관|주제.*상관/.test(text)) {
    answers.fieldPreference = 'any';
  }

  // 이동 범위
  if (/집 근처|선택 지역|가까운 곳|동네|근처/.test(text)) {
    answers.travelRange = 'exact';
  } else if (/같은 시.?도|조금 멀어도|인근|광역/.test(text)) {
    answers.travelRange = 'province';
  } else if (/지역.*상관|거리.*상관|어디든|전국/.test(text)) {
    answers.travelRange = 'any';
  }

  // 시간대
  if (/주말|토요일|일요일/.test(text)) {
    answers.timePreference = 'weekend';
  } else if (/평일/.test(text)) {
    answers.timePreference = 'weekday';
  }

  return answers;
}

/**
 * 대화 맥락(질문-답변 쌍)을 기반으로 사용자 의도 정밀 추출
 * 특히 '상관없음'이나 단답형 답변이 어느 질문에 대한 것인지 정확히 매핑한다.
 */
export function extractAnswersFromDialogue(
  messages: readonly { role: string; content: string }[],
): AdaptiveAnswers {
  const answers: AdaptiveAnswers = {};

  for (let i = 0; i < messages.length - 1; i++) {
    const current = messages[i];
    const next = messages[i + 1];

    if (current.role === 'assistant' && next.role === 'user') {
      const q = current.content;
      const a = next.content;

      // 1. 모임 규모 질문에 대한 답변
      if (/모임 규모|인원|소규모|중규모|대규모/.test(q)) {
        if (/상관없/.test(a)) answers.groupSizePreference = 'any';
        else if (/소규모|10명 안팎|10명 이내|작은/.test(a)) answers.groupSizePreference = 'small';
        else if (/중규모|10-20|10~20|중그룹/.test(a)) answers.groupSizePreference = 'medium';
        else if (/대규모|20명 이상|대그룹/.test(a)) answers.groupSizePreference = 'large';
      }

      // 2. 참여 난이도 질문에 대한 답변
      if (/난이도|문턱|체력|전문지식/.test(q)) {
        if (/상관없/.test(a)) answers.difficultyPreference = 'any';
        else if (/누구나|부담 없|초보/.test(a)) answers.difficultyPreference = 'easy';
        else if (/기초 체력|체력|몸 쓰는/.test(a)) answers.difficultyPreference = 'physical';
        else if (/전문지식|자격|역량/.test(a)) answers.difficultyPreference = 'expert';
      }

      // 3. 환경 질문에 대한 답변
      if (/환경|실내|실외|야외|비대면/.test(q)) {
        if (/상관없/.test(a)) answers.activityType = 'any';
        else if (/실내/.test(a)) answers.activityType = 'indoor';
        else if (/실외|야외/.test(a)) answers.activityType = 'outdoor';
      }

      // 4. 모임 성격/스타일 질문에 대한 답변
      if (/스타일|성격|교류|소통|과업|집중형/.test(q)) {
        if (/상관없/.test(a)) answers.vibePreference = 'any';
        else if (/교류|소통|교육/.test(a)) answers.vibePreference = 'social';
        else if (/과업|육체|집중/.test(a)) answers.vibePreference = 'task';
      }

      // 5. 이동 범위 질문에 대한 답변
      if (/장소|지역|이동 범위|거리|집 근처/.test(q)) {
        if (/상관없/.test(a)) answers.travelRange = 'any';
        else if (/집 근처|선택 지역/.test(a)) answers.travelRange = 'exact';
        else if (/같은 시.?도|시·도/.test(a)) answers.travelRange = 'province';
      }

      // 6. 활동 분야 질문에 대한 답변
      if (/분야|카테고리|관심사/.test(q)) {
        if (/상관없/.test(a)) answers.fieldPreference = 'any';
        else if (/새로운/.test(a)) answers.fieldPreference = 'new';
        else answers.fieldPreference = 'familiar';
      }

      // 7. 시간대 질문에 대한 답변
      if (/시간|주말|평일|오전|오후|저녁/.test(q)) {
        if (/상관없/.test(a)) answers.timePreference = 'any';
        else if (/주말/.test(a)) answers.timePreference = 'weekend';
        else if (/평일/.test(a)) answers.timePreference = 'weekday';
      }

      // 8. 재능 질문에 대한 답변
      if (/재능|살려보고|발휘/.test(q)) {
        if (/상관없|부담 없이|가볍게|특별한 재능 없이/.test(a)) answers.talentPreference = 'any';
        else if (/재능|살릴/.test(a)) answers.talentPreference = 'use';
      }
    }
  }

  return answers;
}

/**
 * 다음 질문 키 추출 (남은 질문 축)
 */
export function getRemainingQuestionKeys({
  skillsAnswered = false,
  answers,
  userState = 'F',
}: {
  skillsAnswered?: boolean;
  answers: AdaptiveAnswers;
  userState?: UserStateCategory;
}): QuestionKey[] {
  const remaining: QuestionKey[] = [];

  // 1. 분야 선호 (가장 기본 관심사)
  if (!answers.fieldPreference) {
    remaining.push('field_preference');
  }

  // 2. 환경 질문 (실내/실외)
  if (!answers.activityType) {
    remaining.push('activity_type');
  }

  // 3. 성격 질문 (교류형 vs 과업형)
  if (!answers.vibePreference) {
    remaining.push('vibe_preference');
  }

  // 4. 인원 규모 질문 (소규모 vs 중규모 vs 대규모)
  if (!answers.groupSizePreference) {
    remaining.push('group_size');
  }

  // 5. 난이도 / 문턱
  if (!answers.difficultyPreference) {
    remaining.push('difficulty');
  }

  // 6. 재능 질문
  if (!answers.talentPreference) {
    remaining.push('talent_preference');
  } else if (answers.talentPreference === 'use' && !skillsAnswered) {
    remaining.push('skills');
  }

  // 7. 이동 범위
  if (!answers.travelRange) {
    remaining.push('travel_range');
  }

  // 8. 활동 시간대
  if (!answers.timePreference) {
    remaining.push('time_pref');
  }

  return remaining;
}

/**
 * 동적 추천 전환 여부 판정
 *
 * 명세:
 * - 질문 턴 수는 최대 15턴까지 허용한다 (충분한 정보 파악을 위해).
 * - 4턴 이상에서 사용자 조건이 충분히 모였거나, 사용자가 추천을 요청하면 즉시 전환한다.
 * - 15턴에 도달하면 무조건 추천으로 전환한다.
 */
export function shouldRecommendNow({
  userTurnCount,
  enough = false,
}: {
  userTurnCount: number;
  enough?: boolean;
}): boolean {
  // 15번째 답변에 도달하면 무조건 추천
  if (userTurnCount >= 15) return true;
  // 4턴 이후에서 충분한 정보가 확보되었으면 조기 추천
  if (userTurnCount >= 4 && enough) return true;
  return false;
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
