/**
 * 트렌드 차트 조각들.
 *
 * ★ 각각 독립적입니다. Home 이든 별도 페이지든 import 해서 쓰면 됩니다.
 *   데이터는 lib/queries/stats.ts 에서 받아 props 로 넘겨주세요.
 *   (차트가 직접 DB 를 조회하지 않습니다)
 *
 * Recharts 는 브라우저에서만 동작해서 'use client' 가 필요합니다.
 * 서버 컴포넌트인 페이지에서 이 컴포넌트를 렌더링하는 건 문제없습니다.
 */
'use client';

import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TrendStats } from '@/lib/queries/stats';
import { ACTION_STATUS_LABEL } from '@/lib/constants';

/** 카테고리 구분용 색. 서로 구분되면서 앱 톤을 벗어나지 않게 골랐습니다. */
const PALETTE = [
  '#334155',
  '#0f766e',
  '#b45309',
  '#7c3aed',
  '#be123c',
  '#0369a1',
  '#4d7c0f',
  '#a16207',
];

const axisStyle = { fontSize: 11, fill: '#737373' };

const tooltipStyle = {
  contentStyle: {
    borderRadius: 10,
    border: '1px solid #e5e5e5',
    fontSize: 12,
    padding: '6px 10px',
  },
  cursor: { fill: '#f5f5f5' },
} as const;

function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-4">
      <div>
        <h3 className="text-body font-bold text-neutral-900">{title}</h3>
        {hint && <p className="mt-0.5 text-caption text-neutral-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/** 요약 숫자 4개 */
export function SummaryTiles({ stats }: { stats: TrendStats }) {
  const tiles = [
    { value: stats.totalActions, label: '공개된 액션' },
    { value: stats.totalParticipations, label: '참여 완료' },
    { value: `${stats.fulfillmentRate}%`, label: '모집 달성률' },
    { value: stats.byRegion.length, label: '활동 지역' },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {tiles.map((t) => (
        <div
          key={t.label}
          className="flex flex-col gap-0.5 rounded-xl bg-neutral-50 px-4 py-3.5"
        >
          <span className="text-2xl font-bold tabular-nums text-neutral-900">
            {t.value}
          </span>
          <span className="text-caption text-neutral-500">{t.label}</span>
        </div>
      ))}
    </div>
  );
}

/** 카테고리별 액션 수 */
export function CategoryChart({ stats }: { stats: TrendStats }) {
  if (stats.byCategory.length === 0) return null;

  return (
    <Card title="어떤 분야의 액션이 많을까요" hint="공개된 액션 기준">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart
          data={stats.byCategory}
          margin={{ top: 4, right: 4, bottom: 0, left: -24 }}
        >
          <XAxis dataKey="category" tick={axisStyle} interval={0} angle={0} />
          <YAxis tick={axisStyle} allowDecimals={false} />
          <Tooltip {...tooltipStyle} formatter={(v) => [`${v}개`, '액션']} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {stats.byCategory.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

/** 주간 추이 */
export function WeeklyChart({ stats }: { stats: TrendStats }) {
  return (
    <Card title="주마다 얼마나 생겨났나요" hint="최근 8주 동안 만들어진 액션 수">
      <ResponsiveContainer width="100%" height={180}>
        <LineChart
          data={stats.byWeek}
          margin={{ top: 4, right: 8, bottom: 0, left: -24 }}
        >
          <XAxis dataKey="week" tick={axisStyle} />
          <YAxis tick={axisStyle} allowDecimals={false} />
          <Tooltip {...tooltipStyle} formatter={(v) => [`${v}개`, '액션']} />
          <Line
            type="monotone"
            dataKey="count"
            stroke="#171717"
            strokeWidth={2}
            dot={{ r: 3, fill: '#171717' }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}

/** 지역별 분포 */
export function RegionChart({ stats }: { stats: TrendStats }) {
  if (stats.byRegion.length === 0) return null;

  return (
    <Card title="어디에서 많이 열리나요" hint="액션이 많은 지역 순">
      <ResponsiveContainer width="100%" height={Math.max(stats.byRegion.length * 34, 120)}>
        <BarChart
          data={stats.byRegion}
          layout="vertical"
          margin={{ top: 0, right: 12, bottom: 0, left: 12 }}
        >
          <XAxis type="number" tick={axisStyle} allowDecimals={false} hide />
          <YAxis
            type="category"
            dataKey="region"
            tick={axisStyle}
            width={78}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip {...tooltipStyle} formatter={(v) => [`${v}개`, '액션']} />
          <Bar dataKey="count" fill="#334155" radius={[0, 4, 4, 0]} barSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

/** 상태 분포 — 차트 대신 막대 하나로 (종류가 적어서 더 읽기 쉽습니다) */
export function StatusBar({ stats }: { stats: TrendStats }) {
  const total = stats.byStatus.reduce((s, x) => s + x.count, 0);
  if (total === 0) return null;

  const TONE: Record<string, string> = {
    ACTIVE: 'bg-emerald-500',
    ENDED: 'bg-amber-500',
    COMPLETED: 'bg-blue-500',
    CANCELLED: 'bg-neutral-300',
  };

  return (
    <Card title="지금 어떤 단계에 있나요">
      <div className="flex h-2.5 overflow-hidden rounded-full">
        {stats.byStatus.map((s) => (
          <div
            key={s.status}
            className={TONE[s.status]}
            style={{ width: `${(s.count / total) * 100}%` }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
        {stats.byStatus.map((s) => (
          <li key={s.status} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${TONE[s.status]}`} />
            <span className="text-caption text-neutral-600">
              {ACTION_STATUS_LABEL[s.status]}{' '}
              <b className="font-semibold tabular-nums text-neutral-900">
                {s.count}
              </b>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
