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
  // 소감 작성 화면으로 바로 보내지 않습니다 (2026-09-11 회의).
  // 결과를 먼저 보고 나서 소감을 쓰는 순서가 자연스럽습니다.
  // 결과 보기 화면 안에 소감 쓰기가 들어 있습니다.
  VOICE_REQUEST: {
    icon: '✍️',
    title: '소감을 작성해서 참여한 액션을 마무리하세요.',
    cta: '결과 보고 소감 남기기',
    href: (id) => `/action/${id}/result`,
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
  // 크루챗으로 바로 보냅니다 (2026-09-11 회의 · 옵션 1).
  // 나가는 사유가 크루챗에 LEFT_NOTICE 로 남으므로,
  // 액션 상세로 보내면 호스트가 한 번 더 눌러 들어가야 합니다.
  // 조기 종료 알림(EARLY_END)도 같은 이유로 크루챗으로 갑니다.
  LEFT_CREW: {
    icon: '👋',
    title: '크루 한 분이 참여를 취소했어요',
    cta: '나간 사유 보기',
    href: (id) => `/action/${id}/chat`,
  },
  SHORTFALL: {
    icon: '📉',
    title: '모집 인원 미달로 진행 여부를 결정하세요.',
    cta: '진행할지 정하기',
    href: (id) => `/activity?tab=created&focus=${id}`,
  },
  // 호스트가 활동 중에 일찍 끝냈을 때 크루에게 (12·13)
  //
  // 알림은 supabase/12 의 end_action_early() 가 이미 보내고 있었는데
  // 여기 문구를 안 만들어서 화면에 안 나왔습니다. 제 누락이었습니다.
  //
  // 사유는 크루챗에 공지로 남으므로 크루챗으로 보냅니다.
  EARLY_END: {
    icon: '⏹️',
    title: '액션이 종료예정 시간보다 일찍 종료되었어요',
    cta: '사유 확인하기',
    href: (id) => `/action/${id}/chat`,
  },
};

export async function getNotifications(
  supabase: DB,
  userId: string,
): Promise<NotificationData[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select(
      `id, type, action_id, body, is_read, created_at,
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
    body: string | null;
    is_read: boolean;
    created_at: string;
    action: { title: string } | null;
  };

  return ((data ?? []) as unknown as Row[]).map((n) => ({
    id: n.id,
    type: n.type,
    actionId: n.action_id,
    actionTitle: n.action?.title ?? null,
    body: n.body,
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
