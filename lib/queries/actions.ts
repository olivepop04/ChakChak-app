/**
 * 액션 조회 함수 모음.
 *
 * ★ 화면에서 supabase.from('actions')... 를 직접 쓰지 말고 여기 함수를 부르세요.
 *
 * 직접 쓰면 이런 실수가 납니다:
 *  - 나간 사람(LEFT)을 집계에서 빼는 걸 잊는다
 *  - 카드마다 합계 쿼리를 돌려서 피드에서 쿼리가 수십 번 나간다
 *  - status 필터를 빠뜨려서 DRAFT 가 남에게 보인다
 *
 * 새 조회가 필요하면 여기에 함수를 추가하고 팀에 알려주세요.
 * (이 파일은 공유 구역입니다. 고치기 전에 말해주세요.)
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';
import type {
  ActionCardData,
  ActionDetailData,
  ActionItemWithProgress,
} from '@/lib/types/view';
import type { Category, ActionStatus } from '@/lib/constants';

type DB = SupabaseClient<Database>;

/** 카드/상세에 공통으로 필요한 컬럼 */
const ACTION_COLUMNS = `
  id, title, description, category, image_urls, thumbnail_index,
  address, notice, status, cancel_reason,
  recruit_end_at, activity_start_at, activity_end_at,
  owner:profiles!actions_owner_id_fkey ( id, nickname, bio )
`;

interface RawAction {
  id: string;
  title: string;
  description: string | null;
  category: Category;
  image_urls: string[];
  thumbnail_index: number;
  address: string | null;
  notice: string | null;
  status: ActionStatus;
  cancel_reason: string | null;
  recruit_end_at: string | null;
  activity_start_at: string | null;
  activity_end_at: string | null;
  owner: { id: string; nickname: string; bio: string | null } | null;
}

/** image_urls + thumbnail_index → 대표 이미지 1장 */
export function pickThumbnail(
  imageUrls: string[] | null,
  index: number,
): string | null {
  if (!imageUrls || imageUrls.length === 0) return null;
  return imageUrls[index] ?? imageUrls[0];
}

/** 소개글을 카드용 한 줄로 */
function summarize(text: string | null, max = 60): string | null {
  if (!text) return null;
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

/**
 * 여러 액션의 좋아요·저장·참여 수와 "내가 눌렀는지" 를 한 번에 가져온다.
 * 카드마다 따로 조회하면 안 된다.
 */
async function loadSocial(
  supabase: DB,
  actionIds: string[],
  viewerId: string | null,
) {
  const counts = new Map<
    string,
    { like: number; save: number; crew: number }
  >();
  const liked = new Set<string>();
  const saved = new Set<string>();

  if (actionIds.length === 0) return { counts, liked, saved };

  const { data: countRows } = await supabase
    .from('action_social_counts')
    .select('action_id, like_count, save_count, crew_count')
    .in('action_id', actionIds);

  for (const r of countRows ?? []) {
    counts.set(r.action_id, {
      like: r.like_count,
      save: r.save_count,
      crew: r.crew_count,
    });
  }

  if (viewerId) {
    const [{ data: myLikes }, { data: mySaves }] = await Promise.all([
      supabase
        .from('likes')
        .select('action_id')
        .eq('user_id', viewerId)
        .in('action_id', actionIds),
      supabase
        .from('saves')
        .select('action_id')
        .eq('user_id', viewerId)
        .in('action_id', actionIds),
    ]);
    for (const r of myLikes ?? []) liked.add(r.action_id);
    for (const r of mySaves ?? []) saved.add(r.action_id);
  }

  return { counts, liked, saved };
}

function toCard(
  raw: RawAction,
  social: Awaited<ReturnType<typeof loadSocial>>,
): ActionCardData {
  const c = social.counts.get(raw.id);
  return {
    id: raw.id,
    title: raw.title,
    summary: summarize(raw.description),
    category: raw.category,
    thumbnailUrl: pickThumbnail(raw.image_urls, raw.thumbnail_index),
    address: raw.address,
    status: raw.status,
    activityStartAt: raw.activity_start_at,
    owner: raw.owner
      ? { id: raw.owner.id, nickname: raw.owner.nickname }
      : { id: '', nickname: '알 수 없음' },
    likeCount: c?.like ?? 0,
    saveCount: c?.save ?? 0,
    crewCount: c?.crew ?? 0,
    likedByMe: social.liked.has(raw.id),
    savedByMe: social.saved.has(raw.id),
  };
}

/** 카드 배열을 만드는 공통 마무리 단계 */
async function buildCards(
  supabase: DB,
  rows: RawAction[],
  viewerId: string | null,
): Promise<ActionCardData[]> {
  const social = await loadSocial(
    supabase,
    rows.map((r) => r.id),
    viewerId,
  );
  return rows.map((r) => toCard(r, social));
}

// ─────────────────────────────────────────────────────────────
// Home 피드 — 담당: 디자이너
// ─────────────────────────────────────────────────────────────
export async function getActionFeed(
  supabase: DB,
  opts: { viewerId?: string | null; limit?: number; category?: Category } = {},
): Promise<ActionCardData[]> {
  const { viewerId = null, limit = 20, category } = opts;

  let q = supabase
    .from('actions')
    .select(ACTION_COLUMNS)
    .eq('status', 'ACTIVE')
    .order('activity_start_at', { ascending: true })
    .limit(limit);

  if (category) q = q.eq('category', category);

  const { data, error } = await q;
  if (error) throw error;

  return buildCards(supabase, (data ?? []) as unknown as RawAction[], viewerId);
}

// ─────────────────────────────────────────────────────────────
// 항목별 진행 상황 — 뷰에서 읽는다. 절대 직접 합산하지 말 것.
// ─────────────────────────────────────────────────────────────
export async function getActionItems(
  supabase: DB,
  actionId: string,
): Promise<ActionItemWithProgress[]> {
  const [{ data: progress, error: pe }, { data: items, error: ie }] =
    await Promise.all([
      supabase
        .from('action_item_progress')
        .select('*')
        .eq('action_id', actionId),
      supabase
        .from('action_items')
        .select('id, condition_name, condition_desc, sort_order')
        .eq('action_id', actionId)
        .order('sort_order', { ascending: true }),
    ]);

  if (pe) throw pe;
  if (ie) throw ie;

  const conditions = new Map(
    (items ?? []).map((i) => [
      i.id,
      {
        name: i.condition_name,
        desc: i.condition_desc,
        order: i.sort_order,
      },
    ]),
  );

  return (progress ?? [])
    .map((p) => {
      const c = conditions.get(p.action_item_id);
      return {
        id: p.action_item_id,
        type: p.type,
        name: p.name,
        target_type: p.target_type,
        min_required: p.min_required,
        max_allowed: p.max_allowed,
        unit: p.unit,
        gender_requirement: p.gender_requirement,
        conditionName: c?.name ?? null,
        conditionDesc: c?.desc ?? null,
        currentCount: p.current_count,
        isFull: p.is_full,
        isMinMet: p.is_min_met,
        _order: c?.order ?? 0,
      };
    })
    .sort((a, b) => a._order - b._order)
    .map(({ _order, ...rest }) => rest);
}

// ─────────────────────────────────────────────────────────────
// Action Detail — 담당: 디자이너
// ─────────────────────────────────────────────────────────────
export async function getActionDetail(
  supabase: DB,
  actionId: string,
  viewerId: string | null,
): Promise<ActionDetailData | null> {
  // 종료일이 지났으면 ENDED 로 바꾸고 알림을 만든다 (lazy 전환)
  await supabase.rpc('sync_action_status', { p_action_id: actionId });

  const { data, error } = await supabase
    .from('actions')
    .select(ACTION_COLUMNS)
    .eq('id', actionId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const raw = data as unknown as RawAction;

  const [items, social] = await Promise.all([
    getActionItems(supabase, actionId),
    loadSocial(supabase, [actionId], viewerId),
  ]);

  let myParticipation: ActionDetailData['myParticipation'] = null;
  let followingOwner = false;

  if (viewerId) {
    const [{ data: part }, { data: follow }] = await Promise.all([
      supabase
        .from('participations')
        .select('status')
        .eq('action_id', actionId)
        .eq('user_id', viewerId)
        .maybeSingle(),
      raw.owner
        ? supabase
            .from('follows')
            .select('id')
            .eq('follower_id', viewerId)
            .eq('following_id', raw.owner.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    myParticipation = part?.status ?? null;
    followingOwner = !!follow;
  }

  const c = social.counts.get(actionId);

  return {
    id: raw.id,
    title: raw.title,
    description: raw.description,
    category: raw.category,
    imageUrls: raw.image_urls ?? [],
    thumbnailIndex: raw.thumbnail_index,
    address: raw.address,
    notice: raw.notice,
    status: raw.status,
    cancelReason: raw.cancel_reason,
    recruitEndAt: raw.recruit_end_at,
    activityStartAt: raw.activity_start_at,
    activityEndAt: raw.activity_end_at,
    owner: raw.owner ?? { id: '', nickname: '알 수 없음', bio: null },
    items,
    likeCount: c?.like ?? 0,
    saveCount: c?.save ?? 0,
    crewCount: c?.crew ?? 0,
    likedByMe: social.liked.has(actionId),
    savedByMe: social.saved.has(actionId),
    followingOwner,
    myParticipation,
    isOwner: !!viewerId && raw.owner?.id === viewerId,
    recruitClosed: raw.recruit_end_at
      ? new Date(raw.recruit_end_at) < new Date()
      : false,
  };
}

// ─────────────────────────────────────────────────────────────
// Activity — Created 탭. 담당: 조장
// 내 액션은 DRAFT 까지 전부 보인다.
// ─────────────────────────────────────────────────────────────
export async function getMyCreatedActions(
  supabase: DB,
  userId: string,
): Promise<ActionCardData[]> {
  const { data, error } = await supabase
    .from('actions')
    .select(ACTION_COLUMNS)
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return buildCards(supabase, (data ?? []) as unknown as RawAction[], userId);
}

// ─────────────────────────────────────────────────────────────
// MY — 저장한 액션. 담당: 개발 A
// ─────────────────────────────────────────────────────────────
export async function getSavedActions(
  supabase: DB,
  userId: string,
): Promise<ActionCardData[]> {
  const { data: rows, error } = await supabase
    .from('saves')
    .select('action_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  const ids = (rows ?? []).map((r) => r.action_id);
  if (ids.length === 0) return [];

  const { data, error: ae } = await supabase
    .from('actions')
    .select(ACTION_COLUMNS)
    .in('id', ids);

  if (ae) throw ae;
  return buildCards(supabase, (data ?? []) as unknown as RawAction[], userId);
}

// ─────────────────────────────────────────────────────────────
// 타인 프로필 — 그 사람이 만든 공개 액션. 담당: 개발 A
// DRAFT 는 절대 포함하지 않는다.
// ─────────────────────────────────────────────────────────────
export async function getPublicActionsByOwner(
  supabase: DB,
  ownerId: string,
  viewerId: string | null,
): Promise<ActionCardData[]> {
  const { data, error } = await supabase
    .from('actions')
    .select(ACTION_COLUMNS)
    .eq('owner_id', ownerId)
    .in('status', ['ACTIVE', 'ENDED', 'COMPLETED'])
    .order('created_at', { ascending: false });

  if (error) throw error;
  return buildCards(supabase, (data ?? []) as unknown as RawAction[], viewerId);
}

// ─────────────────────────────────────────────────────────────
// Discover 추천 후보. 담당: 개발 A
// 추천에서 무조건 제외해야 하는 것들을 여기서 한 번에 건다.
// ─────────────────────────────────────────────────────────────
export async function getRecommendCandidates(
  supabase: DB,
  viewerId: string,
  filter: { categories?: Category[]; regions?: string[] } = {},
): Promise<ActionCardData[]> {
  // 이미 참여한 액션은 후보에서 뺀다
  const { data: joined } = await supabase
    .from('participations')
    .select('action_id')
    .eq('user_id', viewerId);
  const joinedIds = (joined ?? []).map((r) => r.action_id);

  let q = supabase
    .from('actions')
    .select(ACTION_COLUMNS)
    .eq('status', 'ACTIVE')
    .neq('owner_id', viewerId) // 내가 만든 것 제외
    .gt('recruit_end_at', new Date().toISOString()) // 모집 마감 제외
    .limit(50);

  if (filter.categories?.length) q = q.in('category', filter.categories);
  if (joinedIds.length) q = q.not('id', 'in', `(${joinedIds.join(',')})`);

  const { data, error } = await q;
  if (error) throw error;

  return buildCards(supabase, (data ?? []) as unknown as RawAction[], viewerId);
}
