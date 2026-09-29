/**
 * 트렌드 집계.
 *
 * 화면과 완전히 분리되어 있습니다. 대시보드를 Home 으로 옮기든
 * 디자인을 바꾸든 이 파일은 그대로입니다.
 *
 * 규모가 작아서(액션 수십 개) 행을 가져와 JS 에서 묶습니다.
 * 수천 건이 되면 DB 뷰로 옮기세요.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';
import { CATEGORIES, type Category, type ActionStatus } from '@/lib/constants';

type DB = SupabaseClient<Database>;

export interface TrendStats {
  /** 공개된 액션 총 수 */
  totalActions: number;
  /** 소감까지 마친 참여 수 */
  totalParticipations: number;
  /** 모인 물품 종류 수 */
  totalGoodsKinds: number;
  /** 최소 인원을 채운 항목 비율 (0~100) */
  fulfillmentRate: number;

  byCategory: { category: Category; count: number; crew: number }[];
  byStatus: { status: ActionStatus; count: number }[];
  byWeek: { week: string; count: number }[];
  byRegion: { region: string; count: number }[];
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function toKst(d: Date | string): Date {
  const ms = typeof d === 'string' ? new Date(d).getTime() : d.getTime();
  return new Date(ms + KST_OFFSET_MS);
}

/** '2026-08-31' → '8/31' 주 시작일 라벨 (KST 고정) */
function weekLabel(d: Date | string): string {
  const kst = toKst(d);
  const day = (kst.getUTCDay() + 6) % 7; // 월요일 시작 (KST)
  kst.setUTCDate(kst.getUTCDate() - day);
  return `${kst.getUTCMonth() + 1}/${kst.getUTCDate()}`;
}

/** '서울특별시 성동구 왕십리로 100' → '서울 성동구' */
function regionLabel(address: string | null): string | null {
  if (!address) return null;
  const parts = address.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const sido = parts[0]
    .replace('특별자치시', '')
    .replace('특별자치도', '')
    .replace('특별시', '')
    .replace('광역시', '');
  return `${sido} ${parts[1]}`;
}

export async function getTrendStats(supabase: DB): Promise<TrendStats> {
  /*
   * ★ participations 를 직접 세면 안 됩니다.
   *   RLS 가 "내 참여 / 내 액션 / 같은 크루" 만 보여주기 때문에,
   *   비회원이 보면 0 이 나오고 사람마다 숫자가 달라집니다.
   *
   *   대신 아래 둘을 씁니다.
   *   - action_item_progress : 집계 전용 뷰라 RLS 를 우회합니다
   *   - crew_voices          : 공개 액션이면 누구나 읽을 수 있고,
   *                            소감을 쓴 사람 = 참여를 완료한 사람입니다
   */
  const [{ data: actions }, { data: progress }, { count: voiceCount }] =
    await Promise.all([
      supabase
        .from('actions')
        .select('id, category, categories, status, address, created_at')
        .in('status', ['ACTIVE', 'ENDED', 'COMPLETED', 'CANCELLED']),
      supabase
        .from('action_item_progress')
        .select('action_id, type, current_count, is_min_met'),
      supabase
        .from('crew_voices')
        .select('id', { count: 'exact', head: true }),
    ]);

  const rows = actions ?? [];
  const prog = progress ?? [];

  // 액션별 참여 인원 (사람 항목만 합산)
  const crewByAction = new Map<string, number>();
  for (const p of prog) {
    if (p.type !== 'PERSON' || !p.action_id) continue;
    crewByAction.set(
      p.action_id,
      (crewByAction.get(p.action_id) ?? 0) + (p.current_count ?? 0),
    );
  }

  // ── 카테고리별 ──
  const catCount = new Map<string, { count: number; crew: number }>();
  for (const c of CATEGORIES) catCount.set(c, { count: 0, crew: 0 });
  // 액션 하나가 카테고리를 여러 개 가질 수 있습니다 (14).
  // 두 카테고리를 가진 액션은 두 칸에 모두 셉니다. 그래서 카테고리별
  // 합계는 전체 액션 수보다 클 수 있습니다 — 정상입니다.
  for (const a of rows) {
    const cats = a.categories?.length ? a.categories : [a.category];
    for (const cat of cats) {
      const cur = catCount.get(cat) ?? { count: 0, crew: 0 };
      cur.count += 1;
      cur.crew += crewByAction.get(a.id) ?? 0;
      catCount.set(cat, cur);
    }
  }

  // ── 상태별 ──
  const statusCount = new Map<string, number>();
  for (const a of rows) {
    statusCount.set(a.status, (statusCount.get(a.status) ?? 0) + 1);
  }

  // ── 주간 추이 (최근 8주) ──
  const weekCount = new Map<string, number>();
  const now = new Date();
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    weekCount.set(weekLabel(d), 0);
  }
  for (const a of rows) {
    const label = weekLabel(a.created_at);
    if (weekCount.has(label)) {
      weekCount.set(label, (weekCount.get(label) ?? 0) + 1);
    }
  }

  // ── 지역별 (상위 6곳) ──
  const regionCount = new Map<string, number>();
  for (const a of rows) {
    const r = regionLabel(a.address);
    if (r) regionCount.set(r, (regionCount.get(r) ?? 0) + 1);
  }

  // ── 모집 달성률 ──
  const minMet = prog.filter((p) => p.is_min_met).length;
  const fulfillmentRate =
    prog.length === 0 ? 0 : Math.round((minMet / prog.length) * 100);

  const goodsKinds = new Set(
    prog.filter((p) => p.type === 'GOODS').map((p) => p.action_id),
  ).size;

  return {
    totalActions: rows.length,
    totalParticipations: voiceCount ?? 0,
    totalGoodsKinds: goodsKinds,
    fulfillmentRate,

    byCategory: CATEGORIES.map((c) => ({
      category: c,
      count: catCount.get(c)?.count ?? 0,
      crew: catCount.get(c)?.crew ?? 0,
    })).filter((x) => x.count > 0),

    byStatus: (['ACTIVE', 'ENDED', 'COMPLETED', 'CANCELLED'] as ActionStatus[])
      .map((s) => ({ status: s, count: statusCount.get(s) ?? 0 }))
      .filter((x) => x.count > 0),

    byWeek: [...weekCount.entries()].map(([week, count]) => ({ week, count })),

    byRegion: [...regionCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([region, count]) => ({ region, count })),
  };
}

/**
 * 모집 마감이 지났는데 최소 인원/수량을 못 채운 액션 ID 목록 (F37).
 */
export async function getShortfallActionIds(
  supabase: DB,
  actionIds: string[],
): Promise<Set<string>> {
  if (actionIds.length === 0) return new Set();

  const { data: progress } = await supabase
    .from('action_item_progress')
    .select('action_id, is_min_met')
    .in('action_id', actionIds);

  const set = new Set<string>();
  for (const row of progress ?? []) {
    if (row.action_id && row.is_min_met === false) {
      set.add(row.action_id);
    }
  }
  return set;
}
