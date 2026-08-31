/**
 * 알림 조회. 담당: 민호
 *
 * 알림 "생성" 은 DB 함수가 한다 (complete_action, cancel_action, notify_invite,
 * sync_action_status). 화면에서 직접 insert 하지 않는다.
 *
 * lazy 알림 2종(SCHEDULE, VOICE_REQUEST)만 조회 시점에 만들어진다.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';
import type { NotificationData } from '@/lib/types/view';
import type { NotificationType } from '@/lib/constants';

type DB = SupabaseClient<Database>;

/** 알림 종류별 문구와 이동 경로 */
export const NOTIFICATION_TEMPLATE: Record<
  NotificationType,
  { icon: string; title: string; cta: string; href: (id: string) => string }
> = {
  SCHEDULE: {
    icon: '📅',
    title: '내일 액션이 시작돼요.',
    cta: '액션 보기',
    href: (id) => `/action/${id}`,
  },
  RESULT_REQUEST: {
    icon: '⚠️',
    title: '액션 결과를 작성해주세요.',
    cta: '결과 작성',
    href: (id) => `/action/${id}/result/write`,
  },
  RESULT_PUBLISHED: {
    icon: '✨',
    title: '액션 결과가 공개됐어요.',
    cta: '결과 보기',
    href: (id) => `/action/${id}/result`,
  },
  VOICE_REQUEST: {
    icon: '✍️',
    title: '참여 소감을 남겨주세요.',
    cta: '소감 남기기',
    href: (id) => `/action/${id}/voice`,
  },
  CANCELLED: {
    icon: '🚫',
    title: '액션이 취소됐어요.',
    cta: '액션 보기',
    href: (id) => `/action/${id}`,
  },
  INVITED: {
    icon: '📣',
    title: '초대된 액션이 있어요.',
    cta: '액션 보기',
    href: (id) => `/action/${id}`,
  },
};

export async function getNotifications(
  supabase: DB,
  userId: string,
): Promise<NotificationData[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select(
      `id, type, action_id, is_read, created_at,
       action:actions!notifications_action_id_fkey ( title )`,
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;

  type Row = {
    id: string;
    type: NotificationType;
    action_id: string | null;
    is_read: boolean;
    created_at: string;
    action: { title: string } | null;
  };

  return ((data ?? []) as unknown as Row[]).map((n) => ({
    id: n.id,
    type: n.type,
    actionId: n.action_id,
    actionTitle: n.action?.title ?? null,
    isRead: n.is_read,
    createdAt: n.created_at,
  }));
}

export async function getUnreadCount(
  supabase: DB,
  userId: string,
): Promise<number> {
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  return count ?? 0;
}
