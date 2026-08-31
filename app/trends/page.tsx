/**
 * 트렌드 대시보드.
 *
 * ★ 이 파일은 조합만 합니다.
 *   집계는 lib/queries/stats.ts, 그래프는 components/trends/Charts.tsx 에 있습니다.
 *
 *   Home 안으로 옮기고 싶다면 app/page.tsx 에서 아래 컴포넌트들을 import 하면 됩니다.
 *   이 페이지를 지워도 나머지는 그대로 동작합니다.
 */
import { createClient } from '@/lib/supabase/server';
import { getTrendStats } from '@/lib/queries/stats';
import {
  SummaryTiles,
  CategoryChart,
  WeeklyChart,
  RegionChart,
  StatusBar,
} from '@/components/trends/Charts';
import { InsightPanel } from '@/components/trends/InsightPanel';
import { Header } from '@/components/layout/Header';
import { EmptyState } from '@/components/ui/EmptyState';

export default async function TrendsPage() {
  const supabase = await createClient();
  const stats = await getTrendStats(supabase);

  if (stats.totalActions === 0) {
    return (
      <main>
        <Header title="TRENDS" back backHref="/" />
        <EmptyState
          icon="📊"
          title="아직 보여드릴 활동이 없어요"
          description="액션이 쌓이면 어떤 분야가 활발한지 알려드릴게요."
          action={{ label: '액션 만들기', href: '/action/create' }}
        />
      </main>
    );
  }

  return (
    <main className="pb-24">
      <Header title="TRENDS" back backHref="/" sticky />

      <div className="flex flex-col gap-5 px-5 py-5">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight text-neutral-900">
            지금 GOOD에서는
          </h1>
          <p className="mt-1 text-[13px] text-neutral-500">
            사람들이 어떤 좋은 일을 하고 있는지 모아봤어요.
          </p>
        </div>

        <SummaryTiles stats={stats} />
        <InsightPanel />
        <CategoryChart stats={stats} />
        <WeeklyChart stats={stats} />
        <RegionChart stats={stats} />
        <StatusBar stats={stats} />
      </div>
    </main>
  );
}
