/**
 * 액션 조회 함수 모음.
 *
 * ★ 화면에서 supabase.from('actions')... 를 직접 쓰지 말고 여기 함수를 부르세요.
 *
 * 직접 쓰면 이런 실수가 납니다:
 *   - 나간 사람(LEFT)을 집계에서 빼는 걸 잊는다
 *   - 카드마다 합계 쿼리를 돌려서 피드에서 쿼리가 수십 번 나간다
 *   - status 필터를 빠뜨려서 DRAFT 가 남에게 보인다
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
import type {
  Category,
  ActionStatus,
  ItemType,
  TargetType,
  GenderRequirement,
  ParticipationStatus,
} from '@/lib/constants';

type DB = SupabaseClient<Database>;

/** 카드/상세에 공통으로 필요한 컬럼 */
const ACTION_COLUMNS = `
  id, title, description, category, image_urls, thumbnail_index,
  address, place_name, notice, status, cancel_reason,
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
  place_name: string | null;
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
    { like: number; save: number; crew: number; share: number }
  >();
  const liked = new Set<string>();
  const saved = new Set<string>();

  if (actionIds.length === 0) return { counts, liked, saved };

  const { data: countRows } = await supabase
    .from('action_social_counts')
    .select('action_id, like_count, save_count, crew_count, share_count')
    .in('action_id', actionIds);

  // 뷰는 NOT NULL 정보를 잃어버려서 생성된 타입이 전부 nullable 이다.
  // 실제로는 항상 값이 있지만, 타입을 맞추기 위해 걸러내고 기본값을 준다.
  for (const r of countRows ?? []) {
    if (!r.action_id) continue;
    counts.set(r.action_id, {
      like: r.like_count ?? 0,
      save: r.save_count ?? 0,
      crew: r.crew_count ?? 0,
      share: r.share_count ?? 0,
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
    placeName: raw.place_name,
    status: raw.status,
    activityStartAt: raw.activity_start_at,
    recruitEndAt: raw.recruit_end_at,
    owner: raw.owner
      ? { id: raw.owner.id, nickname: raw.owner.nickname }
      : { id: '', nickname: '알 수 없음' },
    likeCount: c?.like ?? 0,
    shareCount: c?.share ?? 0,
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
/**
 * 피드 정렬 (2026-09-01 합의 · F27)
 *
 *   DEADLINE  마감 임박 순. 같은 날 마감이면 인기 높은 쪽이 위로
 *   POPULAR   인기 순.      같은 인기면 마감 임박한 쪽이 위로
 *
 * 인기 점수 = 좋아요 + 저장 × 1.5
 * 저장은 "나중에 하겠다" 는 뜻이라 좋아요보다 무겁게 봅니다.
 */
export type FeedSort = 'DEADLINE' | 'POPULAR';

/** 인기 점수. 화면에서 직접 계산하지 말고 이 규칙만 쓰세요 */
export function popularityScore(card: {
  likeCount: number;
  saveCount: number;
}): number {
  return card.likeCount + card.saveCount * 1.5;
}

/** 마감 시각을 정렬용 숫자로. 마감일이 없는 액션은 맨 뒤로 */
function deadlineKey(iso: string | null): number {
  return iso ? new Date(iso).getTime() : Number.MAX_SAFE_INTEGER;
}

export async function getActionFeed(
  supabase: DB,
  opts: {
    viewerId?: string | null;
    limit?: number;
    category?: Category;
    sort?: FeedSort;
  } = {},
): Promise<ActionCardData[]> {
  const { viewerId = null, limit = 20, category, sort = 'DEADLINE' } = opts;

  // 활동이 이미 끝난 액션은 피드에서 뺍니다.
  // 상태(ENDED) 전환은 누군가 그 액션을 열어야 일어나기 때문에,
  // 그때까지 DB 상으로는 ACTIVE 로 남아 있습니다.
  //
  // 인기 점수는 DB 가 아니라 뷰에서 따로 가져오기 때문에 SQL 로 정렬할 수 없습니다.
  // 그래서 마감 임박 순으로 넉넉히 받아온 뒤 여기서 다시 줄을 세웁니다.
  // (limit 만큼만 받아오면 인기순일 때 뒤쪽에 있는 인기 액션을 놓칩니다)
  const fetchCount = Math.min(limit * 3, 90);

  let q = supabase
    .from('actions')
    .select(ACTION_COLUMNS)
    .eq('status', 'ACTIVE')
    .gt('activity_end_at', new Date().toISOString())
    .order('recruit_end_at', { ascending: true, nullsFirst: false })
    .limit(fetchCount);

  if (category) q = q.eq('category', category);

  if (sort === 'DEADLINE') {
    q = q.order('activity_start_at', { ascending: true });
  } else {
    q = q.order('created_at', { ascending: false });
  }

  q = q.limit(limit);

  const { data, error } = await q;
  if (error) throw error;

  const cards = await buildCards(
    supabase,
    (data ?? []) as unknown as RawAction[],
    viewerId,
  );

  cards.sort((a, b) => {
    const byDeadline = deadlineKey(a.recruitEndAt) - deadlineKey(b.recruitEndAt);
    const byPopular = popularityScore(b) - popularityScore(a);
    return sort === 'POPULAR'
      ? byPopular || byDeadline
      : byDeadline || byPopular;
  });

  return cards.slice(0, limit);
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

  // 뷰 컬럼은 전부 nullable 로 생성되지만, 원본 action_items 가 NOT NULL 이라
  // 실제로 비어 있을 수 없다. id 없는 행만 걸러내고 나머지는 기본값을 채운다.
  return (progress ?? [])
    .filter((p) => p.action_item_id !== null)
    .map((p) => {
      const itemId = p.action_item_id as string;
      const c = conditions.get(itemId);
      return {
        id: itemId,
        type: (p.type ?? 'PERSON') as ItemType,
        name: p.name ?? '',
        target_type: (p.target_type ?? 'MINIMUM') as TargetType,
        min_required: p.min_required ?? 1,
        max_allowed: p.max_allowed,
        unit: p.unit ?? '명',
        gender_requirement: (p.gender_requirement ?? 'ANY') as GenderRequirement,
        conditionName: c?.name ?? null,
        conditionDesc: c?.desc ?? null,
        currentCount: p.current_count ?? 0,
        isFull: p.is_full ?? false,
        isMinMet: p.is_min_met ?? false,
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
    // DB CHECK 제약이 4가지 값만 허용하므로 안전한 단언이다.
    // (생성된 타입은 CHECK 를 모르기 때문에 그냥 string 이다)
    myParticipation = (part?.status as ParticipationStatus | undefined) ?? null;
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
    placeName: raw.place_name,
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
    shareCount: c?.share ?? 0,
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

  // in() 은 순서를 보장하지 않는다. 저장한 순서(최신순)로 되돌린다.
  const cards = await buildCards(
    supabase,
    (data ?? []) as unknown as RawAction[],
    userId,
  );
  const rank = new Map(ids.map((id, i) => [id, i]));
  return cards.sort(
    (a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity),
  );
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