import { Fragment } from 'react';
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

/**
 * 2026-09-29 프로필군 통일안 — 바깥 테두리를 없애고 항목 사이에 세로 구분선.
 * 구분선 높이는 숫자 위부터 라벨 아래까지(44px), 색은 앱 공통 구분선(neutral-100).
 */
export function ProfileStats({ stats }: { stats: ProfileStatItem[] }) {
  return (
    <section className="mx-6 flex items-center">
      {stats.map((stat, i) => (
        <Fragment key={stat.label}>
          {i > 0 && <span aria-hidden="true" className="h-11 w-px shrink-0 bg-neutral-100" />}
          <Stat {...stat} />
        </Fragment>
      ))}
    </section>
  );
}
