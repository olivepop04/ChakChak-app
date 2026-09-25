/**
 * 결과 보기.
 *
 * 비회원도 볼 수 있습니다. 결과를 공유하는 것이 서비스의 마지막 단계니까요.
 * 참여자에게는 아래에 "소감 남기기" 버튼을 보여줍니다.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActionResult } from '@/lib/queries/participations';
import { UsersRound, Package } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { CrewVoiceList } from '@/components/action/CrewVoiceList';
import { describeResult, describeResultRatio } from '@/lib/utils/quota';
import { cn } from '@/lib/utils/cn';
import { formatActivityPeriod } from '@/lib/utils/date';

export default async function ResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: action } = await supabase
    .from('actions')
    .select(
      `id, title, status, activity_start_at, activity_end_at,
       owner:profiles!actions_owner_id_fkey ( id, nickname )`,
    )
    .eq('id', id)
    .maybeSingle();
  if (!action) notFound();

  const owner = action.owner as unknown as { id: string; nickname: string } | null;
  const result = await getActionResult(supabase, id);

  // 내 참여 상태 — 소감 버튼을 보여줄지 판단합니다
  let myStatus: string | null = null;
  let iWroteVoice = false;
  if (user) {
    const [{ data: p }, { data: v }] = await Promise.all([
      supabase
        .from('participations')
        .select('status')
        .eq('action_id', id)
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('crew_voices')
        .select('id')
        .eq('action_id', id)
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);
    myStatus = p?.status ?? null;
    iWroteVoice = !!v;
  }

  const canWriteVoice =
    !!user && !!myStatus && myStatus !== 'LEFT' && !iWroteVoice && action.status === 'COMPLETED';

  if (!result) {
    return (
      <main>
        <Header title="액션 결과" back backHref={`/action/${id}`} />
        <EmptyState
          icon="📝"
          title="아직 결과가 등록되지 않았어요"
          description="호스트가 결과를 정리해서 올리면 이곳에서 확인할 수 있어요."
          action={{ label: '액션 보러 가기', href: `/action/${id}` }}
        />
      </main>
    );
  }

  return (
    <main className={canWriteVoice ? 'pb-52' : 'pb-24'}>
      <Header title="액션 결과" back backHref={`/action/${id}`} sticky />

      <div className="flex flex-col gap-6 px-6 py-6">
        {/* 제목 */}
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-bold leading-snug tracking-tight text-neutral-900">
            {action.title}
          </h1>
          <p className="text-label text-neutral-500">
            {formatActivityPeriod(action.activity_start_at, action.activity_end_at)}
          </p>
        </div>

        {/* 자동 집계 */}
        <section className="flex flex-col gap-3">
          <SectionTitle>함께 모은 것</SectionTitle>
          <div className="flex flex-col divide-y divide-neutral-100 rounded-xl border border-neutral-200 px-4 py-1">
            {result.items.map((item) => {
              const { ratio, isMet } = describeResultRatio(item, item.currentCount);
              const Icon = item.type === 'PERSON' ? UsersRound : Package;
              return (
                <div key={item.id} className="flex flex-col gap-2 py-3.5 first:pt-3 last:pb-3">
                  {/* 상단: 아이콘 + 항목명 + 최종 모집 수 (한 row) */}
                  <div className="flex items-center gap-2">
                    {/* 원 안의 아이콘 (테두리 없음) */}
                    <div
                      className={cn(
                        'flex h-9 w-9 flex-none items-center justify-center rounded-full',
                        isMet ? 'bg-brand-soft' : 'bg-neutral-100',
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-[18px] w-[18px]',
                          isMet ? 'text-brand' : 'text-neutral-500',
                        )}
                        aria-hidden="true"
                      />
                    </div>

                    <span className="flex-1 truncate text-sm font-bold text-neutral-900">
                      {item.name}
                    </span>

                    {/* 최종 모집 수만 표시 (목표 수 미표시) */}
                    <span
                      className={cn(
                        'shrink-0 text-sm font-bold tabular-nums',
                        isMet ? 'text-brand' : 'text-neutral-900',
                      )}
                    >
                      {item.currentCount}{item.unit}
                    </span>
                  </div>

                  {/* 프로그레스바 게이지 (앞까지 옴) */}
                  <div
                    className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200"
                    role="progressbar"
                    aria-valuenow={Math.round(ratio * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${item.name} 모집 현황`}
                  >
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-300',
                        isMet ? 'bg-brand' : 'bg-neutral-400',
                      )}
                      style={{ width: `${Math.round(ratio * 100)}%` }}
                    />
                  </div>

                  {/* 상태 안내 문구 */}
                  <p
                    className={cn(
                      'text-xs font-medium',
                      isMet ? 'text-brand' : 'text-neutral-500',
                    )}
                  >
                    {describeResult(item, item.currentCount)}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* 결과 내용 */}
        {result.content && (
          <section className="flex flex-col gap-2">
            <SectionTitle>이렇게 마무리했어요</SectionTitle>
            <p className="whitespace-pre-wrap text-body leading-relaxed text-neutral-700">
              {result.content}
            </p>
          </section>
        )}

        {/* 사진 */}
        {result.imageUrls.length > 0 && (
          <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {result.imageUrls.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt=""
                className="h-44 w-auto flex-none rounded-xl object-cover"
              />
            ))}
          </div>
        )}

        {/* 호스트의 한마디 */}
        {result.ownerVoice && (
          <section className="flex flex-col gap-2 rounded-xl bg-neutral-900 p-5 text-white">
            <h2 className="text-caption font-semibold tracking-wide text-white/60">
              호스트의 한마디
            </h2>
            <p className="whitespace-pre-wrap text-body leading-relaxed">
              {result.ownerVoice}
            </p>
            {owner && (
              <p className="mt-1 text-caption text-white/60">@{owner.nickname}</p>
            )}
          </section>
        )}

        {/* Crew Voice */}
        <section className="flex flex-col gap-3">
          <SectionTitle>Crew Voice ({result.crewVoices.length})</SectionTitle>

          {result.crewVoices.length === 0 ? (
            <p className="rounded-xl bg-neutral-50 px-4 py-6 text-center text-label text-neutral-400">
              아직 남겨진 소감이 없어요.
            </p>
          ) : (
            <CrewVoiceList voices={result.crewVoices} />
          )}
        </section>
      </div>

      {/* 소감 작성하기. 탭 높이는 globals.css 의 --nav-h 변수 (2026-09-18) */}
      {canWriteVoice && (
        <div className="fixed inset-x-0 bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom))] z-30 mx-auto max-w-app border-t border-neutral-200 bg-white p-4">
          <Link
            href={`/action/${id}/voice`}
            className="flex min-h-13 w-full items-center justify-center rounded-xl bg-neutral-900 py-3 text-body font-semibold text-white transition-colors active:bg-neutral-800"
          >
            소감 작성하기
          </Link>
        </div>
      )}
    </main>
  );
}
