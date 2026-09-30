/**
 * The Crew — 함께하는 사람들.
 *
 * getActionCrew 가 나간 사람(LEFT)을 이미 걸러냅니다.
 * 활동 이력 숫자도 함수가 계산해서 주므로 직접 세지 마세요.
 */
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronRight, Lock, MessageSquareQuote, UsersRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getActionCrew, groupCrewByItem } from '@/lib/queries/participations';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
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

/** 목록형 사람 한 줄 — 줄 전체가 프로필 링크, 오른쪽 › 화살표. 호스트는 이름 옆 배지 (Day14 통일안) */
function CrewRow({ person, isOwner }: { person: UserSummary; isOwner?: boolean }) {
  return (
    <li>
      <Link
        href={`/user/${person.id}`}
        className="flex items-center gap-3 px-6 py-3 transition-colors hover:bg-neutral-50"
      >
        <Avatar name={person.nickname} avatar={person.avatar} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-body font-semibold text-neutral-900">
            <span className="truncate">@{person.nickname}</span>
            {isOwner && (
              <span className="shrink-0 rounded-full bg-brand-soft px-2 py-0.5 text-caption font-semibold text-brand">
                호스트
              </span>
            )}
          </p>
          <p className="mt-0.5 text-caption text-neutral-500">
            참여 {person.participatedCount}개 · 호스트 {person.ledCount}개
          </p>
        </div>
        <ChevronRight className="h-5 w-5 flex-none text-neutral-400" aria-hidden="true" />
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
          icon={Lock}
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

      <div className="px-6 py-5">
        <h1 className="line-clamp-2 font-paperlogy text-xl font-bold leading-snug tracking-tight text-neutral-900">
          {action.title}
        </h1>
      </div>

      {/* 호스트는 따로 칸을 두지 않고 목록 맨 위 + 이름 옆 배지 (Day14 통일안) */}
      <section>
        <h2 className="px-6 py-2 text-label font-bold text-neutral-500">
          함께하는 크루 ({crew.length + (owner ? 1 : 0)})
        </h2>
        <ul className="divide-y divide-neutral-100 border-y border-neutral-100">
          {owner && <CrewRow person={owner} isOwner />}
          {crew.map((p) => (
            <CrewRow key={p.id} person={p} />
          ))}
        </ul>
        {crew.length === 0 && (
          <EmptyState
            icon={UsersRound}
            title="아직 함께하는 크루가 없어요"
            description="가장 먼저 참여한 사람이 되어보세요."
          />
        )}
      </section>

      {isMultiDay && (
        <section className="px-6 py-5">
          <h2 className="mb-3 text-label font-bold text-neutral-500">
            항목별 참여 현황
          </h2>
          {personGroups.length === 0 ? (
            <p className="rounded-xl bg-neutral-100 px-4 py-6 text-center text-label leading-relaxed text-neutral-500">
              아직 확인할 수 있는 항목별 참여 정보가 없어요.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {personGroups.map((group) => (
                <div key={group.itemId} className="rounded-xl bg-brand-soft p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-brand">
                        <UsersRound className="h-4 w-4 text-white" aria-hidden="true" />
                      </span>
                      <h3 className="truncate text-sm font-semibold text-neutral-900">
                        {group.name}
                      </h3>
                    </div>
                    <span className="shrink-0 rounded-full border border-brand px-2.5 py-[3px] text-xs font-bold tabular-nums text-brand">
                      총 {group.total}
                      {group.unit}
                    </span>
                  </div>

                  <ul className="mt-3 flex flex-col gap-2.5 border-t border-white pt-3">
                    {group.members.map(({ person }) => (
                      <li key={person.id} className="flex items-center gap-2.5">
                        <Avatar name={person.nickname} avatar={person.avatar} size="sm" />
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

      {/* 하단 고정 버튼 — 통일안 CTA(공용 Button, 포인트 그린 채움 · 액션 상세 하단 버튼과 같은 모양) (2026-09-29).
          참여 완료 화면(welcome)의 같은 버튼은 연한 그린 그대로 둡니다 — 문구는 같고 모양만 다른 게 의도입니다.
          탭 높이는 globals.css 의 --nav-h 변수 (2026-09-18) */}
      <div className="fixed inset-x-0 bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-app flex-col gap-2 bg-white px-6 py-4">
        <Button href={`/action/${id}/chat`} size="lg" fullWidth>
          <MessageSquareQuote className="h-5 w-5 flex-none" aria-hidden="true" />
          <span>함께하는 크루와 이야기하기</span>
        </Button>
      </div>
    </main>
  );
}
