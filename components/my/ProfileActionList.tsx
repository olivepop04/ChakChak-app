import type { LucideIcon } from 'lucide-react';
import { ActionCard } from '@/components/ui/ActionCard';
import type { ActionCardData } from '@/lib/types/view';

export function ProfileActionList({
  actions,
  emptyText,
  emptyIcon: EmptyIcon,
  emptyDescription,
}: {
  actions: ActionCardData[];
  emptyText: string;
  /** 빈 화면 회색 원 안 아이콘 (2026-09-29 — 알림·내 액션 빈 화면과 같은 모양) */
  emptyIcon: LucideIcon;
  emptyDescription?: string;
}) {
  if (actions.length === 0) {
    // 목록 화면 전체가 빈 경우 — 회색 원(48px) + 아이콘 + 제목 + 설명, 버튼 없음(하단 탭과 겹침)
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
        <span
          aria-hidden="true"
          className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100"
        >
          <EmptyIcon className="h-6 w-6 text-neutral-500" />
        </span>
        <p className="text-body font-semibold text-neutral-800">{emptyText}</p>
        {emptyDescription && (
          <p className="text-label leading-relaxed text-neutral-500 break-keep">{emptyDescription}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-6 pb-28">
      {actions.map((action) => (
        <ActionCard
          key={action.id}
          action={action}
          variant="horizontal"
          showStatus
        />
      ))}
    </div>
  );
}
