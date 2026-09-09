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
  'inline-flex h-9 items-center justify-center rounded-lg px-3 text-[12px] font-semibold';
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

  // ENDED: 호스트가 아직 결과를 안 올렸습니다.
  // 결과가 없는데 「결과 보기」를 띄우면 "아직 결과가 등록되지 않았어요" 화면으로
  // 헛걸음하게 됩니다. 상태별 가이드대로 CREW CHAT 만 둡니다.
  if (item.status === 'ENDED') {
    return (
      <div className="flex flex-wrap gap-1.5">
        <Link href={`/action/${item.id}/chat`} className={secondary}>
          CREW CHAT
        </Link>
      </div>
    );
  }

  // COMPLETED: 결과가 나왔습니다. 소감은 결과 화면 아래에서 씁니다.
  //
  // 버튼 크기는 「호스트한 액션」 탭과 맞춥니다 — 내용 너비 · flex-wrap.
  // 전에는 5:5 로 늘렸는데, 두 탭을 나란히 보면 같은 버튼이 서로 다른
  // 크기로 보였습니다. 글자 배율을 키우면 이쪽이 줄바꿈으로 안전하게 흐릅니다.
  if (item.status === 'COMPLETED') {
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
      {isShortfall && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12px] leading-relaxed text-amber-800">
          <p className="font-semibold text-amber-900">⚠️ 모집 인원 미달 (마감됨)</p>
          <p className="mt-0.5 text-[11px] text-amber-700">
            최소 모집 수량을 채우지 못했습니다. 그대로 계속 진행하시거나 아래 [취소하기] 버튼으로 액션을 취소해 주세요.
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

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const isCreated = tab === 'created';

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

  const joined = isCreated ? [] : await getMyJoinedActions(supabase, user.id);
  const created = isCreated ? await getMyCreatedActions(supabase, user.id) : [];


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

  return (
    <main className="pb-24">
      <Header title="내 활동" back backHref="/" sticky />

      {/* 탭 */}
      <div className="flex border-b border-neutral-200 px-5">
        {[
          { label: '참여한 액션', href: '/activity', active: !isCreated },
          { label: '호스트한 액션', href: '/activity?tab=created', active: isCreated },
        ].map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              '-mb-px border-b-2 px-4 py-3 text-[14px] font-semibold transition-colors',
              t.active
                ? 'border-neutral-900 text-neutral-900'
                : 'border-transparent text-neutral-400',
            )}
          >
            {t.label}
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
        ) : (
          <div className="flex flex-col gap-4 px-5 py-5">
            {created.map((a) => (
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
      ) : (
        <div className="flex flex-col gap-4 px-5 py-5">
          {joined.map((a) => (
            <div key={a.id} className="relative">
              <ActionCard action={a} footer={<JoinedFooter item={a} />} />
              {a.status !== 'CANCELLED' && (
                <div className="pointer-events-none absolute right-3 top-3 z-10">
                  <ParticipationBadge
                    status={a.participationStatus}
                    className="rounded-md border border-neutral-200/60 px-2.5 py-1 text-[12px] font-bold shadow-md"
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
