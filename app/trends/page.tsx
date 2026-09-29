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
import { ChartColumn } from 'lucide-react';
import { Header } from '@/components/layout/Header';

export default async function TrendsPage() {
  const supabase = await createClient();
  const stats = await getTrendStats(supabase);

  if (stats.totalActions === 0) {
    return (
      <main>
        <Header title="트렌드" back backHref="/" />
        {/* 2026-09-29 통일안 — 이모지 📊 → 회색 원 + 막대 아이콘, 검정 「액션 만들기」 버튼은 없앰
            (하단 탭 「+」와 겹침). 알림·내 액션 빈 화면과 같은 모양 */}
        <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
          <span
            aria-hidden="true"
            className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100"
          >
            <ChartColumn className="h-6 w-6 text-neutral-500" />
          </span>
          <p className="text-body font-semibold text-neutral-800">아직 보여드릴 활동이 없어요</p>
          <p className="text-label leading-relaxed text-neutral-500">
            액션이 쌓이면 어떤 분야가 활발한지 알려드릴게요.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="pb-24">
      <Header title="트렌드" back backHref="/" sticky />

      <div className="flex flex-col gap-5 px-6 py-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">
            지금 착착에서는
          </h1>
          <p className="mt-1 text-label text-neutral-500">
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
