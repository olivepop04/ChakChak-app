/**
 * 알림 목록.
 *
 * 문구 · 아이콘 · 이동 경로는 전부 NOTIFICATION_TEMPLATE 에 있습니다.
 * 화면에서 직접 적지 마세요. 알림 종류가 늘면 그 파일만 고치면 됩니다.
 *
 * 2026-09-01 개편 (F24) — 큰 카드에서 한 줄 요약으로 바꿨습니다.
 *   · 줄 전체가 버튼입니다. 오른쪽에 있던 [결과 작성] 같은 버튼을 없앴습니다.
 *     어차피 눌렀을 때 가는 곳이 같아서, 버튼이 자리만 차지했습니다.
 *   · 처음에는 15개만 보이고 "+ 더보기" 로 펼칩니다.
 *     50개가 한 번에 쏟아지면 아래로 계속 내려야 합니다.
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarClock,
  PenLine,
  PartyPopper,
  MessageSquareText,
  CircleX,
  UserPlus,
  UserMinus,
  TrendingDown,
  CircleCheck,
  type LucideIcon,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { markNotificationRead } from '@/lib/mutations';
import { NOTIFICATION_TEMPLATE } from '@/lib/queries/notifications';
import { formatRelative } from '@/lib/utils/date';
import { cn } from '@/lib/utils/cn';
import type { NotificationData } from '@/lib/types/view';
import type { NotificationType } from '@/lib/constants';

/** 처음에 보여줄 개수 */
const INITIAL_COUNT = 15;

/**
 * 알림 종류별 아이콘.
 *
 * 문구·이동 경로는 NOTIFICATION_TEMPLATE(lib/queries/notifications.ts, 민호 담당)에
 * 그대로 두고, 아이콘만 여기서 이모지 대신 lucide로 그립니다.
 */
// 프로필 수정 「알림 설정」 줄도 같은 아이콘을 씁니다 (2026-09-29) — 그래서 export
export const NOTIFICATION_ICON: Record<NotificationType, LucideIcon> = {
  SCHEDULE: CalendarClock,
  RESULT_REQUEST: PenLine,
  RESULT_PUBLISHED: PartyPopper,
  VOICE_REQUEST: MessageSquareText,
  CANCELLED: CircleX,
  INVITED: UserPlus,
  LEFT_CREW: UserMinus,
  SHORTFALL: TrendingDown,
  EARLY_END: CircleCheck,
};

/** 내가 할 일이 남은 알림 — 아이콘 원을 노란 톤으로 구분합니다 */
const ACTION_NEEDED: Partial<Record<NotificationType, true>> = {
  RESULT_REQUEST: true,
  VOICE_REQUEST: true,
  SHORTFALL: true,
};

/** 오늘 / 어제 / 그 이전으로 묶는다 */
function groupOf(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

  if (isSameDay(d, today)) return '오늘';
  const yesterday = new Date(today.getTime() - 86400000);
  if (isSameDay(d, yesterday)) return '어제';
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function NotificationList({ items }: { items: NotificationData[] }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  const visible = expanded ? items : items.slice(0, INITIAL_COUNT);
  const hiddenCount = items.length - visible.length;

  async function handleClick(n: NotificationData) {
    const justRead = !n.isRead;
    if (justRead) {
      await markNotificationRead(createClient(), n.id);
    }

    const template = NOTIFICATION_TEMPLATE[n.type];
    if (n.actionId) {
      router.push(template.href(n.actionId));
    }

    // ★ 지우지 마세요 — 이것이 없으면 읽음 표시가 화면에 안 남습니다. (2026-09-14)
    //
    // ★ push 뒤에 두는 것이 중요합니다. 앞에 두면 이동이 무효화를 중단시켜 안 먹습니다.
    //   실측: refresh 직후 곧바로 push -> 안 고쳐짐 / 600ms 두고 push -> 고쳐짐
    if (justRead) {
      router.refresh();
    }
  }

  // 같은 그룹끼리 묶어서 헤더를 한 번만 보여준다
  const groups: { label: string; items: NotificationData[] }[] = [];
  for (const n of visible) {
    const label = groupOf(n.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(n);
    else groups.push({ label, items: [n] });
  }

  return (
    <div className="flex flex-col">
      {groups.map((g) => (
        <section key={g.label}>
          <h2 className="px-6 pb-1.5 pt-4 text-caption font-bold text-neutral-500">
            {g.label}
          </h2>

          <ul className="divide-y divide-neutral-100 border-y border-neutral-100">
            {g.items.map((n) => {
              const t = NOTIFICATION_TEMPLATE[n.type];
              const Icon = NOTIFICATION_ICON[n.type];
              const needsAction = ACTION_NEEDED[n.type];
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleClick(n)}
                    className="flex w-full items-start gap-3 px-6 py-3 text-left transition-colors hover:bg-neutral-50"
                  >
                    <span
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                        needsAction ? 'bg-warning-soft' : 'bg-neutral-100',
                      )}
                      aria-hidden="true"
                    >
                      <Icon
                        className={cn(
                          'h-4 w-4',
                          needsAction ? 'text-warning-ink' : 'text-neutral-500',
                        )}
                      />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'line-clamp-2 text-label leading-snug text-neutral-900',
                          n.isRead ? 'font-medium' : 'font-semibold',
                        )}
                      >
                        {t.title}
                      </span>

                      {n.actionTitle && (
                        <span className="mt-0.5 block truncate text-caption text-neutral-500">
                          「{n.actionTitle}」
                        </span>
                      )}

                      {/* 나가기 사유처럼 알림마다 다른 문장이 있으면 한 줄 더 */}
                      {n.body && (
                        <span className="mt-0.5 block truncate text-caption text-neutral-500">
                          &ldquo;{n.body}&rdquo;
                        </span>
                      )}
                    </span>

                    <span className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
                      <span className="text-caption tabular-nums text-neutral-500">
                        {formatRelative(n.createdAt)}
                      </span>
                      {!n.isRead && (
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger"
                          aria-label="읽지 않음"
                        />
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mx-6 mt-4 min-h-11 rounded-xl border border-hairline px-4 text-body font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
        >
          + 지난 알림 {hiddenCount}개 더보기
        </button>
      )}
    </div>
  );
}
