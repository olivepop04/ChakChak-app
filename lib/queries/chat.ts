/**
 * Crew Chat (게시판형) 조회. 담당: 개발 B
 *
 * 구조: 원글 + 댓글 1단계. 대댓글은 DB 트리거가 막는다.
 * 삭제된 글은 지우지 않고 deleted_at 만 채워지므로,
 * 화면에서 "삭제된 글입니다" 로 바꿔 보여준다.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';
import type { ChatPost, ChatReply, ChatKind } from '@/lib/types/view';

type DB = SupabaseClient<Database>;

interface RawMessage {
  id: string;
  parent_id: string | null;
  content: string;
  deleted_at: string | null;
  created_at: string;
  kind: string | null;
  author: { id: string; nickname: string; avatar: string | null } | null;
}

/** 원글을 오래된 순으로, 각 원글 아래 댓글을 오래된 순으로 묶어서 반환 */
export async function getChatPosts(
  supabase: DB,
  actionId: string,
  viewerId: string | null,
): Promise<ChatPost[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select(
      `id, parent_id, content, deleted_at, created_at, kind,
       author:profiles!chat_messages_user_id_fkey ( id, nickname, avatar )`,
    )
    .eq('action_id', actionId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as unknown as RawMessage[];
  const posts: ChatPost[] = [];
  const replyMap = new Map<string, ChatReply[]>();

  for (const r of rows) {
    const base = {
      id: r.id,
      content: r.deleted_at ? '삭제된 글입니다.' : r.content,
      createdAt: r.created_at,
      deletedAt: r.deleted_at,
      kind: (r.kind ?? 'NORMAL') as ChatKind,
      author: r.author ?? { id: '', nickname: '알 수 없음', avatar: null },
      isMine: !!viewerId && r.author?.id === viewerId,
    };

    if (r.parent_id) {
      const list = replyMap.get(r.parent_id) ?? [];
      list.push(base);
      replyMap.set(r.parent_id, list);
    } else {
      posts.push({ ...base, replies: [] });
    }
  }

  for (const p of posts) {
    p.replies = replyMap.get(p.id) ?? [];
  }

  return posts;
}

/**
 * 글을 쓸 수 있는 상태인가.
 * ACTIVE / ENDED 에서만 쓸 수 있고, COMPLETED / CANCELLED 는 읽기 전용이다.
 * (RLS 도 같은 조건으로 막지만, 버튼을 미리 숨기기 위해 화면에서도 확인한다)
 */
export function canWriteChat(actionStatus: string): boolean {
  return actionStatus === 'ACTIVE' || actionStatus === 'ENDED';
}
