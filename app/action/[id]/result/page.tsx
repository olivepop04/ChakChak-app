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
import { Header } from '@/components/layout/Header';
import { EmptyState } from '@/components/ui/EmptyState';
import { CrewVoiceList } from '@/components/action/CrewVoiceList';
import { describeResult, describeResultCount } from '@/lib/utils/quota';
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
    myStatus === 'AFTER_ACTION' && !iWroteVoice && action.status === 'COMPLETED';

  if (!result) {
    return (
      <main>
        <Header title="결과" back backHref={`/action/${id}`} />
        <EmptyState
          icon="📝"
          title="아직 결과가 등록되지 않았어요"
          description="활동이 끝나면 호스트가 결과를 정리해 올려요."
          action={{ label: '액션 보러 가기', href: `/action/${id}` }}
        />
      </main>
    );
  }

  return (
    <main className={canWriteVoice ? 'pb-52' : 'pb-24'}>
      <Header title="ACTION RESULT" back backHref={`/action/${id}`} sticky />

      <div className="flex flex-col gap-7 px-5 py-6">
        {/* 제목 */}
        <div className="flex flex-col gap-2">
          <h1 className="text-[20px] font-bold leading-snug tracking-tight text-neutral-900">
            {action.title}
          </h1>
          <p className="text-[13px] text-neutral-500">
            {formatActivityPeriod(action.activity_start_at, action.activity_end_at)}
          </p>
        </div>

        {/* 자동 집계 */}
        <section className="flex flex-col gap-3">
          <h2 className="text-[15px] font-bold text-neutral-900">함께 모은 것</h2>
          <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-4">
            {result.items.map((item) => (
              <div key={item.id} className="flex flex-col gap-0.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-neutral-900">
                    {item.name}
                  </span>
                  <span className="text-[17px] font-bold tabular-nums text-neutral-900">
                    {describeResultCount(item, item.currentCount)}
                  </span>
                </div>
                <p
                  className={`text-[12px] ${
                    item.isMinMet ? 'text-emerald-700' : 'text-neutral-500'
                  }`}
                >
                  {describeResult(item, item.currentCount)}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* 결과 내용 */}
        {result.content && (
          <section className="flex flex-col gap-2">
            <h2 className="text-[15px] font-bold text-neutral-900">
              이렇게 마무리했어요
            </h2>
            <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-neutral-700">
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
            <h2 className="text-[12px] font-semibold tracking-wide text-white/60">
              호스트의 한마디
            </h2>
            <p className="whitespace-pre-wrap text-[14px] leading-relaxed">
              {result.ownerVoice}
            </p>
            {owner && (
              <p className="mt-1 text-[12px] text-white/60">@{owner.nickname}</p>
            )}
          </section>
        )}

        {/* Crew Voice */}
        <section className="flex flex-col gap-3">
          <h2 className="text-[15px] font-bold text-neutral-900">
            Crew Voice ({result.crewVoices.length})
          </h2>

          {result.crewVoices.length === 0 ? (
            <p className="rounded-xl bg-neutral-50 px-4 py-6 text-center text-[13px] text-neutral-400">
              아직 남겨진 소감이 없어요.
            </p>
          ) : (
            <CrewVoiceList voices={result.crewVoices} />
          )}
        </section>
      </div>

      {/* 소감 남기기 */}
      {canWriteVoice && (
        <div className="fixed inset-x-0 bottom-14 z-30 mx-auto max-w-app border-t border-neutral-200 bg-white p-4">
          <Link
            href={`/action/${id}/voice`}
            className="flex h-13 w-full items-center justify-center rounded-xl bg-neutral-900 text-[15px] font-semibold text-white"
          >
            소감 남기기
          </Link>
        </div>
      )}
    </main>
  );
}
