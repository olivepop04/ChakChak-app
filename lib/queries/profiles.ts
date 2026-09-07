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
import type { TimePref, NotificationType, ActionStatus } from '@/lib/constants';
import { getUserSummaries } from '@/lib/queries/participations';
import { pickThumbnail } from '@/lib/queries/actions';

type DB = SupabaseClient<Database>;

export async function getProfile(
  supabase: DB,
  userId: string,
  viewerId: string | null,
): Promise<ProfileData | null> {
  const { data: p, error } = await supabase
    .from('profiles')
    .select(
      'id, name, nickname, gender, bio, skills, categories, available_times, time_prefs, notify_off, regions',
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
  const { data: parts } = await supabase
    .from('participations')
    .select('action_id')
    .eq('user_id', userId)
    .eq('status', 'ACTUALLY_PARTICIPATED');

  const ids = (parts ?? []).map((p) => p.action_id);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('actions')
    .select(
      `id, title, description, category, categories, image_urls, thumbnail_index,
       address, place_name, status, activity_start_at, recruit_end_at,
       owner:profiles!actions_owner_id_fkey ( id, nickname )`,
    )
    .in('id', ids)
    .in('status', ['COMPLETED', 'ENDED']);

  if (error) throw error;

  type Row = {
    id: string;
    title: string;
    description: string | null;
    category: string;
    categories: string[] | null;
    image_urls: string[];
    thumbnail_index: number;
    address: string | null;
    place_name: string | null;
    recruit_end_at: string | null;
    status: string;
    activity_start_at: string | null;
    owner: { id: string; nickname: string } | null;
  };

  return ((data ?? []) as unknown as Row[]).map((a) => ({
    id: a.id,
    title: a.title,
    summary: a.description?.slice(0, 60) ?? null,
    category: a.category,
    categories: a.categories ?? [a.category],
    thumbnailUrl: pickThumbnail(a.image_urls, a.thumbnail_index),
    address: a.address,
    placeName: a.place_name,
    status: a.status as ActionStatus,
    activityStartAt: a.activity_start_at,
    recruitEndAt: a.recruit_end_at,
    owner: a.owner ?? { id: '', nickname: '알 수 없음' },
    likeCount: 0,
    saveCount: 0,
    crewCount: 0,
    likedByMe: false,
    savedByMe: false,
  })) as ActionCardData[];
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

  const { data } = await supabase
    .from('profiles')
    .select('id')
    .or(`nickname.ilike.%${safe}%,name.ilike.%${safe}%`)
    .neq('id', viewerId)
    .limit(10);

  return getUserSummaries(
    supabase,
    (data ?? []).map((p) => p.id),
    viewerId,
  );
}
