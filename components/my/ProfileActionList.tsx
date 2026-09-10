import { ActionCard } from '@/components/ui/ActionCard';
import type { ActionCardData } from '@/lib/types/view';

export function ProfileActionList({
  actions,
  emptyText,
}: {
  actions: ActionCardData[];
  emptyText: string;
}) {
  if (actions.length === 0) {
    return (
      <p className="mx-5 rounded-xl bg-neutral-50 px-4 py-6 text-center text-[13px] text-neutral-400">
        {emptyText}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-5 pb-28">
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
