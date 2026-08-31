/**
 * 참여 · 크루 · 결과 조회.
 *
 * ★ 참여 "생성" 은 여기 없다. join_action RPC 를 부를 것. (lib/actions/mutations.ts)
 *   여기 있는 건 조회 전용이다.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';
import type {
  JoinedActionData,
  UserSummary,
  ActionResultData,
} from '@/lib/types/view';
import type { ParticipationStatus } from '@/lib/constants';
import { getActionItems, pickThumbnail } from '@/lib/queries/actions';

type DB = SupabaseClient<Database>;

// ─────────────────────────────────────────────────────────────
// Activity — Joined 탭. 담당: 조장
// 나간 것(LEFT)은 목록에서 뺀다.
// ─────────────────────────────────────────────────────────────
export async function getMyJoinedActions(
  supabase: DB,
  userId: string,
): Promise<JoinedActionData[]> {
  const { data: parts, error } = await supabase
    .from('participations')
    .select('id, action_id, status, created_at')
    .eq('user_id', userId)
    .neq('status', 'LEFT')
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!parts || parts.length === 0) return [];

  const actionIds = parts.map((p) => p.action_id);

  const [
    { data: actions },
    { data: myItems },
    { data: counts },
    { data: voices },
    { data: likes },
    { data: saves },
  ] = await Promise.all([
    supabase
      .from('actions')
      .select(
        `id, title, description, category, image_urls, thumbnail_index,
         address, status, activity_start_at,
         owner:profiles!actions_owner_id_fkey ( id, nickname )`,
      )
      .in('id', actionIds),
    supabase
      .from('participation_items')
      .select(
        `participation_id, quantity,
         item:action_items!participation_items_action_item_id_fkey ( name, unit, type )`,
      )
      .in(
        'participation_id',
        parts.map((p) => p.id),
      ),
    supabase
      .from('action_social_counts')
      .select('action_id, like_count, save_count, crew_count')
      .in('action_id', actionIds),
    supabase
      .from('crew_voices')
      .select('action_id')
      .eq('user_id', userId)
      .in('action_id', actionIds),
    supabase
      .from('likes')
      .select('action_id')
      .eq('user_id', userId)
      .in('action_id', actionIds),
    supabase
      .from('saves')
      .select('action_id')
      .eq('user_id', userId)
      .in('action_id', actionIds),
  ]);

  type ActionRow = {
    id: string;
    title: string;
    description: string | null;
    category: string;
    image_urls: string[];
    thumbnail_index: number;
    address: string | null;
    status: string;
    activity_start_at: string | null;
    owner: { id: string; nickname: string } | null;
  };

  const actionMap = new Map(
    ((actions ?? []) as unknown as ActionRow[]).map((a) => [a.id, a]),
  );
  const countMap = new Map((counts ?? []).map((c) => [c.action_id, c]));
  const votedSet = new Set((voices ?? []).map((v) => v.action_id));
  const likedSet = new Set((likes ?? []).map((l) => l.action_id));
  const savedSet = new Set((saves ?? []).map((s) => s.action_id));

  // 참여 항목을 "일반 Crew · 분유 10통" 형태로 묶는다
  const selectionMap = new Map<string, string[]>();
  type ItemRow = {
    participation_id: string;
    quantity: number;
    item: { name: string; unit: string; type: string } | null;
  };
  for (const row of (myItems ?? []) as unknown as ItemRow[]) {
    if (!row.item) continue;
    const label =
      row.item.type === 'PERSON'
        ? row.item.name
        : `${row.item.name} ${row.quantity}${row.item.unit}`;
    const list = selectionMap.get(row.participation_id) ?? [];
    list.push(label);
    selectionMap.set(row.participation_id, list);
  }

  return parts
    .map((p) => {
      const a = actionMap.get(p.action_id);
      if (!a) return null;
      const c = countMap.get(p.action_id);
      return {
        id: a.id,
        title: a.title,
        summary: a.description?.slice(0, 60) ?? null,
        category: a.category,
        thumbnailUrl: pickThumbnail(a.image_urls, a.thumbnail_index),
        address: a.address,
        status: a.status,
        activityStartAt: a.activity_start_at,
        owner: a.owner ?? { id: '', nickname: '알 수 없음' },
        likeCount: c?.like_count ?? 0,
        saveCount: c?.save_count ?? 0,
        crewCount: c?.crew_count ?? 0,
        likedByMe: likedSet.has(a.id),
        savedByMe: savedSet.has(a.id),
        participationStatus: p.status as ParticipationStatus,
        mySelection: (selectionMap.get(p.id) ?? []).join(' · '),
        hasVoice: votedSet.has(a.id),
      } as JoinedActionData;
    })
    .filter((x): x is JoinedActionData => x !== null);
}

// ─────────────────────────────────────────────────────────────
// The Crew 화면. 담당: 개발 B
// Owner 를 맨 앞에 두고, 나간 사람은 뺀다.
// ─────────────────────────────────────────────────────────────
export async function getActionCrew(
  supabase: DB,
  actionId: string,
  viewerId: string | null,
): Promise<{ owner: UserSummary | null; crew: UserSummary[] }> {
  const { data: action } = await supabase
    .from('actions')
    .select('owner_id')
    .eq('id', actionId)
    .maybeSingle();

  const { data: parts } = await supabase
    .from('participations')
    .select('user_id')
    .eq('action_id', actionId)
    .neq('status', 'LEFT');

  const crewIds = (parts ?? []).map((p) => p.user_id);
  const allIds = action?.owner_id ? [action.owner_id, ...crewIds] : crewIds;
  if (allIds.length === 0) return { owner: null, crew: [] };

  const summaries = await getUserSummaries(supabase, allIds, viewerId);
  const map = new Map(summaries.map((s) => [s.id, s]));

  return {
    owner: action?.owner_id ? (map.get(action.owner_id) ?? null) : null,
    crew: crewIds
      .map((id) => map.get(id))
      .filter((x): x is UserSummary => x !== undefined),
  };
}

/**
 * 여러 사용자의 활동 이력을 한 번에.
 * 참여 수는 ACTUALLY_PARTICIPATED 만 센다 (소감까지 쓴 것).
 */
export async function getUserSummaries(
  supabase: DB,
  userIds: string[],
  viewerId: string | null,
): Promise<UserSummary[]> {
  if (userIds.length === 0) return [];

  const [{ data: profiles }, { data: parts }, { data: led }, { data: follows }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('id, nickname, bio')
        .in('id', userIds),
      supabase
        .from('participations')
        .select('user_id')
        .in('user_id', userIds)
        .eq('status', 'ACTUALLY_PARTICIPATED'),
      supabase
        .from('actions')
        .select('owner_id')
        .in('owner_id', userIds)
        .in('status', ['ACTIVE', 'ENDED', 'COMPLETED']),
      viewerId
        ? supabase
            .from('follows')
            .select('following_id')
            .eq('follower_id', viewerId)
            .in('following_id', userIds)
        : Promise.resolve({ data: [] as { following_id: string }[] }),
    ]);

  const partCount = new Map<string, number>();
  for (const p of parts ?? [])
    partCount.set(p.user_id, (partCount.get(p.user_id) ?? 0) + 1);

  const ledCount = new Map<string, number>();
  for (const a of led ?? [])
    ledCount.set(a.owner_id, (ledCount.get(a.owner_id) ?? 0) + 1);

  const followedSet = new Set((follows ?? []).map((f) => f.following_id));

  return (profiles ?? []).map((p) => ({
    id: p.id,
    nickname: p.nickname,
    bio: p.bio,
    participatedCount: partCount.get(p.id) ?? 0,
    ledCount: ledCount.get(p.id) ?? 0,
    followedByMe: followedSet.has(p.id),
  }));
}

// ─────────────────────────────────────────────────────────────
// 결과 화면. 담당: 개발 B
// ─────────────────────────────────────────────────────────────
export async function getActionResult(
  supabase: DB,
  actionId: string,
): Promise<ActionResultData | null> {
  const [{ data: result }, items, { data: voices }] = await Promise.all([
    supabase
      .from('action_results')
      .select('content, image_urls, owner_voice')
      .eq('action_id', actionId)
      .maybeSingle(),
    getActionItems(supabase, actionId),
    supabase
      .from('crew_voices')
      .select(
        `id, content, created_at,
         author:profiles!crew_voices_user_id_fkey ( id, nickname )`,
      )
      .eq('action_id', actionId)
      .order('created_at', { ascending: false }),
  ]);

  if (!result) return null;

  type VoiceRow = {
    id: string;
    content: string;
    created_at: string;
    author: { id: string; nickname: string } | null;
  };

  return {
    content: result.content,
    imageUrls: result.image_urls ?? [],
    ownerVoice: result.owner_voice,
    items,
    crewVoices: ((voices ?? []) as unknown as VoiceRow[]).map((v) => ({
      id: v.id,
      content: v.content,
      createdAt: v.created_at,
      author: v.author ?? { id: '', nickname: '알 수 없음' },
    })),
  };
}
