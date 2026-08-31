/**
 * 알림 목록.
 *
 * 문구 · 아이콘 · 이동 경로는 전부 NOTIFICATION_TEMPLATE 에 있습니다.
 * 화면에서 직접 적지 마세요. 알림 종류가 늘면 그 파일만 고치면 됩니다.
 */
'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { markNotificationRead } from '@/lib/mutations';
import { NOTIFICATION_TEMPLATE } from '@/lib/queries/notifications';
import { formatRelative } from '@/lib/utils/date';
import { cn } from '@/lib/utils/cn';
import type { NotificationData } from '@/lib/types/view';

/** 오늘 / 어제 / 그 이전으로 묶는다 */
function groupOf(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

  if (isSameDay(d, today)) return 'TODAY';
  const yesterday = new Date(today.getTime() - 86400000);
  if (isSameDay(d, yesterday)) return 'YESTERDAY';
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function NotificationList({ items }: { items: NotificationData[] }) {
  const router = useRouter();

  async function handleClick(n: NotificationData) {
    if (!n.isRead) {
      await markNotificationRead(createClient(), n.id);
    }
    const template = NOTIFICATION_TEMPLATE[n.type];
    if (n.actionId) {
      router.push(template.href(n.actionId));
    } else {
      router.refresh();
    }
  }

  // 같은 그룹끼리 묶어서 헤더를 한 번만 보여준다
  const groups: { label: string; items: NotificationData[] }[] = [];
  for (const n of items) {
    const label = groupOf(n.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(n);
    else groups.push({ label, items: [n] });
  }

  return (
    <div className="flex flex-col">
      {groups.map((g) => (
        <section key={g.label}>
          <h2 className="px-5 pb-2 pt-5 text-[11px] font-bold tracking-wider text-neutral-400">
            {g.label}
          </h2>

          <ul className="divide-y divide-neutral-100 border-y border-neutral-100">
            {g.items.map((n) => {
              const t = NOTIFICATION_TEMPLATE[n.type];
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleClick(n)}
                    className={cn(
                      'flex w-full gap-3 px-5 py-4 text-left transition-colors hover:bg-neutral-50',
                      !n.isRead && 'bg-neutral-50/70',
                    )}
                  >
                    <span className="mt-0.5 text-lg" aria-hidden="true">
                      {t.icon}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-[14px] font-semibold text-neutral-900">
                        {t.title}
                        {!n.isRead && (
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500"
                            aria-label="읽지 않음"
                          />
                        )}
                      </p>
                      {n.actionTitle && (
                        <p className="mt-0.5 line-clamp-1 text-[13px] text-neutral-600">
                          「{n.actionTitle}」
                        </p>
                      )}
                      <p className="mt-1 text-[11px] text-neutral-400">
                        {formatRelative(n.createdAt)}
                      </p>
                    </div>

                    <span className="mt-1 shrink-0 self-start rounded-lg border border-neutral-300 px-2.5 py-1.5 text-[11px] font-medium text-neutral-700">
                      {t.cta}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
