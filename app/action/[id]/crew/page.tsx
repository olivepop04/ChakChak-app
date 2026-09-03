/**
 * The Crew — 함께하는 사람들.
 *
 * getActionCrew 가 나간 사람(LEFT)을 이미 걸러냅니다.
 * 활동 이력 숫자도 함수가 계산해서 주므로 직접 세지 마세요.
 */
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActionCrew, groupCrewByItem } from '@/lib/queries/participations';
import { Avatar } from '@/components/ui/Avatar';
import { Header } from '@/components/layout/Header';
import { EmptyState } from '@/components/ui/EmptyState';
import type { UserSummary } from '@/lib/types/view';

function CrewRow({ person }: { person: UserSummary; isOwner?: boolean }) {
  return (
    <li className="flex items-center gap-3 px-5 py-3.5">
      <Avatar name={person.nickname} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-neutral-900">
          @{person.nickname}
        </p>
        <p className="text-[12px] text-neutral-500">
          참여 {person.participatedCount}개 · 호스트 {person.ledCount}개
        </p>
      </div>
      <Link
        href={`/user/${person.id}`}
        className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-[12px] font-medium text-neutral-700"
      >
        프로필 보기
      </Link>
    </li>
  );
}

export default async function CrewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/action/${id}/crew`);

  const { data: action } = await supabase
    .from('actions')
    .select('id, title')
    .eq('id', id)
    .maybeSingle();
  if (!action) notFound();

  const { owner, crew } = await getActionCrew(supabase, id, user.id);
  const groups = groupCrewByItem(crew);

  return (
    <main className="pb-36">
      <Header title="THE CREW" back backHref={`/action/${id}`} sticky />

      <div className="px-5 py-5">
        <h1 className="line-clamp-2 text-[17px] font-bold leading-snug text-neutral-900">
          {action.title}
        </h1>
      </div>

      <section className="px-5 pb-4">
        <h2 className="pb-2 text-[12px] font-semibold tracking-wide text-neutral-400">
          항목별 참여 현황
        </h2>
        {groups.length === 0 ? (
          <p className="rounded-xl bg-neutral-50 px-4 py-6 text-center text-[13px] leading-relaxed text-neutral-500">
            아직 확인할 수 있는 항목별 참여 정보가 없어요.
            <br />
            물품 참여 정보는 권한에 따라 보이지 않을 수 있어요.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {groups.map((group) => (
              <div key={group.itemId} className="rounded-xl border border-neutral-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          group.type === 'PERSON'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {group.type === 'PERSON' ? '사람' : '물품'}
                      </span>
                      <h3 className="truncate text-sm font-semibold text-neutral-900">
                        {group.name}
                      </h3>
                    </div>
                  </div>
                  <span className="shrink-0 text-[13px] font-bold tabular-nums text-neutral-700">
                    총 {group.total}
                    {group.unit}
                  </span>
                </div>

                <ul className="mt-3 flex flex-col gap-2 border-t border-neutral-100 pt-3">
                  {group.members.map(({ person, quantity }) => (
                    <li key={person.id} className="flex items-center gap-2.5">
                      <Avatar name={person.nickname} size="sm" />
                      <Link
                        href={`/user/${person.id}`}
                        className="min-w-0 flex-1 truncate text-[13px] font-semibold text-neutral-800"
                      >
                        @{person.nickname}
                      </Link>
                      {group.type === 'GOODS' && (
                        <span className="shrink-0 text-[12px] tabular-nums text-neutral-500">
                          {quantity}
                          {group.unit}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="text-[11px] leading-relaxed text-neutral-400">
              물품 참여 정보는 본인과 호스트에게 허용된 범위만 보여요.
            </p>
          </div>
        )}
      </section>

      {owner && (
        <section>
          <h2 className="px-5 pb-1 pt-2 text-[12px] font-semibold tracking-wide text-neutral-400">
            호스트
          </h2>
          <ul className="divide-y divide-neutral-100 border-y border-neutral-100">
            <CrewRow person={owner} isOwner />
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h2 className="px-5 pb-1 text-[12px] font-semibold tracking-wide text-neutral-400">
          함께하는 사람들 ({crew.length})
        </h2>
        {crew.length === 0 ? (
          <EmptyState
            icon="👋"
            title="아직 함께하는 사람이 없어요"
            description="가장 먼저 참여한 사람이 되어보세요."
          />
        ) : (
          <ul className="divide-y divide-neutral-100 border-y border-neutral-100">
            {crew.map((p) => (
              <CrewRow key={p.id} person={p} />
            ))}
          </ul>
        )}
      </section>

      {/* 하단 고정 버튼 */}
      <div className="fixed inset-x-0 bottom-14 z-30 mx-auto flex max-w-app flex-col gap-2 border-t border-neutral-200 bg-white p-4">
        <Link
          href={`/action/${id}/chat`}
          className="flex h-14 w-full items-center justify-center rounded-xl bg-neutral-900 text-base font-bold text-white shadow-sm transition-colors active:bg-neutral-800"
        >
          <svg
            className="mr-2.5 h-5 w-5 flex-none"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <span>함께하는 사람들과 이야기하기</span>
        </Link>
      </div>
    </main>
  );
}
