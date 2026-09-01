/**
 * The Crew — 함께하는 사람들.
 *
 * getActionCrew 가 나간 사람(LEFT)을 이미 걸러냅니다.
 * 활동 이력 숫자도 함수가 계산해서 주므로 직접 세지 마세요.
 */
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActionCrew } from '@/lib/queries/participations';
import { Avatar } from '@/components/ui/Avatar';
import { Header } from '@/components/layout/Header';
import { EmptyState } from '@/components/ui/EmptyState';
import type { UserSummary } from '@/lib/types/view';

function CrewRow({ person, isOwner }: { person: UserSummary; isOwner?: boolean }) {
  return (
    <li className="flex items-center gap-3 px-5 py-3.5">
      <Avatar name={person.nickname} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
          @{person.nickname}
          {isOwner && (
            <span className="rounded bg-neutral-900 px-1.5 py-0.5 text-[10px] font-bold text-white">
              호스트
            </span>
          )}
        </p>
        <p className="text-[12px] text-neutral-500">
          {person.participatedCount}개 참여 · {person.ledCount}개 리드
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

  return (
    <main className="pb-10">
      <Header title="THE CREW" back backHref={`/action/${id}`} sticky />

      <div className="px-5 py-5">
        <h1 className="line-clamp-2 text-[17px] font-bold leading-snug text-neutral-900">
          {action.title}
        </h1>
      </div>

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
    </main>
  );
}
