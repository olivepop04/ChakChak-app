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
import { createClient } from '@/lib/supabase/client';
import { postChatMessage, deleteChatMessage } from '@/lib/mutations';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { formatRelative } from '@/lib/utils/date';
import { LIMITS } from '@/lib/constants';
import type { ChatPost } from '@/lib/types/view';

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

  async function handleDelete(messageId: string, isPost: boolean) {
    const msg = isPost
      ? '이 글을 삭제할까요? 달린 댓글도 함께 사라집니다.'
      : '이 댓글을 삭제할까요?';
    if (!confirm(msg)) return;

    const res = await deleteChatMessage(createClient(), messageId);
    if (!res.ok) {
      toast(res.message, 'error');
      return;
    }
    router.refresh();
  }

  return (
    <div className="pb-40">
      {posts.length === 0 ? (
        <EmptyState
          icon="💬"
          title="아직 올라온 글이 없어요"
          description="첫 글을 남겨 이야기를 시작해보세요."
        />
      ) : (
        <ul className="flex flex-col gap-3 px-5 py-4">
          {posts.map((post) => (
            <li
              key={post.id}
              className="overflow-hidden rounded-xl border border-neutral-200"
            >
              {/* 원글 */}
              <div className="flex gap-3 p-4">
                <Avatar name={post.author.nickname} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-semibold text-neutral-900">
                      @{post.author.nickname}
                    </span>
                    <span className="text-[11px] text-neutral-400">
                      {formatRelative(post.createdAt)}
                    </span>
                    {post.isMine && !post.deletedAt && (
                      <button
                        type="button"
                        onClick={() => handleDelete(post.id, true)}
                        className="ml-auto text-[11px] text-neutral-400 hover:text-red-500"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                  <p
                    className={`mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed ${
                      post.deletedAt ? 'italic text-neutral-400' : 'text-neutral-800'
                    }`}
                  >
                    {post.content}
                  </p>
                </div>
              </div>

              {/* 댓글 */}
              {post.replies.length > 0 && (
                <ul className="flex flex-col gap-3 border-t border-neutral-100 bg-neutral-50 px-4 py-3">
                  {post.replies.map((reply) => (
                    <li key={reply.id} className="flex gap-2.5">
                      <Avatar name={reply.author.nickname} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-[12px] font-semibold text-neutral-800">
                            @{reply.author.nickname}
                          </span>
                          <span className="text-[11px] text-neutral-400">
                            {formatRelative(reply.createdAt)}
                          </span>
                          {reply.isMine && !reply.deletedAt && (
                            <button
                              type="button"
                              onClick={() => handleDelete(reply.id, false)}
                              className="ml-auto text-[11px] text-neutral-400 hover:text-red-500"
                            >
                              삭제
                            </button>
                          )}
                        </div>
                        <p
                          className={`mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-relaxed ${
                            reply.deletedAt
                              ? 'italic text-neutral-400'
                              : 'text-neutral-700'
                          }`}
                        >
                          {reply.content}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {/* 댓글 달기 */}
              {canWrite && !post.deletedAt && (
                <div className="border-t border-neutral-100 px-4 py-2.5">
                  {replyTo === post.id ? (
                    <div className="flex gap-2">
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
                        className="h-9 flex-1 rounded-lg border border-neutral-300 px-3 text-[13px] outline-none focus:border-neutral-900"
                      />
                      <Button
                        size="sm"
                        onClick={() => submitReply(post.id)}
                        disabled={busy || !replyText.trim()}
                      >
                        등록
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setReplyTo(post.id);
                        setReplyText('');
                      }}
                      className="text-[12px] font-medium text-neutral-500 hover:text-neutral-900"
                    >
                      댓글 달기
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* 하단 입력창 */}
      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-app border-t border-neutral-200 bg-white p-4">
        {canWrite ? (
          <div className="flex items-end gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={1}
              maxLength={LIMITS.CHAT_MAX}
              placeholder="크루에게 하고 싶은 말을 남겨보세요"
              className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-900"
            />
            <Button
              onClick={submitPost}
              loading={busy}
              disabled={!text.trim()}
              className="shrink-0"
            >
              등록
            </Button>
          </div>
        ) : (
          <p className="py-2 text-center text-[13px] text-neutral-400">
            {readOnlyReason ?? '지금은 글을 쓸 수 없어요.'}
          </p>
        )}
      </div>
    </div>
  );
}
