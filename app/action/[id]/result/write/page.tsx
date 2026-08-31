/**
 * 결과 작성 — Owner 만, ENDED 상태에서만.
 *
 * ENDED 는 활동 종료 시각이 지나면 sync_action_status() 가 자동으로 바꿉니다
 * (액션 상세를 열 때 확인합니다).
 */
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActionItems } from '@/lib/queries/actions';
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
    .select('id, title, status, owner_id')
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

  return (
    <main>
      <Header title="결과 작성" back backHref={`/action/${id}`} sticky />

      <div className="border-b border-neutral-100 px-5 py-4">
        <h1 className="line-clamp-2 text-[17px] font-bold leading-snug text-neutral-900">
          {action.title}
        </h1>
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
