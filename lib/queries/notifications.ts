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

/**
 * 안 읽은 알림 개수. 홈 화면 빨간 점(`app/page.tsx`)이 이 값을 씁니다.
 *
 * ── 안 하기로 한 것 (2026-09-22) ──────────────────────────────────
 * 「알림 목록에 들어가기만 해도 표시가 없어져야 하지 않나」 는 의견이 있었는데
 * **지금 동작(알림을 하나하나 눌러야 없어짐)을 유지하기로 정했습니다.**
 * 버그 제보가 아니라 결정입니다. 다시 제보로 올리지 마세요.
 *
 * 왜 —
 *   1. `/notifications` 는 열 때마다 lazy 알림 두 종을 만드는 화면이라
 *      배포 환경 실측 2.8~6.1초입니다. 여기에 「들어오면 전부 읽음」 쓰기를
 *      더하면 그 앞에 또 얹힙니다. 같은 자리에서 `revalidatePath` 로
 *      4~9초까지 갔던 이력이 있습니다 (CLAUDE.md 「데이터 다루는 법」).
 *   2. `markNotificationRead` 는 id 를 하나씩만 받습니다 — 일괄 함수를
 *      새로 만들어야 합니다.
 *   3. 안 누른 알림이 읽음이 되면 **놓친 알림을 다시 찾을 방법이 없어집니다.**
 *      지금은 목록에서 안 읽은 항목이 노란 배경 + 빨간 점으로 구별됩니다.
 *
 * 정식 출시 스프린트에서 다시 볼 거면 일괄 읽음 함수부터 만들고 시작하세요.
 */
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
