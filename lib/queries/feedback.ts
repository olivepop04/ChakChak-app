/**
 * 문의·건의 읽기 — 관리자 전용 (2026-10-02).
 *
 * 막는 곳은 DB 입니다. feedback 의 SELECT 정책이 is_admin() 하나뿐이라(supabase/22),
 * 관리자가 아닌 사람이 이 함수를 불러도 오류 없이 빈 배열이 옵니다(규칙 3).
 * 화면(app/admin/feedback)은 그 전에 isAdmin() 으로 한 번 더 걸러 404 를 냅니다.
 *
 * ⚠️ database.ts 는 자동 생성 파일이라, 22 를 적용하고 타입을 다시 뽑기 전까지는
 *    feedback 표와 is_admin 함수를 모릅니다. public-stats.ts 와 같은 방식으로 타입을 붙입니다.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';
import type { AvatarKey } from '@/lib/constants';
import { isAvatarKey } from '@/lib/utils/avatar';
import {
  isFeedbackCategory,
  type FeedbackCategory,
} from '@/lib/utils/feedback';

type DB = SupabaseClient<Database>;

export interface FeedbackItem {
  id: string;
  category: FeedbackCategory;
  body: string;
  createdAt: string;
  author: { id: string; nickname: string; avatar: AvatarKey | null } | null;
}

type RpcIsAdmin = (
  fn: 'is_admin',
) => PromiseLike<{ data: boolean | null; error: { message: string } | null }>;

/** 지금 로그인한 사람이 관리자인지. 실패하면 관리자가 아닌 것으로 봅니다. */
export async function isAdmin(supabase: DB): Promise<boolean> {
  const { data, error } = await (supabase.rpc as unknown as RpcIsAdmin)('is_admin');
  if (error) return false;
  return data === true;
}

type FeedbackRow = {
  id: string;
  category: string;
  body: string;
  created_at: string;
  profiles: { id: string; nickname: string; avatar: string | null } | null;
};

type FeedbackSelect = {
  from: (table: 'feedback') => {
    select: (columns: string) => {
      order: (
        column: 'created_at',
        opts: { ascending: boolean },
      ) => {
        limit: (n: number) => PromiseLike<{
          data: FeedbackRow[] | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
};

/** 최근 문의·건의 (새 것부터). 관리자가 아니면 빈 배열 */
export async function getFeedbackForAdmin(
  supabase: DB,
  limit = 200,
): Promise<FeedbackItem[]> {
  const { data, error } = await (supabase as unknown as FeedbackSelect)
    .from('feedback')
    .select('id, category, body, created_at, profiles(id, nickname, avatar)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (data ?? [])
    .filter((row) => isFeedbackCategory(row.category))
    .map((row) => ({
      id: row.id,
      category: row.category as FeedbackCategory,
      body: row.body,
      createdAt: row.created_at,
      author: row.profiles
        ? {
            id: row.profiles.id,
            nickname: row.profiles.nickname,
            avatar: isAvatarKey(row.profiles.avatar) ? row.profiles.avatar : null,
          }
        : null,
    }));
}
