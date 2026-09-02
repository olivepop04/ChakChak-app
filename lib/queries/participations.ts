/**
 * 참여 · 크루 · 결과 조회.
 *
 * ★ 참여 "생성" 은 여기 없다. joinAction() 을 부를 것. (lib/mutations.ts)
 *   여기 있는 건 조회 전용이다.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';
import type {
  JoinedActionData,
  UserSummary,
  CrewMember,
  CrewItem,
  CrewItemGroup,
  ActionResultData,
} from '@/lib/types/view';
import type { ParticipationStatus, ItemType, ActionStatus } from '@/lib/constants';
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
         address, place_name, status, activity_start_at, recruit_end_at,
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
    place_name: string | null;
    recruit_end_at: string | null;
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
        placeName: a.place_name,
        status: a.status as ActionStatus,
        activityStartAt: a.activity_start_at,
        recruitEndAt: a.recruit_end_at,
        owner: a.owner ?? { id: '', nickname: '알 수 없음' },
        likeCount: c?.like_count ?? 0,
        saveCount: c?.save_count ?? 0,
        crewCount: c?.crew_count ?? 0,
        likedByMe: likedSet.has(a.id),
        savedByMe: savedSet.has(a.id),
        participationStatus: p.status as ParticipationStatus,
        mySelection: (selectionMap.get(p.id) ?? []).join(' · '),
        hasVoice: votedSet.has(a.id),
      };
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
): Promise<{ owner: UserSummary | null; crew: CrewMember[] }> {
  const { data: action } = await supabase
    .from('actions')
    .select('owner_id')
    .eq('id', actionId)
    .maybeSingle();

  const { data: parts } = await supabase
    .from('participations')
    .select('id, user_id')
    .eq('action_id', actionId)
    .neq('status', 'LEFT');

  const crewIds = (parts ?? []).map((p) => p.user_id);
  const allIds = action?.owner_id ? [action.owner_id, ...crewIds] : crewIds;
  if (allIds.length === 0) return { owner: null, crew: [] };

  // 누가 어느 항목에 참여했는지. 항목별 보기(F45)에 필요합니다.
  const partIds = (parts ?? []).map((p) => p.id);
  const { data: rows } = partIds.length
    ? await supabase
        .from('participation_items')
        .select(
          `participation_id, quantity,
           item:action_items!participation_items_action_item_id_fkey
             ( id, name, unit, type )`,
        )
        .in('participation_id', partIds)
    : { data: [] };

  type ItemRow = {
    participation_id: string;
    quantity: number;
    item: { id: string; name: string; unit: string; type: ItemType } | null;
  };
  const itemsByPart = new Map<string, CrewItem[]>();
  for (const r of (rows ?? []) as unknown as ItemRow[]) {
    if (!r.item) continue;
    const list = itemsByPart.get(r.participation_id) ?? [];
    list.push({
      itemId: r.item.id,
      name: r.item.name,
      quantity: r.quantity,
      unit: r.item.unit,
      type: r.item.type,
    });
    itemsByPart.set(r.participation_id, list);
  }

  const summaries = await getUserSummaries(supabase, allIds, viewerId);
  const map = new Map(summaries.map((s) => [s.id, s]));

  const crew: CrewMember[] = [];
  for (const p of parts ?? []) {
    const base = map.get(p.user_id);
    if (!base) continue;
    const items = itemsByPart.get(p.id) ?? [];
    crew.push({ ...base, items, selection: describeSelection(items) });
  }

  return {
    owner: action?.owner_id ? (map.get(action.owner_id) ?? null) : null,
    crew,
  };
}

/** 참여 내용을 한 줄로: "산책 도우미 · 사료 10포" */
function describeSelection(items: CrewItem[]): string {
  return items
    .map((i) => (i.type === 'PERSON' ? i.name : `${i.name} ${i.quantity}${i.unit}`))
    .join(' · ');
}

/**
 * 크루를 "항목별" 로 다시 묶는다 (F45).
 *
 * 사람 기준 목록을 항목 기준으로 뒤집습니다.
 * 활동이 여러 날이면 항목을 "1일차 배식팀" 처럼 날짜로 나누게 되는데,
 * 그때 "1일차에 누가 오나" 를 이 함수로 볼 수 있습니다.
 *
 *   const { crew } = await getActionCrew(...);
 *   const groups = groupCrewByItem(crew);
 *   // [{ itemId, name, unit, type, total, members: [...] }, ...]
 *
 * 순서는 액션의 모집 항목 순서가 아니라 사람들이 고른 순서입니다.
 * 항목 순서대로 보여주려면 getActionItems() 의 순서에 맞춰 정렬하세요.
 */
export function groupCrewByItem(crew: CrewMember[]): CrewItemGroup[] {
  const groups = new Map<string, CrewItemGroup>();

  for (const person of crew) {
    for (const item of person.items) {
      let g = groups.get(item.itemId);
      if (!g) {
        g = {
          itemId: item.itemId,
          name: item.name,
          unit: item.unit,
          type: item.type,
          total: 0,
          members: [],
        };
        groups.set(item.itemId, g);
      }
      g.total += item.quantity;
      g.members.push({ person, quantity: item.quantity });
    }
  }

  return [...groups.values()];
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
