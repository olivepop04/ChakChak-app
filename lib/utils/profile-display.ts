export interface ProfileStatItem {
  value: number;
  label: string;
  href?: string;
}

interface BuildProfileStatsInput {
  ledCount: number;
  participatedCount: number;
  followerCount: number;
  followingCount: number;
  ledHref?: string;
  participatedHref?: string;
  followersHref: string;
  followingHref: string;
}

/** 내 프로필과 타인 프로필에서 같은 통계 순서와 문구를 사용합니다. */
export function buildProfileStats({
  ledCount,
  participatedCount,
  followerCount,
  followingCount,
  ledHref,
  participatedHref,
  followersHref,
  followingHref,
}: BuildProfileStatsInput): ProfileStatItem[] {
  return [
    { value: ledCount, label: '호스트한 액션', href: ledHref },
    { value: participatedCount, label: '참여한 액션', href: participatedHref },
    { value: followerCount, label: '팔로워', href: followersHref },
    { value: followingCount, label: '팔로잉', href: followingHref },
  ];
}

/** 낙관적 팔로우 변경과 실패 복구 때 프로필의 팔로워 수도 함께 맞춥니다. */
export function getFollowerCountAfterToggle(
  currentCount: number,
  nowFollowing: boolean,
): number {
  return Math.max(0, currentCount + (nowFollowing ? 1 : -1));
}

/** 빈 목록의 이용 안내는 자신의 팔로워·팔로잉 화면에서만 보여줍니다. */
export function shouldShowFollowEmptyHint(
  viewerId: string | null | undefined,
  profileId: string,
): boolean {
  return viewerId === profileId;
}
