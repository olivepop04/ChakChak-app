/**
 * 결과 작성 — Owner 만, ENDED 상태에서만.
 *
 * ENDED 는 활동 종료 시각이 지나면 sync_action_status() 가 자동으로 바꿉니다
 * (액션 상세를 열 때 확인합니다).
 */
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActionItems } from '@/lib/queries/actions';
import { formatActivityPeriod } from '@/lib/utils/date';
import { ResultWriteForm } from '@/components/action/ResultWriteForm';
import { Header } from '@/components/layout/Header';

export default async function ResultWritePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/action/${id}/result/write`);

  // 종료 시각이 지났다면 여기서 ENDED 로 넘겨 줍니다
  await supabase.rpc('sync_action_status', { p_action_id: id });

  const { data: action } = await supabase
    .from('actions')
    .select('id, title, status, owner_id, place_name, address, activity_start_at, activity_end_at')
    .eq('id', id)
    .maybeSingle();
  if (!action) notFound();

  if (action.owner_id !== user.id) redirect(`/action/${id}`);

  // 이미 공개했으면 결과 화면으로
  if (action.status === 'COMPLETED') redirect(`/action/${id}/result`);
  // 아직 활동이 안 끝났으면 상세로
  if (action.status !== 'ENDED') redirect(`/action/${id}`);

  const [items, { data: existing }] = await Promise.all([
    getActionItems(supabase, id),
    supabase
      .from('action_results')
      .select('content, image_urls, owner_voice')
      .eq('action_id', id)
      .maybeSingle(),
  ]);

  const location = action.place_name || action.address;
  const period = formatActivityPeriod(action.activity_start_at, action.activity_end_at);

  return (
    <main>
      <Header title="결과 작성" back backHref={`/action/${id}`} sticky />

      <div className="border-b border-neutral-100 px-6 py-4">
        <h1 className="font-paperlogy text-[20px] font-bold leading-snug tracking-tight text-neutral-900">
          {action.title}
        </h1>
        {/* 장소 | 일정 — 결과 보기 화면과 같은 형식 */}
        <div className="mt-2 flex flex-wrap items-center gap-y-1 text-label font-semibold text-neutral-500">
          {location && (
            <>
              <span>{location}</span>
              {period && <span className="mx-2 h-3 w-px flex-none bg-neutral-100" aria-hidden="true" />}
            </>
          )}
          {period && <span>{period}</span>}
        </div>
      </div>

      <ResultWriteForm
        actionId={id}
        items={items}
        initial={
          existing
            ? {
                content: existing.content ?? '',
                imageUrls: existing.image_urls ?? [],
                ownerVoice: existing.owner_voice ?? '',
              }
            : null
        }
      />
    </main>
  );
}
