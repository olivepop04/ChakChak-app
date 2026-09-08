/**
 * 남에게도 보여주기로 한 참여 통계. 담당: 민호
 *
 * participations 의 RLS 는 "내 참여 · 내가 만든 액션 · 내가 속한 크루" 만 열어줍니다.
 * 그래서 화면에서 그 테이블을 직접 세면 **남의 참여가 0 이나 일부로 나옵니다.**
 * 에러가 안 나고 조용히 작은 숫자가 오기 때문에 한동안 아무도 몰랐습니다 (규칙 3).
 *
 * 정책을 풀면 "누가 어디에 참여 예정인지" 까지 새어 나가서, 정책은 그대로 두고
 * supabase/16_update.sql 에서 공개 범위만큼만 돌려주는 함수를 만들었습니다.
 *
 *   공개    소감까지 쓴 참여 개수 · 그 참여가 걸린 끝난 액션의 id
 *   비공개  참여 예정 · 나간 기록 · 고른 항목
 *
 * ⚠️ database.ts 는 자동 생성 파일이라, 스키마를 다시 뽑기 전까지는 이 함수 이름을
 *    모릅니다. 그래서 여기 한 군데에서만 타입을 맞춰 둡니다.
 *    스키마를 다시 뽑고 나면 아래 as 두 줄을 지우면 됩니다.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';

type DB = SupabaseClient<Database>;

/** 사용자별 "소감까지 쓴 참여" 개수 */
export async function getPublicParticipationCounts(
  supabase: DB,
  userIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (userIds.length === 0) return counts;

  const { data, error } = await (supabase.rpc as unknown as RpcCounts)(
    'public_participation_counts',
    { p_user_ids: userIds },
  );
  if (error) throw error;

  for (const row of data ?? []) counts.set(row.user_id, row.participated_count);
  return counts;
}

/** 그 사람이 끝까지 함께한 액션의 id (ENDED · COMPLETED 만) */
export async function getPublicParticipatedActionIds(
  supabase: DB,
  userId: string,
): Promise<string[]> {
  const { data, error } = await (supabase.rpc as unknown as RpcIds)(
    'public_participated_action_ids',
    { p_user_id: userId },
  );
  if (error) throw error;

  return (data ?? []).map((row) => row.action_id);
}

type RpcCounts = (
  fn: 'public_participation_counts',
  args: { p_user_ids: string[] },
) => PromiseLike<{
  data: { user_id: string; participated_count: number }[] | null;
  error: { message: string } | null;
}>;

type RpcIds = (
  fn: 'public_participated_action_ids',
  args: { p_user_id: string },
) => PromiseLike<{
  data: { action_id: string }[] | null;
  error: { message: string } | null;
}>;
