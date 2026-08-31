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
import { getMyCreatedActions } from '@/lib/queries/actions';
import { ActionCard } from '@/components/ui/ActionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ParticipationBadge } from '@/components/ui/Badge';
import {
  LeaveButton,
  DeleteDraftButton,
  CancelActionButton,
} from '@/components/action/ActivityButtons';
import { cn } from '@/lib/utils/cn';
import type { JoinedActionData, ActionCardData } from '@/lib/types/view';

const btn =
  'inline-flex h-9 items-center justify-center rounded-lg px-3 text-[12px] font-semibold';
const primary = `${btn} bg-neutral-900 text-white`;
const secondary = `${btn} border border-neutral-300 bg-white text-neutral-700`;

/** 참여 상태별 버튼 (팀 합의 표 그대로) */
function JoinedFooter({ item }: { item: JoinedActionData }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <ParticipationBadge status={item.participationStatus} />
        {item.mySelection && (
          <span className="truncate text-[11px] text-neutral-500">
            {item.mySelection}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {item.participationStatus === 'BEFORE_ACTION' && (
          <>
            <Link href={`/action/${item.id}`} className={secondary}>
              액션 보기
            </Link>
            <Link href={`/action/${item.id}/chat`} className={secondary}>
              CREW CHAT
            </Link>
            <LeaveButton actionId={item.id} />
          </>
        )}

        {item.participationStatus === 'AFTER_ACTION' && (
          <>
            <Link href={`/action/${item.id}/result`} className={secondary}>
              결과 보기
            </Link>
            <Link href={`/action/${item.id}/voice`} className={primary}>
              소감 남기기
            </Link>
          </>
        )}

        {item.participationStatus === 'ACTUALLY_PARTICIPATED' && (
          <Link href={`/action/${item.id}/result`} className={secondary}>
            결과 보기
          </Link>
        )}
      </div>
    </div>
  );
}

/** 액션 상태별 버튼 */
function CreatedFooter({ item }: { item: ActionCardData }) {
  return (
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
          <Link href={`/action/${item.id}`} className={secondary}>
            액션 보기
          </Link>
          <CancelActionButton actionId={item.id} />
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
  }

  const joined = isCreated ? [] : await getMyJoinedActions(supabase, user.id);
  const created = isCreated ? await getMyCreatedActions(supabase, user.id) : [];

  return (
    <main className="pb-24">
      <header className="px-5 pb-3 pt-6">
        <h1 className="text-xl font-bold tracking-tight text-neutral-900">
          내 활동
        </h1>
      </header>

      {/* 탭 */}
      <div className="flex border-b border-neutral-200 px-5">
        {[
          { label: '참여한 액션', href: '/activity', active: !isCreated },
          { label: '만든 액션', href: '/activity?tab=created', active: isCreated },
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
            title="아직 만든 액션이 없어요"
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
                footer={<CreatedFooter item={a} />}
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
            <ActionCard key={a.id} action={a} footer={<JoinedFooter item={a} />} />
          ))}
        </div>
      )}
    </main>
  );
}
