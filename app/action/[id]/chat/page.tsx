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
import { ChatBoard } from '@/components/action/ChatBoard';
import { Header } from '@/components/layout/Header';
import { EmptyState } from '@/components/ui/EmptyState';
import { ACTION_STATUS_LABEL, type ActionStatus } from '@/lib/constants';

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
    .select('id, title, status, owner_id')
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
        <Header title="CREW CHAT" back backHref={`/action/${id}`} />
        <EmptyState
          icon="🔒"
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

  return (
    <main>
      <Header title="CREW CHAT" back backHref={`/action/${id}`} sticky />

      <div className="border-b border-neutral-100 px-5 py-4">
        <h1 className="line-clamp-1 text-[15px] font-bold text-neutral-900">
          {action.title}
        </h1>
        <p className="mt-0.5 text-[12px] text-neutral-500">
          {ACTION_STATUS_LABEL[status]} · 글 {posts.length}개
        </p>
      </div>

      <ChatBoard
        actionId={id}
        posts={posts}
        canWrite={writable}
        readOnlyReason={
          status === 'CANCELLED'
            ? '취소된 액션이라 새 글을 쓸 수 없어요.'
            : '완료된 액션이라 새 글을 쓸 수 없어요. 읽기는 계속 가능해요.'
        }
      />
    </main>
  );
}
