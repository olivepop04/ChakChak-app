/**
 * Crew Chat — 게시판.
 *
 * 대화방처럼 보이지만 구조는 게시판입니다.
 *  - 원글 + 댓글 1단계. 대댓글은 DB 트리거가 막습니다.
 *  - 실시간 아님. 화면에 들어올 때 최신 목록을 불러옵니다.
 *  - 본인 글만 삭제. 원글을 지우면 딸린 댓글도 함께 사라집니다.
 *
 * 삭제된 글은 목록에서 빠지지 않고 "삭제된 글입니다" 로 바뀝니다.
 * (content 는 서버 조회 함수가 이미 바꿔서 줍니다)
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUp, MessageCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { postChatMessage, deleteChatMessage } from '@/lib/mutations';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils/cn';
import { formatRelative } from '@/lib/utils/date';
import { LIMITS } from '@/lib/constants';
import { ReasonModal } from '@/components/action/ReasonModal';
import type { ChatPost, ChatReply } from '@/lib/types/view';

type DeleteTarget = {
  messageId: string;
  isPost: boolean;
} | null;

/** 원글·댓글 한 줄. 카드 없이 흐르는 목록이라 두 곳이 같은 모양을 씁니다. */
function ChatMessageRow({
  author,
  content,
  createdAt,
  deletedAt,
  kind,
  isMine,
  indent,
  onReply,
  onDelete,
}: {
  author: { nickname: string; avatar?: string | null };
  content: string;
  createdAt: string;
  deletedAt: string | null;
  kind: ChatReply['kind'];
  isMine: boolean;
  indent?: boolean;
  onReply?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className={cn('flex gap-2.5 py-4', indent && 'ml-[42px]')}>
      <Avatar name={author.nickname} avatar={author.avatar} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-label font-semibold text-neutral-900">
            @{author.nickname}
          </span>
          {kind === 'LEFT_NOTICE' && (
            <span className="shrink-0 rounded-lg bg-[#F0F0F0] px-1.5 py-0.5 text-caption font-bold text-neutral-400">
              참여 취소
            </span>
          )}
        </div>
        <p
          className={cn(
            'mt-1 whitespace-pre-wrap break-words text-body leading-relaxed',
            deletedAt ? 'italic text-neutral-400' : 'text-neutral-800',
          )}
        >
          {content}
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-caption text-neutral-400">{formatRelative(createdAt)}</span>
          {onReply && (
            <button
              type="button"
              onClick={onReply}
              className="text-label font-bold text-neutral-600 hover:text-neutral-900"
            >
              답글 달기
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="ml-auto text-caption text-neutral-400 hover:text-danger"
            >
              삭제
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ChatBoard({
  actionId,
  posts,
  canWrite,
  readOnlyReason,
}: {
  actionId: string;
  posts: ChatPost[];
  canWrite: boolean;
  readOnlyReason?: string;
}) {
  const router = useRouter();
  const toast = useToast();

  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  /** 어느 원글에 댓글을 다는 중인지 */
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function submitPost() {
    // 전송 버튼 중복 클릭 방지 — 빠르게 두 번 누르면 글이 두 개 올라갑니다
    if (busy || !text.trim()) return;
    setBusy(true);

    const res = await postChatMessage(createClient(), actionId, text);
    if (!res.ok) {
      toast(res.message, 'error');
    } else {
      setText('');
      router.refresh();
    }
    setBusy(false);
  }

  async function submitReply(parentId: string) {
    if (busy || !replyText.trim()) return;
    setBusy(true);

    const res = await postChatMessage(createClient(), actionId, replyText, parentId);
    if (!res.ok) {
      toast(res.message, 'error');
    } else {
      setReplyText('');
      setReplyTo(null);
      router.refresh();
    }
    setBusy(false);
  }

  async function handleDelete() {
    if (!deleteTarget || deleteBusy) return;

    setDeleteBusy(true);
    const res = await deleteChatMessage(createClient(), deleteTarget.messageId);
    if (!res.ok) {
      toast(res.message, 'error');
    } else {
      setDeleteTarget(null);
      router.refresh();
    }
    setDeleteBusy(false);
  }

  return (
    <div className="pb-44">
      {posts.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="아직 올라온 글이 없어요"
          description="첫 글을 남겨 이야기를 시작해보세요."
        />
      ) : (
        <div className="flex flex-col px-6">
          {posts.map((post, postIdx) => {
            const isLastPost = postIdx === posts.length - 1;
            const canReplyToPost = canWrite && !post.deletedAt && post.kind !== 'LEFT_NOTICE';

            return (
              <div key={post.id}>
                <ChatMessageRow
                  author={post.author}
                  content={post.content}
                  createdAt={post.createdAt}
                  deletedAt={post.deletedAt}
                  kind={post.kind}
                  isMine={post.isMine}
                  onReply={canReplyToPost ? () => { setReplyTo(post.id); setReplyText(''); } : undefined}
                  onDelete={
                    post.isMine &&
                    !post.deletedAt &&
                    post.kind !== 'LEFT_NOTICE' &&
                    post.kind !== 'EARLY_END_NOTICE'
                      ? () => setDeleteTarget({ messageId: post.id, isPost: true })
                      : undefined
                  }
                />

                {post.replies.map((reply) => (
                  <div key={reply.id}>
                    <div className="ml-[42px] border-t border-neutral-100" />
                    <ChatMessageRow
                      author={reply.author}
                      content={reply.content}
                      createdAt={reply.createdAt}
                      deletedAt={reply.deletedAt}
                      kind={reply.kind}
                      isMine={reply.isMine}
                      indent
                      onDelete={
                        reply.isMine && !reply.deletedAt
                          ? () => setDeleteTarget({ messageId: reply.id, isPost: false })
                          : undefined
                      }
                    />
                  </div>
                ))}

                {replyTo === post.id && (
                  <div className="ml-[42px] flex min-h-11 items-center gap-2 rounded-xl border border-hairline py-1 pl-3.5 pr-1 mb-4">
                    <input
                      autoFocus
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitReply(post.id);
                        if (e.key === 'Escape') setReplyTo(null);
                      }}
                      maxLength={LIMITS.CHAT_MAX}
                      placeholder="댓글을 입력하세요"
                      className="flex-1 bg-transparent py-1.5 text-body outline-none placeholder:text-neutral-400"
                    />
                    <button
                      type="button"
                      onClick={() => submitReply(post.id)}
                      disabled={busy || !replyText.trim()}
                      aria-label="댓글 등록"
                      className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-brand text-white disabled:opacity-40"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {!isLastPost && <div className="border-t border-neutral-100" />}
              </div>
            );
          })}
        </div>
      )}

      {/* 하단 입력창. 탭 높이는 globals.css 의 --nav-h 변수 (2026-09-18) */}
      <div className="fixed inset-x-0 bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom))] z-30 mx-auto max-w-app bg-white px-6 py-4">
        {canWrite ? (
          <div className="flex min-h-11 items-center gap-2 rounded-xl border border-hairline py-1 pl-3.5 pr-1">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={1}
              maxLength={LIMITS.CHAT_MAX}
              placeholder="크루에게 하고 싶은 말을 남겨보세요"
              className="max-h-32 flex-1 resize-none bg-transparent py-1.5 text-body outline-none placeholder:text-neutral-400"
            />
            <button
              type="button"
              onClick={submitPost}
              disabled={busy || !text.trim()}
              aria-label="보내기"
              className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-brand text-white disabled:opacity-40"
            >
              <ArrowUp className="h-[18px] w-[18px]" />
            </button>
          </div>
        ) : (
          <p className="py-2 text-center text-label text-neutral-400">
            {readOnlyReason ?? '지금은 글을 쓸 수 없어요.'}
          </p>
        )}
      </div>

      <ReasonModal
        open={deleteTarget !== null}
        title={deleteTarget?.isPost ? '이 글을 삭제할까요?' : '이 댓글을 삭제할까요?'}
        description={deleteTarget?.isPost ? '달린 댓글도 함께 사라집니다.' : undefined}
        confirmLabel="삭제"
        confirmVariant="danger"
        busy={deleteBusy}
        onClose={() => {
          if (!deleteBusy) setDeleteTarget(null);
        }}
        onConfirm={handleDelete}
      />
    </div>
  );
}
