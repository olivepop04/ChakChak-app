import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { ActionCard } from '@/components/ui/ActionCard';
import { SectionTitle } from '@/components/ui/SectionTitle';
import type { ActionCardData } from '@/lib/types/view';
import { selectProfileActionPreview } from '@/lib/utils/profile-actions';

export function ProfileActionSection({
  title,
  emptyText,
  actions,
  description,
  href,
}: {
  title: string;
  emptyText: string;
  actions: ActionCardData[];
  description?: string;
  href: string;
}) {
  const visibleActions = selectProfileActionPreview(actions);

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between px-6 pb-1">
        <SectionTitle>
          {title} <span className="text-neutral-500">{actions.length}</span>
        </SectionTitle>
        <Link
          href={href}
          className="inline-flex items-center gap-0.5 text-label font-semibold text-neutral-500 hover:text-neutral-900"
        >
          모두 보기
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
      {description && (
        <p className="px-6 pb-3 text-caption text-neutral-500">{description}</p>
      )}

      {actions.length === 0 ? (
        <p className="mx-6 mt-2 rounded-xl bg-neutral-100 px-4 py-6 text-center text-label text-neutral-500">
          {emptyText}
        </p>
      ) : (
        <div className="flex flex-col gap-3 px-6 pt-2">
          {visibleActions.map((action) => (
            <ActionCard
              key={action.id}
              action={action}
              variant="horizontal"
              showStatus
            />
          ))}
        </div>
      )}
    </section>
  );
}
