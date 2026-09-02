'use client';

import { useState } from 'react';
import { ActionCard } from '@/components/ui/ActionCard';
import { Button } from '@/components/ui/Button';
import type { ActionCardData } from '@/lib/types/view';

const COLLAPSED_COUNT = 2;

export function SavedActionList({ actions }: { actions: ActionCardData[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? actions : actions.slice(0, COLLAPSED_COUNT);
  const hiddenCount = Math.max(0, actions.length - COLLAPSED_COUNT);

  return (
    <div className="flex flex-col gap-4 px-5 py-5">
      {visible.map((action) => (
        <ActionCard key={action.id} action={action} showStatus />
      ))}

      {hiddenCount > 0 && (
        <Button
          type="button"
          variant="secondary"
          fullWidth
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
        >
          {expanded ? '접기' : `+ ${hiddenCount}개 더보기`}
        </Button>
      )}
    </div>
  );
}
