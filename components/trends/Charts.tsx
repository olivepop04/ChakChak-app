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

/**
 * 그래프 색 (2026-09-29 트렌드 통일안 A안).
 * 예전엔 막대마다 다른 8색이었는데, 「1등만 포인트 그린 · 나머지는 연회색」으로 바꿨습니다 —
 * 무엇이 가장 많은지가 한눈에 보이고, 앱 전체 색 규칙(강조색은 초록 하나)과 맞습니다.
 * Recharts 는 CSS 클래스 대신 색 값을 받아서 디자인 가이드 토큰 값을 그대로 적었습니다.
 */
const BRAND = '#00A56E'; // point-green
const FAINT = '#CCCCCC'; // text-faint — 1등이 아닌 막대
const HAIRLINE = '#E0E0E0'; // 축 선

const axisStyle = { fontSize: 11, fill: '#7A7A7A' }; // text-muted
const axisLine = { stroke: HAIRLINE };

const tooltipStyle = {
  contentStyle: {
    borderRadius: 12,
    border: `1px solid ${HAIRLINE}`,
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
    <section className="flex flex-col gap-3 rounded-xl border border-hairline p-4">
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
          className="flex flex-col gap-0.5 rounded-xl bg-neutral-100 px-4 py-3.5"
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
  const max = Math.max(...stats.byCategory.map((c) => c.count));

  return (
    <Card title="어떤 분야의 액션이 많을까요" hint="공개된 액션 기준">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart
          data={stats.byCategory}
          margin={{ top: 4, right: 4, bottom: 0, left: -24 }}
        >
          <XAxis dataKey="category" tick={axisStyle} interval={0} angle={0} axisLine={axisLine} tickLine={false} />
          <YAxis tick={axisStyle} allowDecimals={false} axisLine={axisLine} tickLine={false} />
          <Tooltip {...tooltipStyle} formatter={(v) => [`${v}개`, '액션']} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {stats.byCategory.map((c, i) => (
              <Cell key={i} fill={c.count === max ? BRAND : FAINT} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

/** 주간 추이 */
export function WeeklyChart({ stats }: { stats: TrendStats }) {
  const max = Math.max(0, ...stats.byWeek.map((w) => w.count));

  return (
    <Card title="주마다 얼마나 생겨났나요" hint="최근 8주 동안 만들어진 액션 수">
      <ResponsiveContainer width="100%" height={180}>
        <LineChart
          data={stats.byWeek}
          margin={{ top: 4, right: 8, bottom: 0, left: -24 }}
        >
          <XAxis dataKey="week" tick={axisStyle} axisLine={axisLine} tickLine={false} />
          <YAxis tick={axisStyle} allowDecimals={false} axisLine={axisLine} tickLine={false} />
          <Tooltip {...tooltipStyle} formatter={(v) => [`${v}개`, '액션']} />
          <Line
            type="monotone"
            dataKey="count"
            stroke={BRAND}
            strokeWidth={2}
            // 가장 많은 주만 큰 점(흰 테두리) — 막대그래프의 「1등만 초록」과 같은 강조
            dot={(props: { cx?: number; cy?: number; index?: number; payload?: { count: number } }) => {
              const { cx, cy, index, payload } = props;
              const top = max > 0 && payload?.count === max;
              return (
                <circle
                  key={`dot-${index}`}
                  cx={cx}
                  cy={cy}
                  r={top ? 5.5 : 3}
                  fill={BRAND}
                  stroke={top ? '#FFFFFF' : 'none'}
                  strokeWidth={top ? 2 : 0}
                />
              );
            }}
            activeDot={{ r: 5, fill: BRAND }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}

/** 지역별 분포 */
export function RegionChart({ stats }: { stats: TrendStats }) {
  if (stats.byRegion.length === 0) return null;
  const max = Math.max(...stats.byRegion.map((r) => r.count));

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
          <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={14}>
            {stats.byRegion.map((r, i) => (
              <Cell key={i} fill={r.count === max ? BRAND : FAINT} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

/** 상태 분포 — 차트 대신 막대 하나로 (종류가 적어서 더 읽기 쉽습니다) */
export function StatusBar({ stats }: { stats: TrendStats }) {
  const total = stats.byStatus.reduce((s, x) => s + x.count, 0);
  if (total === 0) return null;

  // 기능색 토큰 — 상태 배지(Badge.tsx)와 같은 규칙 (2026-09-29):
  // 모집 중 = 진행중(info) · 결과 작성 필요 = 주의(warning) · 완료 = 완료(brand) · 취소됨 = 연회색(faint)
  const TONE: Record<string, string> = {
    ACTIVE: 'bg-info',
    ENDED: 'bg-warning',
    COMPLETED: 'bg-brand',
    CANCELLED: 'bg-faint',
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
            <span className="text-caption text-neutral-500">
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
