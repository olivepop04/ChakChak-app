/**
 * 화면에 전달되는 데이터 모양(뷰 모델).
 *
 * 여러 사람이 같은 컴포넌트를 쓰기 때문에, 여기 정의된 모양을 임의로 바꾸면
 * 다른 사람 화면이 조용히 깨진다. 바꿔야 하면 팀에 먼저 알릴 것.
 *
 * DB 원본 타입은 lib/types/database.ts 에 있다.
 * 이 파일은 "화면이 실제로 받는 것" 만 정의한다.
 */
import type {
  ActionStatus,
  Category,
  Gender,
  ParticipationStatus,
  GenderRequirement,
  ItemType,
  TargetType,
  NotificationType,
  TimePref,
} from '@/lib/constants';

/** 카드에 필요한 최소 정보. Home·Discover·Activity·저장목록이 전부 이걸 쓴다. */
export interface ActionCardData {
  id: string;
  title: string;
  summary: string | null;
  /** 대표 카테고리 = categories[0]. 배지 하나만 그릴 때 씁니다 */
  category: Category;
  /** 카테고리 1~3개 (14). 여러 개를 보여줄 때 씁니다 */
  categories: Category[];
  /** 대표 이미지 1장. 없으면 null → 컴포넌트가 대체 표시를 그린다 */
  thumbnailUrl: string | null;
  address: string | null;
  /** 장소 이름. 호스트가 직접 입력. 예) 신라목욕탕 */
  placeName: string | null;
  status: ActionStatus;
  activityStartAt: string | null;
  /** 모집 마감 시각. "마감 임박" 표시와 정렬에 씁니다 */
  recruitEndAt: string | null;
  owner: { id: string; nickname: string };
  likeCount: number;
  saveCount: number;
  crewCount: number;
  /** 공유한 횟수 (10). 공유할 때마다 1 씩 늘어납니다 */
  shareCount: number;
  /** 로그인 사용자 기준. 비로그인이면 false */
  likedByMe: boolean;
  savedByMe: boolean;
  /** 모집 마감 시각이 지났는지 여부 */
  recruitClosed?: boolean;
}

/** 모집 항목 + 현재 진행 상황. QuotaProgress 에 그대로 넘길 수 있다. */
export interface ActionItemWithProgress {
  id: string;
  type: ItemType;
  name: string;
  target_type: TargetType;
  min_required: number;
  max_allowed: number | null;
  unit: string;
  gender_requirement: GenderRequirement;
  conditionName: string | null;
  conditionDesc: string | null;
  currentCount: number;
  isFull: boolean;
  isMinMet: boolean;
}

/** Action Detail 화면 전체 */
export interface ActionDetailData {
  id: string;
  title: string;
  description: string | null;
  /** 대표 카테고리 = categories[0]. 배지 하나만 그릴 때 씁니다 */
  category: Category;
  /** 카테고리 1~3개 (14). 여러 개를 보여줄 때 씁니다 */
  categories: Category[];
  imageUrls: string[];
  thumbnailIndex: number;
  address: string | null;
  /** 장소 이름. 호스트가 직접 입력. 예) 신라목욕탕 */
  placeName: string | null;
  notice: string | null;
  status: ActionStatus;
  cancelReason: string | null;
  recruitEndAt: string | null;
  activityStartAt: string | null;
  activityEndAt: string | null;
  owner: { id: string; nickname: string; bio: string | null };
  items: ActionItemWithProgress[];
  likeCount: number;
  saveCount: number;
  crewCount: number;
  shareCount: number;
  likedByMe: boolean;
  savedByMe: boolean;
  followingOwner: boolean;
  /** 내 참여 상태. 참여한 적 없으면 null */
  myParticipation: ParticipationStatus | null;
  isOwner: boolean;
  /** 모집 마감 시각이 지났는가 */
  recruitClosed: boolean;
}

/** Activity — 내가 참여한 액션 */
export interface JoinedActionData extends ActionCardData {
  participationStatus: ParticipationStatus;
  /** 내가 고른 항목 요약: "일반 Crew · 분유 10통" */
  mySelection: string;
  /** 소감을 이미 썼는가 */
  hasVoice: boolean;
}

/** The Crew / 팔로워 목록 등에서 쓰는 사용자 요약 */
export interface UserSummary {
  id: string;
  nickname: string;
  bio: string | null;
  /** 소감까지 쓴 참여 수 */
  participatedCount: number;
  /** 만든 액션 중 공개된 수 */
  ledCount: number;
  /** 로그인 사용자가 이 사람을 팔로우 중인가 */
  followedByMe: boolean;
}

/** 크루 한 사람이 고른 모집 항목 하나 */
export interface CrewItem {
  itemId: string;
  name: string;
  quantity: number;
  unit: string;
  type: ItemType;
}

/** The Crew 목록의 한 사람. 무엇에 참여했는지가 함께 옵니다 */
export interface CrewMember extends UserSummary {
  /** "산책 도우미 · 사료 10포" — 사람 기준으로 보여줄 때 */
  selection: string;
  /** 항목 기준으로 묶을 때 쓰는 원자료 (F45) */
  items: CrewItem[];
}

/** groupCrewByItem() 의 결과. 항목 하나와 거기 참여한 사람들 */
export interface CrewItemGroup {
  itemId: string;
  name: string;
  unit: string;
  type: ItemType;
  /** 이 항목에 모인 총 수량. 사람 항목이면 인원수 */
  total: number;
  members: { person: CrewMember; quantity: number }[];
}

/** 타인 프로필 / MY 화면 */
export interface ProfileData extends UserSummary {
  name: string;
  /** 가입 시 필수. 바꿀 수 없고 표시만 한다 */
  gender: Gender;
  /**
   * 나눌 수 있는 재능 (10).
   * null 은 "아직 안 물어봤음", 빈 배열은 "없다고 답함" 입니다.
   * 둘을 섮으면 재능 없는 사람에게 AI 가 계속 재능을 묻습니다.
   */
  skills: string[] | null;
  categories: string[];
  /**
   * @deprecated 2026-09-01 개편으로 timePrefs 로 옮기는 중입니다.
   * 추천 점수(scoring.ts)가 아직 이 값을 써서 남겨둡니다.
   */
  availableTimes: string[];
  /** 참여 가능 시간 2단계 (F38). [{ day: '평일', slots: ['오전'] }] */
  timePrefs: TimePref[];
  regions: string[];
  /** 사용자가 끈 알림 종류. 빈 배열이면 전부 받습니다 (F25) */
  notifyOff: NotificationType[];
  followerCount: number;
  followingCount: number;
  isMe: boolean;
}

/** 게시판 원글 + 댓글 */
/** NORMAL 은 보통 글, LEFT_NOTICE 는 참여를 취소하며 남긴 사유 */
export type ChatKind = 'NORMAL' | 'LEFT_NOTICE';

export interface ChatPost {
  id: string;
  content: string;
  createdAt: string;
  deletedAt: string | null;
  kind: ChatKind;
  author: { id: string; nickname: string };
  isMine: boolean;
  replies: ChatReply[];
}

export interface ChatReply {
  id: string;
  content: string;
  createdAt: string;
  deletedAt: string | null;
  kind: ChatKind;
  author: { id: string; nickname: string };
  isMine: boolean;
}

/** 알림 목록 */
export interface NotificationData {
  id: string;
  type: NotificationType;
  actionId: string | null;
  actionTitle: string | null;
  /** 알림마다 다른 문장. 예) 나가기 사유. 없으면 템플릿 문구만 보여줍니다 */
  body: string | null;
  isRead: boolean;
  createdAt: string;
}

/** 결과 화면 */
export interface ActionResultData {
  content: string | null;
  imageUrls: string[];
  ownerVoice: string | null;
  /** 항목별 최종 집계 */
  items: ActionItemWithProgress[];
  crewVoices: Array<{
    id: string;
    content: string;
    createdAt: string;
    author: { id: string; nickname: string };
  }>;
}
