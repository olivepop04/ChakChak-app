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
    title: '내일, 함께하기로 한 액션이 있어요',
    cta: '액션 확인하기',
    href: (id) => `/action/${id}`,
  },
  RESULT_REQUEST: {
    icon: '⚠️',
    title: '액션이 끝났어요. 이제 결과를 남겨주세요',
    cta: '결과 작성하기',
    href: (id) => `/action/${id}/result/write`,
  },
  RESULT_PUBLISHED: {
    icon: '✨',
    title: '우리가 함께 만든 결과가 공개됐어요',
    cta: '결과 확인하고 소감 남기기',
    href: (id) => `/action/${id}/result`,
  },
  VOICE_REQUEST: {
    icon: '✍️',
    title: '아직 당신의 이야기가 남아있어요',
    cta: '소감 남기기',
    href: (id) => `/action/${id}/voice`,
  },
  CANCELLED: {
    icon: '🚫',
    title: '참여 예정이었던 액션이 취소되었어요',
    cta: '취소 내용 확인하기',
    href: (id) => `/action/${id}`,
  },
  INVITED: {
    icon: '📣',
    title: '누군가 당신을 액션에 초대했어요',
    cta: '초대 확인하기',
    href: (id) => `/action/${id}`,
  },
  LEFT_CREW: {
    icon: '👋',
    title: '크루 한 분이 참여를 취소했어요',
    cta: '모집 현황 보기',
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
