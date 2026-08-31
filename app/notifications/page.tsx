/**
 * 알림 목록.
 *
 * ★ lazy 알림 2종(일정 임박 · 소감 재요청)은 이 화면을 열 때 만들어집니다.
 *   sync_my_notifications() 를 먼저 호출하는 이유입니다.
 *   event_key 가 UNIQUE 라서 여러 번 호출해도 중복으로 쌓이지 않습니다.
 */
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getNotifications } from '@/lib/queries/notifications';
import { syncLazyNotifications } from '@/lib/notifications/lazy';
import { NotificationList } from '@/components/ui/NotificationList';
import { EmptyState } from '@/components/ui/EmptyState';
import { Header } from '@/components/layout/Header';

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/notifications');

  // 일정 임박 · 소감 재요청 알림을 이 시점에 만듭니다 (lazy)
  await syncLazyNotifications(user.id);

  const items = await getNotifications(supabase, user.id);

  return (
    <main className="pb-24">
      <Header title="NOTIFICATIONS" back backHref="/" sticky />

      {items.length === 0 ? (
        <EmptyState
          icon="🔔"
          title="새로운 알림이 없어요"
          description="액션에 참여하면 일정과 결과를 알려드릴게요."
          action={{ label: '액션 찾아보기', href: '/discover' }}
        />
      ) : (
        <NotificationList items={items} />
      )}
    </main>
  );
}
