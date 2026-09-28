/**
 * 알림 목록.
 *
 * ★ lazy 알림 2종(일정 임박 · 소감 재요청)은 이 화면을 열 때 만들어집니다.
 *   sync_my_notifications() 를 먼저 호출하는 이유입니다.
 *   event_key 가 UNIQUE 라서 여러 번 호출해도 중복으로 쌓이지 않습니다.
 */
import { redirect } from 'next/navigation';
import { Bell } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getNotifications } from '@/lib/queries/notifications';
import { syncLazyNotifications, syncHostNotifications } from '@/lib/notifications/lazy';
import { NotificationList } from '@/components/ui/NotificationList';
import { Header } from '@/components/layout/Header';

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/notifications');

  // 시간 조건으로 생기는 알림을 이 시점에 만듭니다 (lazy)
  //   참여자용: 일정 임박 · 소감 재요청
  //   호스트용: 모집 미달 (F37)
  await Promise.all([
    syncLazyNotifications(user.id),
    syncHostNotifications(user.id),
  ]);

  const items = await getNotifications(supabase, user.id);

  return (
    <main className="pb-24">
      {/* 2026-09-14 수정 NO9 — 화면 제목을 한글로 통일 */}
      <Header title="알림" back backHref="/" sticky />

      {/* 2026-09-28 통일안 — 이모지·버튼 2개(하단 탭 "+"와 겹침) 없애고
          회색 원 + 아이콘 + 문구만 (트렌드·내 액션 빈 화면과 같은 규칙) */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
          <span className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
            <Bell className="h-6 w-6 text-neutral-500" />
          </span>
          <p className="text-body font-semibold text-neutral-800">
            새로운 알림이 없어요
          </p>
          <p className="text-label leading-relaxed text-neutral-500">
            액션을 만들거나 참여해보세요. 일정과 결과를 알려드릴게요.
          </p>
        </div>
      ) : (
        <NotificationList items={items} />
      )}
    </main>
  );
}
