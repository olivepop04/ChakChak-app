/**
 * 프로필 · 팔로우 · 사용자 검색. 담당: 개발 A
 *
 * 공개 범위 규칙 (팀 합의 D10)
 *  - 통계 4종은 공개한다.
 *  - 참여한 액션은 "완료된 것만" 보여준다. 참여 예정은 비공개.
 *  - 실명(name)보다 닉네임을 앞에 둔다.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';
import type { Gender } from '@/lib/constants';
import type { ProfileData, UserSummary, ActionCardData } from '@/lib/types/view';
import type { TimePref, NotificationType } from '@/lib/constants';
import { getUserSummaries } from '@/lib/queries/participations';
import { getActionCardsByIds } from '@/lib/queries/actions';
import { getPublicParticipatedActionIds } from '@/lib/queries/public-stats';
import { sortProfileActionsByLatestActivity } from '@/lib/utils/profile-actions';

type DB = SupabaseClient<Database>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getProfile(
  supabase: DB,
  userId: string,
  viewerId: string | null,
): Promise<ProfileData | null> {
  // 형식이 틀린 주소(/user/abc)는 DB 가 「uuid 형식 아님」 오류를 내서 404 대신 오류 화면이 떴습니다.
  // 없는 사람과 같게 null 을 돌려주면 화면들이 이미 notFound() 로 404 를 띄웁니다 (2026-09-30).
  if (!UUID_RE.test(userId)) return null;

  const { data: p, error } = await supabase
    .from('profiles')
    .select(
      'id, name, nickname, avatar, gender, bio, skills, categories, available_times, time_prefs, notify_off, regions',
    )
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!p) return null;

  const [summaries, { count: followerCount }, { count: followingCount }] =
    await Promise.all([
      getUserSummaries(supabase, [userId], viewerId),
      supabase
        .from('follows')
        .select('id', { count: 'exact', head: true })
        .eq('following_id', userId),
      supabase
        .from('follows')
        .select('id', { count: 'exact', head: true })
        .eq('follower_id', userId),
    ]);

  const s = summaries[0];

  return {
    id: p.id,
    name: p.name,
    nickname: p.nickname,
    avatar: p.avatar,
    gender: p.gender as Gender,
    // null 과 빈 배열을 구분해야 해서 ?? [] 를 쓰지 않습니다
    skills: p.skills,
    bio: p.bio,
    categories: p.categories ?? [],
    availableTimes: p.available_times ?? [],
    // 참여 가능 시간 2단계 (F38). 아직 안 옮긴 사람은 빈 배열이다.
    timePrefs: (p.time_prefs ?? []) as unknown as TimePref[],
    notifyOff: (p.notify_off ?? []) as NotificationType[],
    regions: p.regions ?? [],
    participatedCount: s?.participatedCount ?? 0,
    ledCount: s?.ledCount ?? 0,
    followerCount: followerCount ?? 0,
    followingCount: followingCount ?? 0,
    followedByMe: s?.followedByMe ?? false,
    isMe: viewerId === userId,
  };
}

/**
 * 타인 프로필의 "참여한 액션" 목록.
 * ★ 완료된 것만 보여준다. 참여 예정은 사생활이라 노출하지 않는다.
 */
export async function getParticipatedActions(
  supabase: DB,
  userId: string,
  viewerId: string | null,
): Promise<ActionCardData[]> {
  // participations 를 직접 읽으면 RLS 때문에 남의 참여가 안 보입니다 (16).
  const ids = await getPublicParticipatedActionIds(supabase, userId);
  if (ids.length === 0) return [];

  const cards = await getActionCardsByIds(supabase, ids, viewerId);
  // 함수가 이미 ENDED · COMPLETED 만 주지만, 카드 쪽 규칙도 그대로 둡니다.
  return sortProfileActionsByLatestActivity(
    cards.filter(
      (action) => action.status === 'COMPLETED' || action.status === 'ENDED',
    ),
  );
}

/** 팔로워 목록 */
export async function getFollowers(
  supabase: DB,
  userId: string,
  viewerId: string | null,
): Promise<UserSummary[]> {
  const { data } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('following_id', userId);
  return getUserSummaries(
    supabase,
    (data ?? []).map((f) => f.follower_id),
    viewerId,
  );
}

/** 팔로잉 목록 */
export async function getFollowing(
  supabase: DB,
  userId: string,
  viewerId: string | null,
): Promise<UserSummary[]> {
  const { data } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId);
  return getUserSummaries(
    supabase,
    (data ?? []).map((f) => f.following_id),
    viewerId,
  );
}

/**
 * Share 화면 사용자 검색.
 * 이름과 닉네임으로 검색한다 (2026-09-07 회의). 이메일·전화번호로는 못 찾는다.
 * 최소 2자, 최대 10명, 본인 제외.
 */
export async function searchUsers(
  supabase: DB,
  keyword: string,
  viewerId: string,
): Promise<UserSummary[]> {
  const q = keyword.trim();
  if (q.length < 2) return [];

  // 이름과 닉네임 둘 다 찾습니다 (2026-09-07 회의).
  //
  // 이름은 실명입니다. 실명으로 남을 찾을 수 있게 되는 변경이라
  // 팀에서 정하고 넣었습니다 — 화면 안내도 "이름과 닉네임으로 친구를
  // 찾을 수 있고, 상대방 알림으로 보내져요" 로 바꿉니다.
  //
  // 검색어의 % 와 _ 는 뜻이 있는 글자라 그대로 두면 "모두 찾기" 가 됩니다.
  // 사람이 친 글자 그대로 찾도록 막아둡니다.
  const safe = q.replace(/[\\%_]/g, (c) => `\\${c}`);

  // 쉼표·괄호·큰따옴표는 .or() 문법을 깨서 결과가 늘 0명이었습니다 (2026-09-30).
  // LIKE 의 한 글자 자리(_)로 바꾸면 문법은 안 깨지고 그 글자도 그대로 찾아집니다.
  const orSafe = safe.replace(/[,()"]/g, '_');

  const { data } = await supabase
    .from('profiles')
    .select('id')
    .or(`nickname.ilike.%${orSafe}%,name.ilike.%${orSafe}%`)
    .neq('id', viewerId)
    .limit(10);

  return getUserSummaries(
    supabase,
    (data ?? []).map((p) => p.id),
    viewerId,
  );
}
