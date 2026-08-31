/**
 * 참여하기.
 *
 * 로그인 확인은 middleware 가 이미 했습니다.
 * 여기서는 "지금 참여할 수 있는 상태인가" 만 확인하고,
 * 아니면 Detail 로 돌려보냅니다.
 */
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActionDetail } from '@/lib/queries/actions';
import { JoinForm } from '@/components/action/JoinForm';
import { Header } from '@/components/layout/Header';
import { formatActivityPeriod } from '@/lib/utils/date';
import { Avatar } from '@/components/ui/Avatar';
import type { Gender } from '@/lib/constants';

export default async function JoinPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/action/${id}/join`);

  const action = await getActionDetail(supabase, id, user.id);
  if (!action) notFound();

  // 참여할 수 없는 상황이면 Detail 로 보냅니다.
  // (Detail 의 하단 버튼이 이유를 알려줍니다)
  if (
    action.status !== 'ACTIVE' ||
    action.isOwner ||
    action.recruitClosed ||
    (action.myParticipation && action.myParticipation !== 'LEFT')
  ) {
    redirect(`/action/${id}`);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('gender')
    .eq('id', user.id)
    .maybeSingle();

  return (
    <main>
      <Header title="JOIN ACTION" back backHref={`/action/${id}`} sticky />

      {/* 액션 요약 */}
      <section className="flex flex-col gap-3 border-b border-neutral-100 px-5 py-5">
        <h1 className="text-[18px] font-bold leading-snug tracking-tight text-neutral-900">
          {action.title}
        </h1>
        <div className="flex items-center gap-2">
          <Avatar name={action.owner.nickname} size="sm" />
          <span className="text-[13px] text-neutral-600">
            @{action.owner.nickname}
          </span>
        </div>
        <div className="rounded-xl bg-neutral-50 p-3.5">
          <p className="text-[13px] font-medium text-neutral-900">
            {formatActivityPeriod(action.activityStartAt, action.activityEndAt)}
          </p>
          {action.address && (
            <p className="mt-0.5 text-[12px] text-neutral-500">{action.address}</p>
          )}
        </div>
      </section>

      <JoinForm
        actionId={action.id}
        items={action.items}
        myGender={(profile?.gender as Gender | undefined) ?? null}
      />
    </main>
  );
}
