/**
 * 서비스 전역 상수.
 *
 * 여기 없는 문자열을 화면에 직접 적지 말 것.
 * 사람마다 '아동청소년' / '아동·청소년' / '청소년' 을 다르게 적으면
 * 추천 필터가 조용히 안 맞기 시작한다.
 */

// ── 카테고리 (DB actions.category CHECK 와 반드시 같아야 한다) ──────────
export const CATEGORIES = [
  '동물',
  '환경',
  '지역사회',
  '아동·청소년',
  '노인',
  '장애',
  '교육',
  '기타',
] as const;
export type Category = (typeof CATEGORIES)[number];

// ── 참여 가능 시간 ────────────────────────────────────────────────
/**
 * @deprecated 2026-09-01 개편으로 TIME_DAYS + TIME_SLOTS 2단계 구조로 옮깁니다.
 * 추천 점수(lib/utils/scoring.ts)가 아직 이 값을 써서 남겨둡니다.
 * 개발 A 가 가입 화면과 점수 계산을 함께 옮긴 뒤에 지웁니다.
 */
export const AVAILABLE_TIMES = [
  '평일',
  '주말',
  '오전',
  '오후',
  '저녁',
  '시간이 생길 때마다',
] as const;
export type AvailableTime = (typeof AVAILABLE_TIMES)[number];

// ── 참여 가능 시간 2단계 ───────────────────────────────────────────
// ① 요일을 하나 고르고  ② 시간대를 여러 개 고릅니다.
// profiles.time_prefs 에 [{ day, slots }] 형태로 쌓입니다.
export const TIME_DAYS = ['평일', '주말', '상관없음'] as const;
export type TimeDay = (typeof TIME_DAYS)[number];

export const TIME_SLOTS = ['오전', '오후', '저녁', '밤', '상관없음'] as const;
export type TimeSlot = (typeof TIME_SLOTS)[number];

export interface TimePref {
  day: TimeDay;
  slots: TimeSlot[];
}

/**
 * 옛 available_times(6종 한 줄) 를 2단계 구조로 바꿉니다.
 *
 * F38 화면이 나오기 전까지 가입·프로필 수정이 아직 옛 형식으로 값을 모읍니다.
 * 그대로 저장하면 time_prefs 가 비어서, 나중에 F38 화면을 만들어도
 * 기존 회원의 설정이 안 보입니다. 그래서 저장할 때 여기서 변환합니다.
 *
 * F38 이 완성되면 화면이 TimePref 를 직접 만들게 되므로 이 함수는 필요 없어집니다.
 */
export function toTimePrefs(availableTimes: string[]): TimePref[] {
  const days = availableTimes.filter(
    (t): t is '평일' | '주말' => t === '평일' || t === '주말',
  );
  const anyDay = days.length === 0 || availableTimes.includes('시간이 생길 때마다');

  const slots = availableTimes.filter((t): t is TimeSlot =>
    (['오전', '오후', '저녁', '밤'] as string[]).includes(t),
  );
  const picked: TimeSlot[] = slots.length > 0 ? slots : ['상관없음'];

  return (anyDay ? (['상관없음'] as TimeDay[]) : days).map((day) => ({
    day,
    slots: picked,
  }));
}

/** "평일 오전" · "주말 저녁&밤" · "언제든 좋아요" */
export function describeTimePref(pref: TimePref): string {
  const anyDay = pref.day === '상관없음';
  const anySlot = pref.slots.length === 0 || pref.slots.includes('상관없음');
  if (anyDay && anySlot) return '언제든 좋아요';
  if (anySlot) return `${pref.day} 언제든`;
  const slots = pref.slots.join('&');
  return anyDay ? `요일 상관없이 ${slots}` : `${pref.day} ${slots}`;
}

// ── 성별 ─────────────────────────────────────────────────────────
export const GENDERS = ['MALE', 'FEMALE'] as const;
export type Gender = (typeof GENDERS)[number];

export const GENDER_LABEL: Record<Gender, string> = {
  MALE: '남성',
  FEMALE: '여성',
};

/** 항목별 성별 제한. 예) 남성 어르신 목욕 봉사 → MALE */
export const GENDER_REQUIREMENTS = ['MALE', 'FEMALE', 'ANY'] as const;
export type GenderRequirement = (typeof GENDER_REQUIREMENTS)[number];

export const GENDER_REQUIREMENT_LABEL: Record<GenderRequirement, string> = {
  MALE: '남성만',
  FEMALE: '여성만',
  ANY: '누구나',
};

// ── 액션 상태 ─────────────────────────────────────────────────────
export const ACTION_STATUSES = [
  'DRAFT',
  'ACTIVE',
  'ENDED',
  'COMPLETED',
  'CANCELLED',
] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export const ACTION_STATUS_LABEL: Record<ActionStatus, string> = {
  DRAFT: '작성 중',
  ACTIVE: '모집 중',
  ENDED: '결과 작성 필요',
  COMPLETED: '완료',
  CANCELLED: '취소됨',
};

// ── 참여 상태 ─────────────────────────────────────────────────────
export const PARTICIPATION_STATUSES = [
  'BEFORE_ACTION',
  'AFTER_ACTION',
  'ACTUALLY_PARTICIPATED',
  'LEFT',
] as const;
export type ParticipationStatus = (typeof PARTICIPATION_STATUSES)[number];

export const PARTICIPATION_STATUS_LABEL: Record<ParticipationStatus, string> = {
  BEFORE_ACTION: '참여 예정',
  AFTER_ACTION: '소감 작성 필요',
  ACTUALLY_PARTICIPATED: '참여 완료',
  LEFT: '참여 취소',
};

// ── 모집 항목 ─────────────────────────────────────────────────────
export type ItemType = 'PERSON' | 'GOODS';

/**
 * RANGE   min=3, max=3  → "정확히 3명"
 * RANGE   min=3, max=5  → "3~5명"
 * MINIMUM min=10, max=null → "최소 10명, 계속 모집"
 */
export type TargetType = 'RANGE' | 'MINIMUM';

/** 물품 단위 추천값. 자유 입력도 허용한다. */
export const UNIT_SUGGESTIONS = [
  '개',
  '통',
  '박스',
  '벌',
  '권',
  'kg',
  '세트',
] as const;

export const PERSON_UNIT = '명';

// ── 알림 8종 ──────────────────────────────────────────────────────
export const NOTIFICATION_TYPES = [
  'SCHEDULE',
  'RESULT_REQUEST',
  'RESULT_PUBLISHED',
  'VOICE_REQUEST',
  'CANCELLED',
  'INVITED',
  'LEFT_CREW',
  'SHORTFALL',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

// ── 업로드 제한 ────────────────────────────────────────────────────
export const UPLOAD = {
  /** 액션 대표 이미지 */
  ACTION_IMAGE_MAX: 3,
  /** 결과 사진 — 최소 1장 필수 */
  RESULT_IMAGE_MIN: 1,
  RESULT_IMAGE_MAX: 5,
  MAX_BYTES: 5 * 1024 * 1024,
  ALLOWED_MIME: ['image/jpeg', 'image/png', 'image/webp'] as const,
} as const;

// ── 텍스트 길이 ────────────────────────────────────────────────────
export const LIMITS = {
  CREW_VOICE_MIN: 10,
  CREW_VOICE_MAX: 1000,
  CHAT_MIN: 1,
  CHAT_MAX: 1000,
  NICKNAME_MIN: 2,
  NICKNAME_MAX: 20,
  BIO_MAX: 300,
  CANCEL_REASON_MIN: 5,
} as const;

// ─────────────────────────────────────────────────────────────
// 나눌 수 있는 재능 (10) — 가입 3단계, Discover 추천에 씁니다
//
// ★ 자유 입력이 아니라 이 목록에서 고릅니다.
//   "사진 / 사진 찍기 / 사진 촬영" 을 컴퓨터는 다른 말로 보기 때문에,
//   자유 입력을 받으면 액션이 필요로 하는 재능과 연결되지 않습니다.
//
// ★ profiles.skills 는 NULL 과 빈 배열이 다릅니다.
//     NULL  아직 안 물어봄 → AI 가 물어봐도 됩니다
//     []    없다고 답함    → 다시 묻지 않습니다
//   그래서 SKILL_NONE 을 고르면 빈 배열로 저장합니다.
// ─────────────────────────────────────────────────────────────
export const SKILLS = [
  '사진 촬영',
  '영상 촬영·편집',
  '디자인',
  '글쓰기',
  'SNS 홍보',
  '요리',
  '운전',
  '교육·멘토링',
  '통역·번역',
] as const;

export type Skill = (typeof SKILLS)[number];

/** "나눌 수 있는 재능 없음" 을 골랐을 때 — 빈 배열로 저장합니다 */
export const SKILL_NONE = '없음';
/** "아직 잘 모르겠음" — 저장하지 않습니다(NULL 유지). 나중에 다시 물어봅니다 */
export const SKILL_UNSURE = '모르겠음';
