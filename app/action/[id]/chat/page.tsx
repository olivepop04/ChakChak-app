/**
 * Crew Chat.
 *
 * 접근 권한은 RLS 가 막습니다 (Owner 또는 나가지 않은 참여자만).
 * 권한이 없으면 조회 결과가 빈 배열로 오므로, 여기서 한 번 더 확인해
 * "권한이 없다" 는 것을 알려줍니다. 빈 게시판처럼 보이면 오해하니까요.
 */
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getChatPosts, canWriteChat } from '@/lib/queries/chat';
import { formatActivityPeriod } from '@/lib/utils/date';
import { ChatBoard } from '@/components/action/ChatBoard';
import { Header } from '@/components/layout/Header';
import { Lock } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { type ActionStatus } from '@/lib/constants';

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/action/${id}/chat`);

  const { data: action } = await supabase
    .from('actions')
    .select('id, title, status, owner_id, place_name, address, activity_start_at, activity_end_at')
    .eq('id', id)
    .maybeSingle();
  if (!action) notFound();

  // 내가 이 액션의 멤버인가 (Owner 이거나, 나가지 않은 참여자)
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
        <Header title="크루 채팅" back backHref={`/action/${id}`} />
        <EmptyState
          icon={Lock}
          title="참여한 사람만 볼 수 있어요"
          description="이 액션에 참여하면 크루들과 이야기할 수 있어요."
          action={{ label: '액션 보러 가기', href: `/action/${id}` }}
        />
      </main>
    );
  }

  const posts = await getChatPosts(supabase, id, user.id);
  const status = action.status as ActionStatus;
  const writable = canWriteChat(status);
  // 장소 | 일정 — 결과 보기·결과 작성과 같은 표기
  const location = action.place_name || action.address;
  const period = formatActivityPeriod(action.activity_start_at, action.activity_end_at);

  return (
    <main>
      <Header title="크루 채팅" back backHref={`/action/${id}`} sticky asH1={false} />

      {/* 상단 액션명 강조 — 작은 라벨(오른쪽 글 수) · 제목 · 장소 | 일정 · 아래 구분선 (2026-10-06 디자인 패치, 함께하는 크루와 같은 틀) */}
      <div className="border-b border-neutral-100 px-6 py-5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-label font-medium text-neutral-500">이 액션의 채팅</p>
          <span className="text-label font-medium text-neutral-500">글 {posts.length}개</span>
        </div>
        <h1 className="mt-1 line-clamp-2 break-keep font-paperlogy text-xl font-bold leading-snug tracking-tight text-neutral-900">
          {action.title}
        </h1>
        {(location || period) && (
          <div className="mt-2 flex flex-wrap items-center gap-y-1 text-label font-semibold text-neutral-500">
            {location && <span>{location}</span>}
            {location && period && (
              <span className="mx-2 h-3 w-px flex-none bg-neutral-200" aria-hidden="true" />
            )}
            {period && <span>{period}</span>}
          </div>
        )}
      </div>

      <ChatBoard
        actionId={id}
        posts={posts}
        canWrite={writable}
        readOnlyReason={
          status === 'DRAFT'
            ? '아직 공개 전이라 크루가 없어요.'
            : status === 'CANCELLED'
              ? '취소된 액션이라 새 글을 쓸 수 없어요.'
              : '완료된 액션이라 새 글을 쓸 수 없어요. 읽기는 계속 가능해요.'
        }
      />
    </main>
  );
}
