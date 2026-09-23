import Link from 'next/link';
import type { ProfileStatItem } from '@/lib/utils/profile-display';

function Stat({ value, label, href }: ProfileStatItem) {
  const inner = (
    <div className="flex flex-1 flex-col items-center gap-0.5 py-3">
      <span className="text-xl font-bold tabular-nums text-neutral-900">
        {value}
      </span>
      <span className="text-caption text-neutral-500">{label}</span>
    </div>
  );

  return href ? (
    <Link href={href} className="flex flex-1">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export function ProfileStats({ stats }: { stats: ProfileStatItem[] }) {
  return (
    <section className="mx-6 flex rounded-xl border border-neutral-200">
      {stats.map((stat) => (
        <Stat key={stat.label} {...stat} />
      ))}
    </section>
  );
}
