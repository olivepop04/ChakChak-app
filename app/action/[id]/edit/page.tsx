/**
 * 공개한 액션의 소개·안내사항 수정과 모집 항목 추가 — 호스트 전용.
 *
 * DRAFT는 기존 만들기 화면에서 이어서 작성하고, 이 화면에서는
 * 공개 이후 상태의 본문을 수정하거나 새 모집 항목만 추가합니다.
 */
import { notFound, redirect } from 'next/navigation';
import { Pencil, PencilOff, UsersRound, Package } from 'lucide-react';
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

      <section className="border-b border-neutral-100 px-6 py-4">
        <div className="mb-2 flex items-center gap-1.5">
          <Pencil className="h-3.5 w-3.5 text-neutral-500" />
          <p className="text-body font-bold text-neutral-500">수정 중인 액션</p>
        </div>
        <div className="h-px bg-neutral-200" />
        <h1 className="mt-3 line-clamp-2 font-paperlogy text-xl font-bold leading-snug text-hairline-focus">
          {action.title}
        </h1>
        <p className="mt-2 text-caption leading-relaxed text-neutral-500">
          소개와 안내사항은 계속 고칠 수 있고, 모집 중엔 새 항목도 자유롭게 추가하세요.
        </p>
      </section>

      <h2 className="px-6 pt-6 text-body font-bold text-neutral-900">소개·안내 수정</h2>
      <ActionTextEditForm
        actionId={action.id}
        initialDescription={action.description ?? ''}
        initialNotice={action.notice ?? ''}
      />

      <section className="border-t border-neutral-100 px-6 py-6">
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
              <div key={item.id} className="rounded-xl bg-[#F5F5F7] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                    {item.type === 'PERSON' ? (
                      <UsersRound className="h-4 w-4 shrink-0 text-neutral-400" />
                    ) : (
                      <Package className="h-4 w-4 shrink-0 text-neutral-400" />
                    )}
                    <h3 className="whitespace-nowrap text-sm font-semibold text-neutral-500">
                      {item.name}
                    </h3>
                    <span className="h-3 w-px shrink-0 bg-neutral-300" />
                    <span className="whitespace-nowrap text-caption text-neutral-500">
                      {describeTarget(item)}
                    </span>
                    {item.type === 'PERSON' && (
                      <>
                        <span className="h-3 w-px shrink-0 bg-neutral-300" />
                        <span className="whitespace-nowrap text-caption text-neutral-500">
                          {GENDER_REQUIREMENT_LABEL[item.gender_requirement]}
                          {item.conditionName ? ` · ${item.conditionName}` : ''}
                        </span>
                      </>
                    )}
                  </div>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                    <PencilOff className="h-4 w-4 text-faint" aria-label="수정할 수 없음" />
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
        <section className="border-t border-neutral-100 px-6 pb-28 pt-6">
          <h2 className="text-body font-bold text-neutral-900">모집 항목 추가</h2>
          <p className="mt-3 rounded-xl bg-neutral-50 px-4 py-5 text-label leading-relaxed text-neutral-500">
            모집이 끝난 액션에는 새 모집 항목을 추가할 수 없어요.
          </p>
        </section>
      )}
    </main>
  );
}
