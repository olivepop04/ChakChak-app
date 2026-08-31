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
  ParticipationStatus,
  GenderRequirement,
  ItemType,
  TargetType,
  NotificationType,
} from '@/lib/constants';

/** 카드에 필요한 최소 정보. Home·Discover·Activity·저장목록이 전부 이걸 쓴다. */
export interface ActionCardData {
  id: string;
  title: string;
  summary: string | null;
  category: Category;
  /** 대표 이미지 1장. 없으면 null → 컴포넌트가 대체 표시를 그린다 */
  thumbnailUrl: string | null;
  address: string | null;
  status: ActionStatus;
  activityStartAt: string | null;
  owner: { id: string; nickname: string };
  likeCount: number;
  saveCount: number;
  crewCount: number;
  /** 로그인 사용자 기준. 비로그인이면 false */
  likedByMe: boolean;
  savedByMe: boolean;
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
  category: Category;
  imageUrls: string[];
  thumbnailIndex: number;
  address: string | null;
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

/** 타인 프로필 / MY 화면 */
export interface ProfileData extends UserSummary {
  name: string;
  categories: string[];
  availableTimes: string[];
  regions: string[];
  followerCount: number;
  followingCount: number;
  isMe: boolean;
}

/** 게시판 원글 + 댓글 */
export interface ChatPost {
  id: string;
  content: string;
  createdAt: string;
  deletedAt: string | null;
  author: { id: string; nickname: string };
  isMine: boolean;
  replies: ChatReply[];
}

export interface ChatReply {
  id: string;
  content: string;
  createdAt: string;
  deletedAt: string | null;
  author: { id: string; nickname: string };
  isMine: boolean;
}

/** 알림 목록 */
export interface NotificationData {
  id: string;
  type: NotificationType;
  actionId: string | null;
  actionTitle: string | null;
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
