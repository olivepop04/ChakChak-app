/**
 * 공개한 액션의 소개·안내사항 수정 — 호스트 전용.
 *
 * DRAFT는 기존 만들기 화면에서 이어서 작성하고, 이 화면에서는
 * 공개 이후 상태의 description / notice만 수정합니다.
 */
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActionDetail } from '@/lib/queries/actions';
import { Header } from '@/components/layout/Header';
import { ActionTextEditForm } from '@/components/action/ActionTextEditForm';

export default async function EditActionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?next=/action/${id}/edit`);

  const action = await getActionDetail(supabase, id, user.id);
  if (!action) notFound();
  if (!action.isOwner) redirect(`/action/${id}`);

  if (action.status === 'DRAFT') {
    redirect(`/action/create?id=${id}`);
  }

  return (
    <main>
      <Header title="소개·안내 수정" back backHref={`/action/${id}`} sticky />

      <section className="border-b border-neutral-100 px-5 py-4">
        <p className="text-[11px] font-medium text-neutral-400">수정 중인 액션</p>
        <h1 className="mt-1 line-clamp-2 text-[17px] font-bold leading-snug text-neutral-900">
          {action.title}
        </h1>
        <p className="mt-2 text-[12px] leading-relaxed text-neutral-500">
          공개한 뒤에는 소개와 안내사항만 수정할 수 있어요.
        </p>
      </section>

      <ActionTextEditForm
        actionId={action.id}
        initialDescription={action.description ?? ''}
        initialNotice={action.notice ?? ''}
      />
    </main>
  );
}
