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
  | 'opening'
  | 'categories'
  | 'target_groups'
  | 'difficulty'
  | 'skills'
  | 'activity_types'
  | 'participation_modes'
  // 하위 호환성 키:
  | 'talent_preference'
  | 'field_preference'
  | 'vibe_preference'
  | 'activity_type'
  | 'group_size'
  | 'travel_range'
  | 'time_pref'
  | 'participation_mode';

export type UserStateCategory = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export interface AdaptiveAnswers {
  openingDecision?: 'confirm' | 'change' | null;
  selectedRegion?: string | null;
  timePreferences?: string[];
  timePreference?: string | null;
  talentPreference?: 'use' | 'any' | 'new_skill' | null;
  selectedSkill?: string | null;
  selectedSkills?: string[];
  activityType?: 'indoor' | 'outdoor' | 'both' | 'any' | null;
  vibePreference?: 'social' | 'task' | 'any' | null;
  groupSizePreference?: 'small' | 'medium' | 'large' | 'any' | null;
  difficultyPreference?: 'easy' | 'physical' | 'expert' | 'any' | null;
  fieldPreference?: 'familiar' | 'new' | 'any' | 'selected' | null;
  selectedCategory?: string | null;
  travelRange?: 'exact' | 'province' | 'any' | null;
  participationMode?: 'time' | 'goods' | 'direct' | null;
  userKeywords?: string[];
}

export const DISCOVER_RECOMMENDATION_REPLY =
  '좋아요. 지금까지 나눈 이야기를 바탕으로 꼭 맞는 액션을 찾아봤어요. 😊';

export interface UserContextSummary {
  state: UserStateCategory;
  stateLabel: string;
  knownFacts: string[];
  missingAxes: QuestionKey[];
  pastActivitySummary?: string;
  profileRegion?: string;
  profileTimesSummary?: string;
  hasRegionAndTime: boolean;
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
  profileRegion?: string;
  profileTimesSummary?: string;
  hasRegionAndTime?: boolean;
}

/**
 * 전국 시·도 및 시·군·구 매핑 테이블 (lib/constants/regions.ts 기준)
 */
export const SIDO_ALIASES: Record<string, string> = {
  서울: '서울특별시',
  서울특별시: '서울특별시',
  부산: '부산광역시',
  부산광역시: '부산광역시',
  대구: '대구광역시',
  대구광역시: '대구광역시',
  인천: '인천광역시',
  인천광역시: '인천광역시',
  광주: '광주광역시',
  광주광역시: '광주광역시',
  대전: '대전광역시',
  대전광역시: '대전광역시',
  울산: '울산광역시',
  울산광역시: '울산광역시',
  세종: '세종특별자치시',
  세종시: '세종특별자치시',
  세종특별자치시: '세종특별자치시',
  경기: '경기도',
  경기도: '경기도',
  강원: '강원특별자치도',
  강원도: '강원특별자치도',
  강원특별자치도: '강원특별자치도',
  충북: '충청북도',
  충청북도: '충청북도',
  충남: '충청남도',
  충청남도: '충청남도',
  전북: '전북특별자치도',
  전라북도: '전북특별자치도',
  전북특별자치도: '전북특별자치도',
  전남: '전라남도',
  전라남도: '전라남도',
  경북: '경상북도',
  경상북도: '경상북도',
  경남: '경상남도',
  경상남도: '경상남도',
  제주: '제주특별자치도',
  제주도: '제주특별자치도',
  제주특별자치도: '제주특별자치도',
};

export const ALL_SIGUNGU_MAP: Record<string, string[]> = {
  서울특별시: [
    '강남구', '강동구', '강북구', '강서구', '관악구', '광진구', '구로구', '금천구',
    '노원구', '도봉구', '동대문구', '동작구', '마포구', '서대문구', '서초구', '성동구',
    '성북구', '송파구', '양천구', '영등포구', '용산구', '은평구', '종로구', '중구', '중랑구',
  ],
  부산광역시: [
    '강서구', '금정구', '기장군', '남구', '동구', '동래구', '부산진구', '북구',
    '사상구', '사하구', '서구', '수영구', '연제구', '영도구', '중구', '해운대구',
  ],
  대구광역시: ['남구', '달서구', '달성군', '동구', '북구', '서구', '수성구', '중구', '군위군'],
  인천광역시: [
    '강화군', '계양구', '미추홀구', '남동구', '동구', '부평구', '서구', '연수구', '옹진군', '중구',
  ],
  광주광역시: ['광산구', '남구', '동구', '북구', '서구'],
  대전광역시: ['대덕구', '동구', '서구', '유성구', '중구'],
  울산광역시: ['중구', '남구', '동구', '북구', '울주군'],
  세종특별자치시: ['세종시'],
  경기도: [
    '가평군', '고양시', '과천시', '광명시', '광주시', '구리시', '군포시', '김포시',
    '남양주시', '동두천시', '부천시', '성남시', '수원시', '시흥시', '안산시', '안성시',
    '안양시', '양주시', '양평군', '여주시', '연천군', '오산시', '용인시', '의왕시',
    '의정부시', '이천시', '파주시', '평택시', '포천시', '하남시', '화성시',
  ],
  강원특별자치도: [
    '강릉시', '동해시', '속초시', '원주시', '춘천시', '태백시', '삼척시', '홍천군', '평창군',
  ],
  충청북도: ['청주시', '충주시', '제천시', '음성군', '진천군', '옥천군', '영동군'],
  충청남도: ['천안시', '아산시', '서산시', '당진시', '공주시', '논산시', '보령시', '예산군'],
  전북특별자치도: ['전주시', '군산시', '익산시', '정읍시', '남원시', '김제시', '완주군'],
  전라남도: ['목포시', '여수시', '순천시', '나주시', '광양시', '담양군', '해남군'],
  경상북도: ['포항시', '경주시', '김천시', '안동시', '구미시', '영주시', '경산시', '칠곡군'],
  경상남도: ['창원시', '진주시', '통영시', '사천시', '김해시', '밀양시', '거제시', '양산시'],
  제주특별자치도: ['제주시', '서귀포시'],
};

/**
 * 텍스트에서 시·도/시·군·구 지역명 및 이동 범위 추출
 */
export function extractRegionFromText(text: string): {
  selectedRegion?: string;
  travelRange?: 'exact' | 'province' | 'any';
} {
  if (/전국|어디든|어디나|지역.*상관|거리.*상관|위치.*상관/.test(text)) {
    return { travelRange: 'any' };
  }

  const clean = text.replace(/📍/g, '').trim();

  // 1. 시도 + 시군구 형태 (예: "서울특별시 성동구", "서울 성동구", "경기 수원시")
  for (const [alias, fullSido] of Object.entries(SIDO_ALIASES)) {
    if (clean.includes(alias)) {
      const sigungus = ALL_SIGUNGU_MAP[fullSido] ?? [];
      for (const sigungu of sigungus) {
        if (clean.includes(sigungu)) {
          return {
            selectedRegion: `${fullSido} ${sigungu}`,
            travelRange: 'exact',
          };
        }
      }
      if (/전체|전역|모든/.test(clean)) {
        return {
          selectedRegion: `${fullSido} 전체`,
          travelRange: 'province',
        };
      }
    }
  }

  // 2. 시도 없이 시군구 단독 매칭 (예: "성동구", "해운대구", "수원시")
  for (const [sido, sigungus] of Object.entries(ALL_SIGUNGU_MAP)) {
    for (const sigungu of sigungus) {
      if (clean.includes(sigungu)) {
        return {
          selectedRegion: `${sido} ${sigungu}`,
          travelRange: 'exact',
        };
      }
    }
  }

  // 3. 근처 / 시도 매칭
  if (/집 근처|선택 지역|가까운 곳|동네|근처/.test(clean)) {
    return { travelRange: 'exact' };
  }
  if (/같은 시.?도|조금 멀어도|인근|광역/.test(clean)) {
    return { travelRange: 'province' };
  }

  return {};
}

/**
 * 15종 전체 재능 목록 (7대 메타데이터 skills 기준)
 */
export const ALL_15_SKILLS = [
  '사진 촬영',
  '영상 촬영·편집',
  '디자인',
  '글쓰기',
  'SNS 홍보',
  '요리',
  '운전',
  '교육·멘토링',
  '통역·번역',
  '컴퓨터·IT',
  '원예·식물관리',
  '청소·정리',
  '미술·공예',
  '음악·공연',
  '수리·시공',
  '기타',
] as const;

/**
 * 재능 질문 시 들어올 수 있는 단순 응원이나 잡담/비재능 표현
 */
export const CHEERING_OR_CASUAL_REGEX =
  /^(파이팅|화이팅|힘내|힘내요|힘내세요|응원|응원해요|응원합니다|안녕|안녕하세요|반가워|반가워요|반갑습니다|ㅋㅋㅋ+|ㅎㅎ+|헤헤|글쎄|글쎄요|몰라|몰라요|아무거나|그냥|네|아니오|좋아|좋아요|응|ㅇㅇ)$/;

/**
 * 재능 직접 입력 시 폭력적/비윤리적/범죄적 내용 검증 가드레일
 */
export function validateHarmfulSkillInput(text: string): {
  isHarmful: boolean;
  reason?: string;
} {
  const harmfulRegex =
    /(살인|폭행|폭력|상해|마약|대마|필로폰|도박|사기|해킹|보이스피싱|성매매|음란|성착취|몰카|협박|갈취|불법|암살|테러|무기|밀수|다단계|자살|자해|절도|강도|횡령|성추행|성폭행|불법촬영)/;

  if (harmfulRegex.test(text)) {
    return {
      isHarmful: true,
      reason:
        '입력해주신 내용에는 착착의 취지에 맞지 않거나 안전하지 않은 표현이 포함되어 있어요. 다른 분들과 함께 나눌 수 있는 긍정적인 재능으로 다시 입력해주세요. 😊',
    };
  }
  return { isHarmful: false };
}

/**
 * 시간대 선호 요약 텍스트 생성
 */
export function formatTimePrefsSummary(timePrefs?: readonly unknown[], availableTimes?: readonly string[]): string {
  if (Array.isArray(timePrefs) && timePrefs.length > 0) {
    const list: string[] = [];
    for (const item of timePrefs as Array<{ day?: string; slots?: string[] }>) {
      if (item.day === '상관없음' || item.slots?.includes('상관없음')) {
        return '시간 상관없음';
      }
      if (item.day && item.slots && item.slots.length > 0) {
        list.push(`${item.day} ${item.slots.join('·')}`);
      }
    }
    if (list.length > 0) return list.slice(0, 2).join(', ');
  }
  if (Array.isArray(availableTimes) && availableTimes.length > 0) {
    return availableTimes.slice(0, 2).join(', ');
  }
  return '시간 미설정';
}

/**
 * 사용자 상태 6단계 (A~F) 분석 및 기본 지역/시간 확인
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
  const hasRegions = Array.isArray(profile.regions) && profile.regions.length > 0 && profile.regions[0] !== '전국';
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

  const profileRegion = hasRegions && profile.regions ? profile.regions[0] : undefined;
  const profileTimesSummary = hasTimes ? formatTimePrefsSummary(profile.timePrefs, profile.availableTimes) : undefined;
  const hasRegionAndTime = Boolean(hasRegions && hasTimes);

  // 아직 모르는 정보 축 도출
  const missingAxes: QuestionKey[] = [];
  if (!hasCategories) missingAxes.push('categories');
  missingAxes.push('target_groups');
  missingAxes.push('difficulty');
  missingAxes.push('activity_types');
  missingAxes.push('participation_modes');

  return {
    state,
    stateLabel,
    knownFacts,
    missingAxes,
    pastActivitySummary,
    profileRegion,
    profileTimesSummary,
    hasRegionAndTime,
  };
}

export interface QuestionOptionContext {
  hasHistory?: boolean;
  hasRegionAndTime?: boolean;
  answers?: AdaptiveAnswers;
  profileSkills?: readonly string[];
}

/**
 * 7대 AI 색인 메타데이터 기준과 1:1 일치하는 전체 선택지 목록 (+ '상관없음')
 */
export function getQuestionOptions(
  key: QuestionKey,
  skills: readonly string[] = [],
  userState?: UserStateCategory,
  hasRegionAndTime = true,
  context?: QuestionOptionContext,
): string[] {
  // 0순위: 오프닝
  if (key === 'opening') {
    if (hasRegionAndTime) {
      return ['네, 이 조건으로 찾을게요 👍', '이번엔 다른 조건으로 찾을래요 🔄'];
    }
    return ['활동할 지역 선택하기 📍', '지역 상관없이 전국 액션 볼래요 🌏'];
  }

  // 1순위: 관심 분야 (과거 활동 이력 질문 vs 전체 카테고리)
  if (key === 'talent_preference') {
    // 하위 호환성 유지: 이전 테스트 및 호출에서 talent_preference 키를 첫 질문으로 넘길 때
    if (userState === 'D') {
      return ['익숙한 분야가 좋아요', '새로운 도전을 해볼래요', '상관없음'];
    }
    if (userState === 'C') {
      return ['비슷한 활동을 이어갈래요', '새로운 분야를 찾아볼래요', '상관없음'];
    }
    if (userState === 'E') {
      return ['가볍게 다시 시작해볼래요', '새로운 활동을 찾아볼래요', '상관없음'];
    }
    return [
      '가진 재능을 살릴래요',
      '부담 없이 가볍게 시작할래요',
      '상관없음',
    ];
  }

  // 1순위: 카테고리 (categories / field_preference)
  // 과거 활동 이력이 있는 경우, 유저가 아직 '새로운 분야'를 고르지 않은 상태라면 2지선다 우선 제공
  if (key === 'categories' || key === 'field_preference') {
    if (context?.hasHistory && context.answers?.fieldPreference !== 'new') {
      return ['같은 분야로 찾을래요 👍', '새로운 분야에 도전해볼래요 ✨'];
    }
    return [
      '동물',
      '환경',
      '지역사회',
      '아동·청소년',
      '노인',
      '장애',
      '교육',
      '기타',
      '상관없음',
    ];
  }

  // 3-1순위: 재능 (skills)
  // 프로필에 재능이 있는 유저이고 아직 '새로운 재능'을 누르지 않은 상태라면 확인 2지선다 우선 제공
  if (key === 'skills') {
    if (
      context?.profileSkills &&
      context.profileSkills.length > 0 &&
      context.answers?.talentPreference !== 'new_skill'
    ) {
      return ['프로필 재능 그대로 활용 👍', '새로운 재능 이용 🔄'];
    }
    return [...ALL_15_SKILLS];
  }

  const options: Record<string, readonly string[]> = {
    opening: hasRegionAndTime
      ? ['네, 이 조건으로 찾을게요 👍', '이번엔 다른 조건으로 찾을래요 🔄']
      : ['활동할 지역 선택하기 📍', '지역 상관없이 전국 액션 볼래요 🌏'],
    target_groups: [
      '교류·교육·소통형',
      '육체·과업·집중형',
      '상관없음',
    ],
    vibe_preference: [
      '교류·교육·소통형',
      '육체·과업·집중형',
      '상관없음',
    ],
    difficulty: [
      '누구나 참여가능',
      '기초 체력 필요',
      '전문지식/자격/재능 활용',
      '상관없음',
    ],
    activity_types: [
      '실내 활동',
      '실외 활동',
      '실내외 병행',
      '상관없음',
    ],
    activity_type: [
      '실내 활동',
      '실외 활동',
      '실내외 병행',
      '상관없음',
    ],
    participation_modes: [
      '10명 이내 소그룹',
      '10~20명 중그룹',
      '20명 이상 대그룹',
      '상관없음',
    ],
    group_size: [
      '소규모 모임 (10명 안팎)',
      '중규모 모임 (10-20명)',
      '대규모 모임 (20명 이상)',
      '상관없음',
    ],
    travel_range: [
      '활동할 지역 선택하기 📍',
      '지역 상관없이 전국 액션 볼래요 🌏',
    ],
    time_pref: [
      '주말 오전',
      '주말 오후',
      '평일 낮',
      '평일 저녁',
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
    profileRegion = '등록된 지역',
    profileTimesSummary = '등록된 시간대',
    hasRegionAndTime = true,
  } = context;

  // 0순위: 오프닝 및 지역/시간 상시 확인
  if (key === 'opening') {
    if (hasRegionAndTime) {
      return [
        `안녕하세요, ${nickname}님! 😊`,
        `${nickname}님에게 딱 맞는 액션을 찾기 위해 프로필에 등록된 기본 조건을 확인해 봤어요.`,
        '',
        `📍 활동 지역 : ${profileRegion}`,
        `⏰ 선호 시간 : ${profileTimesSummary}`,
        '',
        '이 조건 그대로 액션을 찾아드릴까요?',
      ].join('\n');
    }

    return [
      `안녕하세요, ${nickname}님! 만나서 반가워요. 😊`,
      `${nickname}님에게 딱 맞는 액션을 찾아드리기 위해 활동하실 지역과 시간을 먼저 확인하고 싶어요.`,
      '',
      '먼저, 이번에 어느 지역에서 활동하고 싶으세요?',
    ].join('\n');
  }

  // 기존 talent_preference 키 오프닝 호환
  if (key === 'talent_preference') {
    if (userState === 'F') {
      return [
        '반가워요! 😊',
        '몇 가지만 편하게 알려주시면 꼭 맞는 액션을 찾아볼게요.',
        '먼저, 이번에는 가진 재능을 살려보고 싶으신가요, 아니면 부담 없이 가볍게 시작하고 싶으신가요?',
      ].join('\n');
    }

    if (userState === 'E') {
      const pastMention = pastActivitySummary ? `${pastActivitySummary}하셨던 기억이 나네요.` : '다시 뵙게 되어 기뻐요.';
      return [
        `반가워요, ${nickname}님! 😊`,
        pastMention,
        '이번에 다시 가볍게 시작해볼 만한 액션을 찾아볼까요?',
      ].join('\n');
    }

    if (userState === 'D') {
      const cat = compactList(fieldReferenceCategories);
      const target = cat ? `${cat} 분야` : '다양한 활동';
      return [
        `반가워요, ${nickname}님! 😊`,
        `주로 ${target}에 많이 참여하셨네요.`,
        '이번에도 익숙한 스타일로 갈까요, 새로운 도전을 해볼까요?',
      ].join('\n');
    }

    if (userState === 'C') {
      const cat = compactList(fieldReferenceCategories);
      const target = cat ? `${cat} 분야` : '지난번 활동';
      return [
        `반가워요, ${nickname}님! 😊`,
        `지난번에 ${target}에 참여하셨네요.`,
        '이번에도 비슷한 활동을 이어가볼까요, 아니면 새로운 분야를 찾아볼까요?',
      ].join('\n');
    }

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

    return [
      `반가워요, ${nickname}님! 😊`,
      `몇 가지만 편하게 알려주시면 ${nickname}님에게 꼭 맞는 액션을 찾아볼게요.`,
      '먼저, 이번에는 가진 재능을 살려보고 싶으신가요, 아니면 부담 없이 가볍게 시작하고 싶으신가요?',
    ].join('\n');
  }

  // 1순위: 관심 분야 (categories / field_preference)
  if (key === 'categories' || key === 'field_preference') {
    if (answers.fieldPreference === 'new') {
      return [
        '새로운 도전을 원하신다니 멋진 선택이에요! ✨',
        '이번에는 어떤 새로운 분야에 가장 관심이 가시나요?',
      ].join('\n');
    }

    const categories = compactList(fieldReferenceCategories);
    if (categories && hasHistory) {
      return [
        `${nickname}님의 지난 활동들을 살펴보니 [${categories}] 분야에 주로 참여하셨네요. 이번에도 비슷한 분야로 찾아드릴까요?`,
      ].join('\n');
    }

    return [
      '어떤 분야의 액션에 가장 관심이 가시나요?',
    ].join('\n');
  }

  // 2순위: 활동 성격 (target_groups / vibe_preference)
  if (key === 'target_groups' || key === 'vibe_preference') {
    return [
      `${nickname}님은 어떤 분위기의 활동이 더 끌리시나요?`,
      '사람들과 도란도란 소통하고 정을 나누는 활동이 좋으세요, 아니면 땀 흘리고 손발을 맞춰 집중하는 활동이 좋으세요?',
    ].join('\n');
  }

  // 3순위: 참여 난이도 (difficulty)
  if (key === 'difficulty') {
    return [
      '액션에 따라 난이도가 다를 수 있어요. 어떤 스타일을 원하세요?',
    ].join('\n');
  }

  // 3-1: 재능 활용 (skills)
  if (key === 'skills') {
    const skills = compactList(profileSkills);
    if (skills && answers.talentPreference !== 'new_skill') {
      return [
        `${nickname}님의 프로필에 [${skills}] 재능이 등록되어 있어요. 이번에도 이 재능으로 찾아볼까요?`,
      ].join('\n');
    }
    if (answers.talentPreference === 'new_skill') {
      return [
        '새로운 재능을 펼치고 싶으시군요! 멋져요 ✨',
        '어떤 새로운 재능을 나누고 싶으신가요?',
      ].join('\n');
    }
    return [
      '맞아요! 재능을 나눌 수 있다는 건 정말 멋진 일이에요.',
      '어떤 재능을 활용하고 싶으신가요?',
    ].join('\n');
  }

  // 4순위: 활동 환경 (activity_types / activity_type)
  if (key === 'activity_types' || key === 'activity_type') {
    const skillLead =
      answers.selectedSkill && answers.selectedSkill !== 'profile'
        ? `${answers.selectedSkill} 재능을 살릴 수 있는 활동을 함께 찾아볼게요! ✨\n`
        : '';
    return [
      `${skillLead}어떤 환경에서 활동하고 싶으세요?`,
      '날씨 걱정 없는 실내 활동이 좋으신가요, 활기찬 야외 활동이 끌리시나요?',
    ].join('\n');
  }

  // 5순위: 모임 규모 (participation_modes / group_size)
  if (key === 'participation_modes' || key === 'group_size') {
    return [
      '함께하는 크루의 규모는 어느 정도가 편하세요?',
      '10명 안팎의 오붓한 소규모가 좋으신가요, 아니면 북적북적한 큰 모임도 괜찮으세요?',
    ].join('\n');
  }

  // 이동 범위 질문 (travel_range)
  if (key === 'travel_range') {
    return [
      '다른 조건으로 액션을 찾아보는 것도 좋은 선택이에요! 😊',
      '그럼, 이번에 어느 지역에서 활동하고 싶으세요?',
    ].join('\n');
  }

  // 활동 시간대 질문 (time_pref)
  if (key === 'time_pref') {
    return [
      '보통 언제 참여하기 편하신가요? (복수 선택 가능)',
    ].join('\n');
  }

  return [
    '다음 조건에 대해 알려주세요.',
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

  // 오프닝 결정
  if (/이 조건으로|네.*이 조건|이대로|좋아요.*이 조건/.test(text)) {
    answers.openingDecision = 'confirm';
  } else if (/다른 조건|지역.*선택|전국.*액션|지역 상관없이|바꿀/.test(text)) {
    answers.openingDecision = 'change';
  }

  // 이동 범위 / 지역
  const regResult = extractRegionFromText(text);
  if (regResult.selectedRegion) {
    answers.selectedRegion = regResult.selectedRegion;
  }
  if (regResult.travelRange) {
    answers.travelRange = regResult.travelRange;
  }

  // 시간대
  const timePrefsSet = new Set<string>();
  if (/시간 상관없음|언제든/.test(text)) {
    answers.timePreference = 'any';
    timePrefsSet.add('시간 상관없음');
  }
  if (/주말 오전/.test(text)) {
    answers.timePreference = 'weekend_morning';
    timePrefsSet.add('주말 오전');
  }
  if (/주말 오후/.test(text)) {
    answers.timePreference = 'weekend_afternoon';
    timePrefsSet.add('주말 오후');
  }
  if (/평일 낮/.test(text)) {
    answers.timePreference = 'weekday_day';
    timePrefsSet.add('평일 낮');
  }
  if (/평일 저녁/.test(text)) {
    answers.timePreference = 'weekday_evening';
    timePrefsSet.add('평일 저녁');
  }
  if (timePrefsSet.size > 0) {
    answers.timePreferences = Array.from(timePrefsSet);
  }

  // 참여 방식 (하위 호환성)
  if (/물건|물품/.test(text)) {
    answers.participationMode = 'goods';
  } else if (/직접 행동|몸으로|몸을 움직|현장 활동/.test(text)) {
    answers.participationMode = 'direct';
  } else if (/시간을 내|시간으로/.test(text)) {
    answers.participationMode = 'time';
  }

  // 활동 환경 (activity_types)
  if (/실내외 병행|병행/.test(text)) {
    answers.activityType = 'both';
  } else if (/실내|날씨 안 타|비 안 맞|안에서|실내 활동/.test(text)) {
    answers.activityType = 'indoor';
  } else if (/실외|야외|바깥|공원|밖에서|야외 활동/.test(text)) {
    answers.activityType = 'outdoor';
  } else if (/환경.*상관|실내외.*상관|어디든 상관/.test(text)) {
    answers.activityType = 'any';
  }

  // 활동 성격 (target_groups)
  if (/교류|대화|교육|소통|말벗|멘토링|가르침|아이돌봄|교류·교육·소통형/.test(text)) {
    answers.vibePreference = 'social';
  } else if (/과업|몸 쓰|땀|집중|청소|플로깅|배달|일만|결과물|육체·과업·집중형/.test(text)) {
    answers.vibePreference = 'task';
  } else if (/스타일.*상관|성격.*상관|분위기.*상관/.test(text)) {
    answers.vibePreference = 'any';
  }

  // 모임 인원 규모 (participation_modes)
  if (/10명 이내|소규모|작은|적은|오붓|10명 안팎|혼자|혼자하는|소그룹/.test(text)) {
    answers.groupSizePreference = 'small';
  } else if (/10~20|10-20|10명에서 20명|중규모|중그룹/.test(text)) {
    answers.groupSizePreference = 'medium';
  } else if (/20명 이상|대규모|사람 많|북적|인원.*상관|규모.*상관|많아도|대그룹/.test(text)) {
    answers.groupSizePreference = 'large';
  }

  // 참여 난이도 (difficulty)
  if (/누구나|첫 참여|쉬운|부담 없|초보|누구나 참여가능/.test(text)) {
    answers.difficultyPreference = 'easy';
  } else if (/기초 체력|체력|몸 쓰는|힘쓰는|힘든|기초 체력 필요/.test(text)) {
    answers.difficultyPreference = 'physical';
  } else if (/전문지식|전문|자격|역량|기술|재능 활용|전문지식\/자격\/재능 활용/.test(text)) {
    answers.difficultyPreference = 'expert';
    answers.talentPreference = 'use';
  }

  // 재능 선호 & 구체적 재능
  if (/그대로 살릴|그대로 활용|이 재능|프로필 재능|기존 재능/.test(text)) {
    answers.talentPreference = 'use';
    answers.selectedSkill = 'profile';
  } else if (/새로운 재능|다른 재능|새 재능/.test(text)) {
    answers.talentPreference = 'new_skill';
  } else if (/특별한 재능 없이|재능.*상관|부담 없이|누구나/.test(text)) {
    answers.talentPreference = 'any';
  }

  const matchedSkills: string[] = [];
  for (const s of ALL_15_SKILLS) {
    if (s !== '기타' && text.includes(s)) {
      matchedSkills.push(s);
    }
  }
  if (matchedSkills.length > 0) {
    answers.selectedSkill = matchedSkills[0];
    answers.selectedSkills = matchedSkills;
    answers.talentPreference = 'use';
  }

  // 관심 분야 (categories)
  if (/같은 분야|비슷한 분야|하던 분야|익숙한 분야|원래 하던|기존/.test(text)) {
    answers.fieldPreference = 'familiar';
  } else if (/새로운 분야|새 분야|도전|다양한|새로운 것|새로운 분야에 도전/.test(text)) {
    answers.fieldPreference = 'new';
  }

  const categoryMap: Array<[RegExp, string]> = [
    [/동물/, '동물'],
    [/환경/, '환경'],
    [/지역사회/, '지역사회'],
    [/아동|청소년/, '아동·청소년'],
    [/노인|어르신/, '노인'],
    [/장애|장애인/, '장애'],
    [/교육/, '교육'],
    [/기타/, '기타'],
  ];

  for (const [regex, cat] of categoryMap) {
    if (regex.test(text)) {
      answers.selectedCategory = cat;
      if (!answers.fieldPreference) {
        answers.fieldPreference = 'selected';
      }
      break;
    }
  }

  if (/분야.*상관|주제.*상관/.test(text)) {
    answers.fieldPreference = 'any';
    answers.selectedCategory = '상관없음';
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

      // 0. 오프닝 확인 질문에 대한 답변
      if (/이 조건 그대로|기본 조건을 확인|활동하실 지역과 시간/.test(q)) {
        if (/이 조건으로|네|좋아요|이대로/.test(a)) {
          answers.openingDecision = 'confirm';
        } else if (/다른 조건|재선택|바꿀|전국/.test(a)) {
          answers.openingDecision = 'change';
        }
      }

      // 0-1. 이동 범위 / 지역 질문에 대한 답변
      if (/어느 지역|활동 장소|지역에서 활동|이동 범위|거리/.test(q)) {
        if (/상관없|전국|어디든/.test(a)) {
          answers.travelRange = 'any';
        } else {
          const regRes = extractRegionFromText(a);
          if (regRes.selectedRegion) answers.selectedRegion = regRes.selectedRegion;
          if (regRes.travelRange) answers.travelRange = regRes.travelRange;
        }
      }

      // 0-2. 시간대 질문에 대한 답변 (복수 선택 지원)
      if (/언제 참여|시간|주말|평일|오전|오후|저녁|낮/.test(q)) {
        const timePrefsSet = new Set<string>();
        if (/상관없/.test(a)) {
          answers.timePreference = 'any';
          timePrefsSet.add('시간 상관없음');
        }
        if (/주말 오전/.test(a)) {
          answers.timePreference = 'weekend_morning';
          timePrefsSet.add('주말 오전');
        }
        if (/주말 오후/.test(a)) {
          answers.timePreference = 'weekend_afternoon';
          timePrefsSet.add('주말 오후');
        }
        if (/평일 낮/.test(a)) {
          answers.timePreference = 'weekday_day';
          timePrefsSet.add('평일 낮');
        }
        if (/평일 저녁/.test(a)) {
          answers.timePreference = 'weekday_evening';
          timePrefsSet.add('평일 저녁');
        }
        if (/주말/.test(a) && !/주말 오전|주말 오후/.test(a)) {
          answers.timePreference = 'weekend';
        }
        if (/평일/.test(a) && !/평일 낮|평일 저녁/.test(a)) {
          answers.timePreference = 'weekday';
        }
        if (timePrefsSet.size > 0) {
          answers.timePreferences = Array.from(timePrefsSet);
        }
      }

      // 1. 모임 규모 질문에 대한 답변 (5순위)
      if (/모임 규모|인원|소규모|중규모|대규모|크루의 규모/.test(q)) {
        if (/상관없/.test(a)) answers.groupSizePreference = 'any';
        else if (/소규모|10명 안팎|10명 이내|작은|소그룹/.test(a)) answers.groupSizePreference = 'small';
        else if (/중규모|10-20|10~20|중그룹/.test(a)) answers.groupSizePreference = 'medium';
        else if (/대규모|20명 이상|대그룹/.test(a)) answers.groupSizePreference = 'large';
      }

      // 2. 참여 난이도 질문에 대한 답변 (3순위)
      if (/난이도|문턱|어떤 스타일을 원하세요|체력.*전문/.test(q)) {
        if (/상관없/.test(a)) answers.difficultyPreference = 'any';
        else if (/누구나|부담 없|초보/.test(a)) answers.difficultyPreference = 'easy';
        else if (/기초 체력|체력|몸 쓰는/.test(a)) answers.difficultyPreference = 'physical';
        else if (/전문지식|전문|자격|재능 활용/.test(a)) {
          answers.difficultyPreference = 'expert';
          answers.talentPreference = 'use';
        }
      }

      // 3. 환경 질문에 대한 답변 (4순위)
      if (/환경|실내|실외|야외|어떤 환경/.test(q)) {
        if (/상관없/.test(a)) answers.activityType = 'any';
        else if (/실내외 병행|병행/.test(a)) answers.activityType = 'both';
        else if (/실내/.test(a)) answers.activityType = 'indoor';
        else if (/실외|야외/.test(a)) answers.activityType = 'outdoor';
      }

      // 4. 활동 성격/스타일 질문에 대한 답변 (2순위)
      if (/분위기|스타일|성격|교류|소통|과업|집중/.test(q)) {
        if (/상관없/.test(a)) answers.vibePreference = 'any';
        else if (/교류|소통|교육/.test(a)) answers.vibePreference = 'social';
        else if (/과업|육체|집중|땀/.test(a)) answers.vibePreference = 'task';
      }

      // 5. 활동 분야 질문에 대한 답변 (1순위)
      if (/분야|카테고리|관심사|비슷한 분야|새로운 분야/.test(q)) {
        if (/상관없/.test(a)) {
          answers.fieldPreference = 'any';
          answers.selectedCategory = '상관없음';
        } else if (/새로운|도전/.test(a)) {
          answers.fieldPreference = 'new';
        } else if (/비슷|익숙|같은 분야/.test(a)) {
          answers.fieldPreference = 'familiar';
        }

        if (/동물/.test(a)) answers.selectedCategory = '동물';
        else if (/환경/.test(a)) answers.selectedCategory = '환경';
        else if (/지역사회/.test(a)) answers.selectedCategory = '지역사회';
        else if (/아동|청소년/.test(a)) answers.selectedCategory = '아동·청소년';
        else if (/노인|어르신/.test(a)) answers.selectedCategory = '노인';
        else if (/장애|장애인/.test(a)) answers.selectedCategory = '장애';
        else if (/교육/.test(a)) answers.selectedCategory = '교육';
        else if (/기타/.test(a)) answers.selectedCategory = '기타';

        if (answers.selectedCategory && !answers.fieldPreference) {
          answers.fieldPreference = 'selected';
        }
      }

      // 6. 재능 질문에 대한 답변 (3-1순위)
      if (/재능|살려보고|발휘|어떤 재능|어떤 새로운 재능/.test(q)) {
        if (/상관없|부담 없이|가볍게|특별한 재능 없이/.test(a)) {
          answers.talentPreference = 'any';
        } else if (/그대로|살릴|이 재능|프로필/.test(a)) {
          answers.selectedSkill = 'profile';
          answers.talentPreference = 'use';
        } else if (/새로운 재능|다른 재능/.test(a)) {
          answers.talentPreference = 'new_skill';
        } else {
          const matchedSkills: string[] = [];
          for (const s of ALL_15_SKILLS) {
            if (s !== '기타' && a.includes(s)) {
              matchedSkills.push(s);
            }
          }
          if (matchedSkills.length > 0) {
            answers.selectedSkill = matchedSkills[0];
            answers.selectedSkills = matchedSkills;
            answers.talentPreference = 'use';
          }
          if (
            matchedSkills.length === 0 &&
            a.trim() &&
            !/기타/.test(a) &&
            !CHEERING_OR_CASUAL_REGEX.test(a.trim())
          ) {
            const harmful = validateHarmfulSkillInput(a);
            if (!harmful.isHarmful) {
              answers.selectedSkill = a.trim();
              answers.selectedSkills = [a.trim()];
              answers.talentPreference = 'use';
            }
          }
        }
      }
    }
  }

  return answers;
}

/**
 * 다음 질문 키 추출 (5단계 우선순위 파이프라인 + 스마트 조건부 분기)
 *
 * 0순위: travel_range & time_pref (조건 변경 요청 시 또는 미등록 시)
 * 1순위: categories / field_preference (관심 분야)
 * 2순위: target_groups / vibe_preference (활동 성격)
 * 3순위: difficulty (참여 난이도)
 *   ➔ skills (난이도가 expert일 때만 진입. 프로필 재능 확인 ➔ 15종 재능 선택)
 * 4순위: activity_types / activity_type (활동 환경)
 * 5순위: participation_modes / group_size (모임 규모)
 */
export function getRemainingQuestionKeys({
  skillsAnswered = false,
  answers,
  userState = 'F',
  hasRegionAndTime = true,
  hasHistory = false,
  profileSkills = [],
}: {
  skillsAnswered?: boolean;
  answers: AdaptiveAnswers;
  userState?: UserStateCategory;
  hasRegionAndTime?: boolean;
  hasHistory?: boolean;
  profileSkills?: readonly string[];
}): QuestionKey[] {
  const remaining: QuestionKey[] = [];

  // 0순위: 다른 조건 변경이 요청되었거나 기본 지역/시간이 없는 경우
  const needsRegion =
    (answers.openingDecision === 'change' || !hasRegionAndTime) &&
    !answers.travelRange &&
    !answers.selectedRegion;
  if (needsRegion) {
    remaining.push('travel_range');
  }

  const needsTime =
    (answers.openingDecision === 'change' || !hasRegionAndTime) &&
    !answers.timePreference &&
    (!answers.timePreferences || answers.timePreferences.length === 0);
  if (needsTime) {
    remaining.push('time_pref');
  }

  // 1순위: 관심 분야 (categories / field_preference)
  // 카테고리 완료 판정:
  // 1) 이력 유저가 '같은 분야'를 선택했거나
  // 2) 특정 카테고리를 선택했거나 (selectedCategory 있음)
  // 3) 분야 상관없음이거나
  // 4) fieldPreference가 'selected'로 확정된 경우
  const categoryDone =
    answers.fieldPreference === 'familiar' ||
    Boolean(answers.selectedCategory) ||
    answers.fieldPreference === 'any' ||
    answers.fieldPreference === 'selected';

  if (!categoryDone) {
    remaining.push('field_preference');
  }

  // 2순위: 활동 성격 (target_groups / vibe_preference)
  if (!answers.vibePreference) {
    remaining.push('vibe_preference');
  }

  // 3순위: 참여 난이도 (difficulty)
  if (!answers.difficultyPreference) {
    remaining.push('difficulty');
  }

  // 3-1순위: 재능 질문 (skills) — 난이도가 '전문지식/자격/재능 활용'일 때만 조건부 진입!
  if (answers.difficultyPreference === 'expert') {
    // 재능 완료 판정:
    // 1) 상관없음/재능없이 참여
    // 2) 프로필 재능 그대로 활용 확정 ('profile')
    // 3) 15종 구체적 재능 선택 완료
    const skillDone =
      answers.talentPreference === 'any' ||
      answers.selectedSkill === 'profile' ||
      Boolean(answers.selectedSkill && answers.selectedSkill !== 'profile') ||
      Boolean(answers.selectedSkills && answers.selectedSkills.length > 0) ||
      skillsAnswered;

    if (!skillDone) {
      remaining.push('skills');
    }
  }

  // 4순위: 활동 환경 (activity_types / activity_type)
  if (!answers.activityType) {
    remaining.push('activity_type');
  }

  // 5순위: 모임 규모 (participation_modes / group_size)
  if (!answers.groupSizePreference) {
    remaining.push('group_size');
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
