'use client';

import { ActionCard } from '@/components/ui/ActionCard';
import type { ActionCardData } from '@/lib/types/view';

export function SavedActionList({ actions }: { actions: ActionCardData[] }) {
  return (
    <div className="flex flex-col gap-3 px-5 py-5 pb-28">
      {actions.map((action) => (
        <ActionCard key={action.id} action={action} variant="horizontal" showStatus />
      ))}
    </div>
  );
}

