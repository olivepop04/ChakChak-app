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

  // 장소 | 일정 — 결과 보기·크루 화면과 같은 표기
  const joinLocation = action.placeName || action.address;
  const joinPeriod = formatActivityPeriod(action.activityStartAt, action.activityEndAt);

  return (
    <main>
      <Header title="참여하기" back backHref={`/action/${id}`} sticky asH1={false} />

      {/* 액션 요약 — 크루·크루 채팅과 같은 머리: 라벨 · 제목 · 장소 | 일정 (2026-10-06 디자인 패치)
          그 전엔 일정·주소를 회색 상자에 따로 담았는데, 같은 정보를 한 줄로 옮김 */}
      <section className="flex flex-col border-b border-neutral-100 px-6 py-5">
        <p className="text-label font-medium text-neutral-500">이 액션에 참여해요</p>
        <h1 className="mt-1 line-clamp-2 break-keep font-paperlogy text-xl font-bold leading-snug tracking-tight text-neutral-900">
          {action.title}
        </h1>
        {(joinLocation || joinPeriod) && (
          <div className="mt-2 flex flex-wrap items-center gap-y-1 text-label font-semibold text-neutral-500">
            {joinLocation && <span>{joinLocation}</span>}
            {joinLocation && joinPeriod && (
              <span className="mx-2 h-3 w-px flex-none bg-neutral-200" aria-hidden="true" />
            )}
            {joinPeriod && <span>{joinPeriod}</span>}
          </div>
        )}
        <div className="mt-3 flex items-center gap-2">
          <Avatar name={action.owner.nickname} avatar={action.owner.avatar} size="sm" />
          <span className="text-label text-neutral-600">
            @{action.owner.nickname}
          </span>
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
