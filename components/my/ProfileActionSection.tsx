import Link from 'next/link';
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
      <div className="flex items-center justify-between px-5 pb-1">
        <SectionTitle>
          {title} <span className="text-neutral-400">{actions.length}</span>
        </SectionTitle>
        <Link
          href={href}
          className="text-label font-semibold text-neutral-500 hover:text-neutral-900"
        >
          모두 보기 ›
        </Link>
      </div>
      {description && (
        <p className="px-5 pb-3 text-caption text-neutral-400">{description}</p>
      )}

      {actions.length === 0 ? (
        <p className="mx-5 mt-2 rounded-xl bg-neutral-50 px-4 py-6 text-center text-label text-neutral-400">
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
        </div>
      )}
    </section>
  );
}
