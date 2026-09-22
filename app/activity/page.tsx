/**
 * Activity — 내가 참여한 액션 / 내가 만든 액션.
 *
 * 탭은 주소로 구분합니다 (?tab=created).
 * useState 가 아니라 Link 로 이동하므로 서버에서 데이터를 바로 가져올 수 있습니다.
 */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMyJoinedActions } from '@/lib/queries/participations';
import { syncHostNotifications } from '@/lib/notifications/lazy';
import { getMyCreatedActions } from '@/lib/queries/actions';
import { ActionCard } from '@/components/ui/ActionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ParticipationBadge } from '@/components/ui/Badge';
import { Chip } from '@/components/ui/Chip';
import { Header } from '@/components/layout/Header';
import {
  LeaveButton,
  DeleteDraftButton,
  CancelActionButton,
  EarlyEndButton,
} from '@/components/action/ActivityButtons';
import { getShortfallActionIds } from '@/lib/queries/stats';
import { cn } from '@/lib/utils/cn';
import type { JoinedActionData, ActionCardData } from '@/lib/types/view';

const btn =
  'inline-flex min-h-9 items-center justify-center rounded-full px-3 py-2 text-label font-semibold';
const primary = `${btn} bg-neutral-900 text-white`;
const secondary = `${btn} border border-neutral-300 bg-white text-neutral-700`;

/** 참여 액션 상태별 버튼 */
function JoinedFooter({ item }: { item: JoinedActionData }) {
  if (item.status === 'CANCELLED') {
    return (
      <div className="flex flex-wrap gap-1.5">
        <Link href={`/action/${item.id}`} className={secondary}>
          취소 사유 보기
        </Link>
      </div>
    );
  }

  if (item.status === 'ACTIVE') {
    const isStarted = item.activityStartAt
      ? new Date(item.activityStartAt) <= new Date()
      : false;

    return (
      <div className="flex flex-wrap gap-1.5">
        <Link href={`/action/${item.id}/chat`} className={secondary}>
          CREW CHAT
        </Link>
        {!isStarted && item.participationStatus === 'BEFORE_ACTION' && (
          <LeaveButton actionId={item.id} />
        )}
      </div>
    );
  }

  // ENDED / COMPLETED (소감 작성 필요 · 참여 완료):
  // 동일한 '소감 작성 필요' 상태에서 일관되게 CREW CHAT 과 결과 보기 버튼을 모두 제공합니다.
  // ENDED 상태에서 결과를 누르면 "아직 결과가 등록되지 않았어요" 안내 화면으로 연결됩니다.
  if (
    item.participationStatus === 'AFTER_ACTION' ||
    item.status === 'ENDED' ||
    item.status === 'COMPLETED'
  ) {
    return (
      <div className="flex flex-wrap gap-1.5">
        <Link href={`/action/${item.id}/chat`} className={secondary}>
          CREW CHAT
        </Link>
        <Link href={`/action/${item.id}/result`} className={secondary}>
          결과 보기
        </Link>
      </div>
    );
  }

  // 위에서 안 걸린 상태 (지금은 없습니다)
  return (
    <div className="flex flex-wrap gap-1.5">
      <Link href={`/action/${item.id}/chat`} className={secondary}>
        CREW CHAT
      </Link>
    </div>
  );
}

/** 액션 상태별 버튼 (모집 미달 안내 F37 포함) */
function CreatedFooter({
  item,
  isShortfall = false,
}: {
  item: ActionCardData;
  isShortfall?: boolean;
}) {
  const isStarted = item.activityStartAt
    ? new Date(item.activityStartAt) <= new Date()
    : false;

  return (
    <div className="flex flex-col gap-2.5">
      {/* 1. 모집 마감 ~ 활동 시작 전: 목표 미달 시에만 취소 안내 (F37) */}
      {!isStarted && isShortfall && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-caption leading-relaxed text-amber-800">
          <p className="font-semibold text-amber-900">⚠️ 최소 목표 미달 (모집 마감)</p>
          <p className="mt-0.5 text-caption text-amber-700">
            최소 모집 인원·수량을 채우지 못했습니다. 활동 시작 전까지 아래 [취소하기] 버튼으로 액션을 취소하실 수 있습니다.
          </p>
          <p className="mt-0.5 text-caption text-amber-600">
            (시작 시각 이후에는 취소가 불가하며, 별도 조치가 없으면 예정대로 진행됩니다.)
          </p>
        </div>
      )}

      {/* 2. 활동 시작 ~ 활동 종료 전: 진행 중인 모든 액션에 조기종료 안내 */}
      {item.status === 'ACTIVE' && isStarted && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-caption leading-relaxed text-blue-800">
          <p className="font-semibold text-blue-900">💡 활동 조기종료 안내</p>
          <p className="mt-0.5 text-caption text-blue-700">
            활동 종료 시각 전까지 아래 [조기종료] 버튼으로 활동을 일찍 마칠 수 있습니다.
          </p>
          <p className="mt-0.5 text-caption text-blue-600">
            (악천후, 장소 문제, 현저한 불참 등 부득이한 사정이 있거나 여러날 진행예정이었던 액션을 조기 달성한 경우 사용해 주세요.)
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {item.status === 'DRAFT' && (
          <>
            <Link href={`/action/create?id=${item.id}`} className={primary}>
              계속 작성하기
            </Link>
            <DeleteDraftButton actionId={item.id} />
          </>
        )}

        {item.status === 'ACTIVE' && (
          <>
            <Link href={`/action/${item.id}/chat`} className={secondary}>
              CREW CHAT
            </Link>
            {isStarted ? (
              <EarlyEndButton actionId={item.id} />
            ) : (
              <CancelActionButton actionId={item.id} />
            )}
          </>
        )}

        {item.status === 'ENDED' && (
          <>
            <Link href={`/action/${item.id}/chat`} className={secondary}>
              CREW CHAT
            </Link>
            <Link href={`/action/${item.id}/result/write`} className={primary}>
              결과 작성
            </Link>
          </>
        )}

        {item.status === 'COMPLETED' && (
          <>
            <Link href={`/action/${item.id}/chat`} className={secondary}>
              CREW CHAT
            </Link>
            <Link href={`/action/${item.id}/result`} className={secondary}>
              결과 보기
            </Link>
          </>
        )}

        {item.status === 'CANCELLED' && (
          <Link href={`/action/${item.id}`} className={secondary}>
            취소 사유 보기
          </Link>
        )}
      </div>
    </div>
  );
}

type CreatedFilter =
  | 'all'
  | 'active'
  | 'ended'
  | 'completed'
  | 'draft'
  | 'cancelled';

type JoinedFilter =
  | 'all'
  | 'before'
  | 'after'
  | 'completed'
  | 'cancelled';

const CREATED_FILTERS: { key: CreatedFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'active', label: '모집/진행중' },
  { key: 'ended', label: '결과작성필요' },
  { key: 'completed', label: '완료' },
  { key: 'draft', label: '작성중' },
  { key: 'cancelled', label: '취소됨' },
];

const JOINED_FILTERS: { key: JoinedFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'before', label: '참여예정' },
  { key: 'after', label: '소감작성필요' },
  { key: 'completed', label: '참여 완료' },
  { key: 'cancelled', label: '취소됨' },
];

function filterCreatedAction(a: ActionCardData, f: CreatedFilter): boolean {
  switch (f) {
    case 'active':
      return a.status === 'ACTIVE';
    case 'ended':
      return a.status === 'ENDED';
    case 'completed':
      return a.status === 'COMPLETED';
    case 'draft':
      return a.status === 'DRAFT';
    case 'cancelled':
      return a.status === 'CANCELLED';
    case 'all':
    default:
      return true;
  }
}

function filterJoinedAction(a: JoinedActionData, f: JoinedFilter): boolean {
  switch (f) {
    case 'before':
      return a.status !== 'CANCELLED' && a.participationStatus === 'BEFORE_ACTION';
    case 'after':
      return a.status !== 'CANCELLED' && a.participationStatus === 'AFTER_ACTION';
    case 'completed':
      return a.status !== 'CANCELLED' && a.participationStatus === 'ACTUALLY_PARTICIPATED';
    case 'cancelled':
      return a.status === 'CANCELLED' || a.participationStatus === 'LEFT';
    case 'all':
    default:
      return true;
  }
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; filter?: string }>;
}) {
  const { tab, filter } = await searchParams;
  // 기본값(/activity) 및 ?tab=created 는 호스트한 액션, ?tab=joined 는 참여한 액션
  const isCreated = tab !== 'joined';

  const createdFilter: CreatedFilter = CREATED_FILTERS.some((f) => f.key === filter)
    ? (filter as CreatedFilter)
    : 'all';

  const joinedFilter: JoinedFilter = JOINED_FILTERS.some((f) => f.key === filter)
    ? (filter as JoinedFilter)
    : 'all';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/activity');

  /*
   * 활동이 끝난 내 액션을 ENDED 로 넘겨 줍니다.
   *
   * 상태 전환은 액션을 열어볼 때 일어나는데(lazy), 아무도 안 열면
   * Owner 는 "결과를 작성해주세요" 알림조차 못 받습니다.
   * 그래서 Owner 가 자기 목록을 여는 이 시점에 확인합니다.
   * 내 액션만 대상이라 호출 수가 많지 않습니다.
   */
  if (isCreated) {
    const { data: stale } = await supabase
      .from('actions')
      .select('id')
      .eq('owner_id', user.id)
      .eq('status', 'ACTIVE')
      .lt('activity_end_at', new Date().toISOString());

    for (const a of stale ?? []) {
      await supabase.rpc('sync_action_status', { p_action_id: a.id });
    }

    // 모집이 마감됐는데 인원이 모자란 액션을 호스트에게 알립니다 (F37).
    // 알림 화면을 안 열고 여기만 봐도 상황을 알 수 있어야 합니다.
    await syncHostNotifications(user.id);
  } else {
    // 내가 참여한 액션 중 활동 기간이 지난 ACTIVE 액션의 생애주기를 ENDED로 동기화합니다.
    const { data: joinedParts } = await supabase
      .from('participations')
      .select('action_id')
      .eq('user_id', user.id)
      .neq('status', 'LEFT');

    const joinedActionIds = (joinedParts ?? []).map((p) => p.action_id);
    if (joinedActionIds.length > 0) {
      const { data: staleJoined } = await supabase
        .from('actions')
        .select('id')
        .in('id', joinedActionIds)
        .eq('status', 'ACTIVE')
        .lt('activity_end_at', new Date().toISOString());

      for (const a of staleJoined ?? []) {
        await supabase.rpc('sync_action_status', { p_action_id: a.id });
      }
    }
  }

  // 액션 생성일 최신순 (actions.created_at DESC)
  const created = isCreated ? await getMyCreatedActions(supabase, user.id) : [];
  // 참여 생성일 최신순 (participations.created_at DESC)
  const joined = isCreated ? [] : await getMyJoinedActions(supabase, user.id);

  const filteredCreated = created.filter((a) => filterCreatedAction(a, createdFilter));
  const filteredJoined = joined.filter((a) => filterJoinedAction(a, joinedFilter));

  const expiredActiveIds = isCreated
    ? created
      .filter(
        (a) =>
          a.status === 'ACTIVE' &&
          a.recruitEndAt &&
          new Date(a.recruitEndAt) < new Date(),
      )
      .map((a) => a.id)
    : [];

  const shortfallIds = isCreated
    ? await getShortfallActionIds(supabase, expiredActiveIds)
    : new Set<string>();

  function makeCreatedFilterUrl(key: CreatedFilter) {
    return key === 'all' ? '/activity' : `/activity?filter=${key}`;
  }

  function makeJoinedFilterUrl(key: JoinedFilter) {
    return key === 'all' ? '/activity?tab=joined' : `/activity?tab=joined&filter=${key}`;
  }

  return (
    <main className="pb-24">
      <Header title="내 액션" back backHref="/" sticky />

      {/* 탭: 호스트한 액션 / 참여한 액션 */}
      <div className="flex border-b border-neutral-200 px-5">
        {[
          { label: '호스트한 액션', href: '/activity', active: isCreated },
          { label: '참여한 액션', href: '/activity?tab=joined', active: !isCreated },
        ].map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              '-mb-px border-b-2 px-4 py-3 text-body font-semibold transition-colors',
              t.active
                ? 'border-neutral-900 text-neutral-900'
                : 'border-transparent text-neutral-400',
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* 상태 필터 탭 */}
      <div className="flex flex-row flex-nowrap items-center gap-2 overflow-x-auto border-b border-neutral-100 bg-white px-5 py-3 scroll-smooth [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {isCreated
          ? CREATED_FILTERS.map((f) => (
            <Link
              key={f.key}
              href={makeCreatedFilterUrl(f.key)}
              scroll={false}
              className="shrink-0"
            >
              <Chip
                selected={createdFilter === f.key}
                as="span"
                className="whitespace-nowrap px-3.5 py-1.5 text-label"
              >
                {f.label}
              </Chip>
            </Link>
          ))
          : JOINED_FILTERS.map((f) => (
            <Link
              key={f.key}
              href={makeJoinedFilterUrl(f.key)}
              scroll={false}
              className="shrink-0"
            >
              <Chip
                selected={joinedFilter === f.key}
                as="span"
                className="whitespace-nowrap px-3.5 py-1.5 text-label"
              >
                {f.label}
              </Chip>
            </Link>
          ))}
      </div>

      {/* 목록 */}
      {isCreated ? (
        created.length === 0 ? (
          <EmptyState
            icon="✏️"
            title="아직 호스트한 액션이 없어요"
            description="함께할 사람을 모아보세요."
            action={{ label: '액션 만들기', href: '/action/create' }}
          />
        ) : filteredCreated.length === 0 ? (
          <EmptyState
            icon="🔍"
            title="아직 해당 액션이 없어요"

            action={{ label: '전체 보기', href: '/activity' }}
          />
        ) : (
          <div className="flex flex-col gap-4 px-5 py-5">
            {filteredCreated.map((a) => (
              <ActionCard
                key={a.id}
                action={a}
                showStatus
                footer={
                  <CreatedFooter
                    item={a}
                    isShortfall={shortfallIds.has(a.id)}
                  />
                }
              />
            ))}
          </div>
        )
      ) : joined.length === 0 ? (
        <EmptyState
          icon="🌱"
          title="아직 참여한 액션이 없어요"
          description="마음에 드는 액션을 찾아보세요."
          action={{ label: '액션 찾아보기', href: '/discover' }}
        />
      ) : filteredJoined.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="아직 해당 액션이 없어요"

          action={{ label: '전체 보기', href: '/activity?tab=joined' }}
        />
      ) : (
        <div className="flex flex-col gap-4 px-5 py-5">
          {filteredJoined.map((a) => (
            <div key={a.id} className="relative">
              <ActionCard action={a} footer={<JoinedFooter item={a} />} />
              {a.status !== 'CANCELLED' && (
                // 2026-09-21: ActionCard 세로형이 작성자·공유 줄(56px)을 썸네일 위로 옮기면서
                // 이 뱃지가 이미지 위가 아니라 카드 맨 위(작성자 줄)에 얹히던 회귀 버그 수정.
                // top-3 → top-[72px](헤더 56px + 이미지 내부 여백 16px)로 이미지 위 자리로 되돌림.
                <div className="pointer-events-none absolute right-4 top-[72px] z-10">
                  <ParticipationBadge
                    status={a.participationStatus}
                    className="rounded-full border border-neutral-200/60 px-2.5 py-1 text-caption font-bold"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
