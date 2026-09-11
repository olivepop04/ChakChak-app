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
    // 「참여한 액션」 이 아니라 「참여 완료 액션」 입니다 (2026-09-11 회의).
    // 이 숫자는 소감까지 쓴 것(ACTUALLY_PARTICIPATED)만 셉니다.
    // Activity 탭의 「참여한 액션」 은 참여 예정까지 전부 보여주므로 이름이 다릅니다 —
    // 두 곳이 같은 이름이라 "목록엔 있는데 숫자는 0" 으로 보였습니다.
    { value: participatedCount, label: '참여 완료 액션', href: participatedHref },
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
