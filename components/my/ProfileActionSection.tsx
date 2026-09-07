'use client';

import { useState } from 'react';
import { ActionCard } from '@/components/ui/ActionCard';
import type { ActionCardData } from '@/lib/types/view';
import { selectProfileActionPreview } from '@/lib/utils/profile-actions';

export function ProfileActionSection({
  title,
  emptyText,
  actions,
  description,
}: {
  title: string;
  emptyText: string;
  actions: ActionCardData[];
  description?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleActions = selectProfileActionPreview(actions, expanded);
  const hiddenCount = Math.max(actions.length - 2, 0);

  return (
    <section className="mt-7">
      <h2 className="px-5 pb-1 text-[15px] font-bold text-neutral-900">
        {title} <span className="text-neutral-400">{actions.length}</span>
      </h2>
      {description && (
        <p className="px-5 pb-3 text-[11px] text-neutral-400">{description}</p>
      )}

      {actions.length === 0 ? (
        <p className="mx-5 mt-2 rounded-xl bg-neutral-50 px-4 py-6 text-center text-[13px] text-neutral-400">
          {emptyText}
        </p>
      ) : (
        <div className="flex flex-col gap-3 px-5 pt-2">
          {visibleActions.map((action) => (
            <ActionCard
              key={action.id}
              action={action}
              variant="horizontal"
              showStatus
            />
          ))}

          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((current) => !current)}
              className="mt-1 flex h-11 w-full items-center justify-center rounded-xl border border-neutral-200 bg-white text-[13px] font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 active:bg-neutral-100"
            >
              {expanded
                ? `${title} 접기 ▲`
                : `+ 더보기 (${hiddenCount}개 더보기)`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
