/**
 * 공개한 액션의 소개·안내사항 수정과 모집 항목 추가 — 호스트 전용.
 *
 * DRAFT는 기존 만들기 화면에서 이어서 작성하고, 이 화면에서는
 * 공개 이후 상태의 본문을 수정하거나 새 모집 항목만 추가합니다.
 */
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActionDetail } from '@/lib/queries/actions';
import { Header } from '@/components/layout/Header';
import { ActionTextEditForm } from '@/components/action/ActionTextEditForm';
import { AddActionItemsForm } from '@/components/action/AddActionItemsForm';
import { GENDER_REQUIREMENT_LABEL } from '@/lib/constants';
import { describeTarget } from '@/lib/utils/quota';

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

  const canAddActionItems = action.status === 'ACTIVE' && !action.recruitClosed;

  return (
    <main>
      <Header title="액션 수정" back backHref={`/action/${id}`} sticky />

      <section className="border-b border-neutral-100 px-5 py-4">
        <p className="text-caption font-medium text-neutral-400">수정 중인 액션</p>
        <h1 className="mt-1 line-clamp-2 text-subtitle font-bold leading-snug text-neutral-900">
          {action.title}
        </h1>
        <p className="mt-2 text-caption leading-relaxed text-neutral-500">
          소개와 안내사항은 계속 수정할 수 있고, 모집 중에는 새 모집 항목을 추가할 수
          있어요.
        </p>
      </section>

      <h2 className="px-5 pt-6 text-body font-bold text-neutral-900">소개·안내 수정</h2>
      <ActionTextEditForm
        actionId={action.id}
        initialDescription={action.description ?? ''}
        initialNotice={action.notice ?? ''}
      />

      <section className="border-t border-neutral-100 px-5 py-6">
        <h2 className="text-body font-bold text-neutral-900">현재 모집 항목</h2>
        <p className="mt-1 text-caption leading-relaxed text-neutral-500">
          공개한 뒤에는 기존 모집 항목을 수정하거나 삭제할 수 없어요.
        </p>

        {action.items.length === 0 ? (
          <p className="mt-4 rounded-xl bg-neutral-50 px-4 py-6 text-center text-label text-neutral-500">
            등록된 모집 항목이 없어요.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {action.items.map((item) => (
              <div key={item.id} className="rounded-xl border border-neutral-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-bold text-neutral-600">
                        {item.type === 'PERSON' ? '인원' : '물품'}
                      </span>
                      <h3 className="truncate text-sm font-semibold text-neutral-900">
                        {item.name}
                      </h3>
                    </div>
                    <p className="mt-1 text-caption text-neutral-500">
                      {describeTarget(item)}
                    </p>
                    {item.type === 'PERSON' && (
                      <p className="mt-1 text-caption text-neutral-500">
                        {GENDER_REQUIREMENT_LABEL[item.gender_requirement]}
                        {item.conditionName ? ` · ${item.conditionName}` : ''}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-caption font-semibold text-neutral-600">
                    🔒 잠김
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {canAddActionItems ? (
        <AddActionItemsForm actionId={action.id} />
      ) : (
        <section className="border-t border-neutral-100 px-5 pb-28 pt-6">
          <h2 className="text-body font-bold text-neutral-900">모집 항목 추가</h2>
          <p className="mt-3 rounded-xl bg-neutral-50 px-4 py-5 text-label leading-relaxed text-neutral-500">
            모집이 끝난 액션에는 새 모집 항목을 추가할 수 없어요.
          </p>
        </section>
      )}
    </main>
  );
}
