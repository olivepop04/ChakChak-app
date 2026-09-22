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

const KOREAN_DATE = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function toKoreanDateKey(iso: string | null): string | null {
  return iso ? KOREAN_DATE.format(new Date(iso)) : null;
}

function CrewRow({ person }: { person: UserSummary; isOwner?: boolean }) {
  return (
    <li className="flex items-center gap-3 px-5 py-3.5">
      <Avatar name={person.nickname} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-neutral-900">
          @{person.nickname}
        </p>
        <p className="text-caption text-neutral-500">
          참여 {person.participatedCount}개 · 호스트 {person.ledCount}개
        </p>
      </div>
      <Link
        href={`/user/${person.id}`}
        className="shrink-0 rounded-full border border-neutral-300 px-3 py-1.5 text-label font-medium text-neutral-700"
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
    .select('id, title, owner_id, activity_start_at, activity_end_at')
    .eq('id', id)
    .maybeSingle();
  if (!action) notFound();

  const isOwner = action.owner_id === user.id;
  const { data: participation } = await supabase
    .from('participations')
    .select('status')
    .eq('action_id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  const isCrew = !!participation && participation.status !== 'LEFT';

  if (!isOwner && !isCrew) {
    return (
      <main>
        <Header title="함께하는 크루" back backHref={`/action/${id}`} />
        <EmptyState
          icon="🔒"
          title="참여한 사람만 볼 수 있어요"
          description="이 액션에 참여하면 함께하는 크루를 볼 수 있어요."
          action={{ label: '액션 보러 가기', href: `/action/${id}` }}
        />
      </main>
    );
  }

  const { owner, crew } = await getActionCrew(supabase, id, user.id);
  const personGroups = groupCrewByItem(crew).filter((group) => group.type === 'PERSON');
  const startDate = toKoreanDateKey(action.activity_start_at);
  const endDate = toKoreanDateKey(action.activity_end_at);
  const isMultiDay = startDate !== null && endDate !== null && startDate !== endDate;

  return (
    <main className="pb-36">
      <Header title="함께하는 크루" back backHref={`/action/${id}`} sticky />

      <div className="px-5 py-5">
        <h1 className="line-clamp-2 text-subtitle font-bold leading-snug text-neutral-900">
          {action.title}
        </h1>
      </div>

      {owner && (
        <section>
          <h2 className="px-5 pb-1 pt-2 text-caption font-semibold tracking-wide text-neutral-400">
            호스트
          </h2>
          <ul className="divide-y divide-neutral-100 border-y border-neutral-100">
            <CrewRow person={owner} isOwner />
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h2 className="px-5 pb-1 text-caption font-semibold tracking-wide text-neutral-400">
          함께하는 크루 ({crew.length})
        </h2>
        {crew.length === 0 ? (
          <EmptyState
            icon="👋"
            title="아직 함께하는 크루가 없어요"
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

      {isMultiDay && (
        <section className="px-5 pb-4 pt-6">
          <h2 className="pb-2 text-caption font-semibold tracking-wide text-neutral-400">
            항목별 참여 현황
          </h2>
          {personGroups.length === 0 ? (
            <p className="rounded-xl bg-neutral-50 px-4 py-6 text-center text-label leading-relaxed text-neutral-500">
              아직 확인할 수 있는 항목별 참여 정보가 없어요.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {personGroups.map((group) => (
                <div key={group.itemId} className="rounded-xl border border-neutral-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                          사람
                        </span>
                        <h3 className="truncate text-sm font-semibold text-neutral-900">
                          {group.name}
                        </h3>
                      </div>
                    </div>
                    <span className="shrink-0 text-label font-bold tabular-nums text-neutral-700">
                      총 {group.total}
                      {group.unit}
                    </span>
                  </div>

                  <ul className="mt-3 flex flex-col gap-2 border-t border-neutral-100 pt-3">
                    {group.members.map(({ person }) => (
                      <li key={person.id} className="flex items-center gap-2.5">
                        <Avatar name={person.nickname} size="sm" />
                        <Link
                          href={`/user/${person.id}`}
                          className="min-w-0 flex-1 truncate text-label font-semibold text-neutral-800"
                        >
                          @{person.nickname}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 하단 고정 버튼. 탭 높이는 globals.css 의 --nav-h 변수 (2026-09-18) */}
      <div className="fixed inset-x-0 bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-app flex-col gap-2 border-t border-neutral-200 bg-white p-4">
        <Link
          href={`/action/${id}/chat`}
          className="flex min-h-14 w-full items-center justify-center rounded-xl bg-neutral-900 py-3 text-base font-bold text-white transition-colors active:bg-neutral-800"
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
          <span>함께하는 크루와 이야기하기</span>
        </Link>
      </div>
    </main>
  );
}
