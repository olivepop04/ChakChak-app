/**
 * 데이터를 바꾸는 모든 동작.
 *
 * ★ 화면에서 supabase.rpc(...) 나 .insert(...) 를 직접 쓰지 말고 여기 함수를 부르세요.
 *
 * 모든 함수는 { ok: true } 또는 { ok: false, message: '사람이 읽을 수 있는 이유' } 를 돌려줍니다.
 * message 를 그대로 Toast 에 띄우면 됩니다. try/catch 를 매번 쓸 필요가 없습니다.
 *
 * 사용 예 (클라이언트 컴포넌트):
 *
 *   const supabase = createClient();
 *   const res = await joinAction(supabase, actionId, [{ actionItemId, quantity: 1 }]);
 *   if (!res.ok) { showToast(res.message); return; }
 *   router.push(`/action/${actionId}/welcome`);
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';

type DB = SupabaseClient<Database>;

export type Result<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; message: string };

/**
 * Postgres 함수가 던진 메시지를 화면에 쓸 수 있게 다듬는다.
 * RPC 안의 RAISE EXCEPTION 문구가 그대로 사용자에게 보이도록 설계했다.
 */
function toMessage(error: { message?: string } | null, fallback: string) {
  const raw = error?.message ?? '';
  if (!raw) return fallback;

  // PostgREST 가 붙이는 접두사 제거
  const cleaned = raw
    .replace(/^.*?(?:ERROR|error):\s*/i, '')
    .replace(/\s*\(SQLSTATE.*\)$/i, '')
    .trim();

  // 한글이 들어 있으면 우리가 쓴 메시지다. 그대로 보여준다.
  if (/[가-힣]/.test(cleaned)) return cleaned;

  // 영어 시스템 오류는 사용자에게 그대로 보여주지 않는다.
  if (cleaned.includes('duplicate key')) return '이미 처리된 요청입니다.';
  if (cleaned.includes('permission') || cleaned.includes('policy'))
    return '권한이 없습니다.';
  return fallback;
}

// ═════════════════════════════════════════════════════════════
// 참여  — 담당: 개발 B
// ═════════════════════════════════════════════════════════════

export interface JoinItemInput {
  actionItemId: string;
  /** 사람 항목은 항상 1. 물품은 사용자가 입력한 수량 */
  quantity: number;
}

/**
 * 참여 확정.
 * 정원 초과·성별 조건·모집 마감 확인은 전부 서버가 한다.
 * 동시에 두 사람이 신청해도 서버에서 순서대로 처리된다.
 */
export async function joinAction(
  supabase: DB,
  actionId: string,
  items: JoinItemInput[],
): Promise<Result<string>> {
  const { data, error } = await supabase.rpc('join_action', {
    p_action_id: actionId,
    p_items: items.map((i) => ({
      action_item_id: i.actionItemId,
      quantity: i.quantity,
    })),
  });

  if (error) return { ok: false, message: toMessage(error, '참여 신청에 실패했어요.') };
  return { ok: true, data: data as string };
}

/** 나가기. 활동 시작 전에만 가능하다. */
export async function leaveAction(
  supabase: DB,
  actionId: string,
): Promise<Result> {
  const { error } = await supabase.rpc('leave_action', {
    p_action_id: actionId,
  });
  if (error) return { ok: false, message: toMessage(error, '나가기에 실패했어요.') };
  return { ok: true, data: undefined };
}

/** 소감 작성. 저장과 동시에 참여 상태가 ACTUALLY_PARTICIPATED 로 바뀐다. */
export async function submitCrewVoice(
  supabase: DB,
  actionId: string,
  content: string,
): Promise<Result> {
  const { error } = await supabase.rpc('submit_crew_voice', {
    p_action_id: actionId,
    p_content: content,
  });
  if (error) return { ok: false, message: toMessage(error, '소감 저장에 실패했어요.') };
  return { ok: true, data: undefined };
}

// ═════════════════════════════════════════════════════════════
// 액션 상태  — 담당: 민호
// ═════════════════════════════════════════════════════════════

/** DRAFT → ACTIVE. AI 검수를 통과한 뒤 Owner 가 공개 버튼을 눌렀을 때. */
export async function publishAction(
  supabase: DB,
  actionId: string,
): Promise<Result> {
  const { error } = await supabase.rpc('publish_action', {
    p_action_id: actionId,
  });
  if (error) return { ok: false, message: toMessage(error, '공개에 실패했어요.') };
  return { ok: true, data: undefined };
}

/** ENDED → COMPLETED. 결과를 먼저 저장해야 한다. */
export async function completeAction(
  supabase: DB,
  actionId: string,
): Promise<Result> {
  const { error } = await supabase.rpc('complete_action', {
    p_action_id: actionId,
  });
  if (error)
    return { ok: false, message: toMessage(error, '결과 공개에 실패했어요.') };
  return { ok: true, data: undefined };
}

/** 취소. 사유 5자 이상. 참여자 전원에게 알림이 간다. */
export async function cancelAction(
  supabase: DB,
  actionId: string,
  reason: string,
): Promise<Result> {
  const { error } = await supabase.rpc('cancel_action', {
    p_action_id: actionId,
    p_reason: reason,
  });
  if (error) return { ok: false, message: toMessage(error, '취소에 실패했어요.') };
  return { ok: true, data: undefined };
}

/** DRAFT 삭제. 공개된 적 없는 것만 지울 수 있다. */
export async function deleteDraft(
  supabase: DB,
  actionId: string,
): Promise<Result> {
  const { error } = await supabase
    .from('actions')
    .delete()
    .eq('id', actionId)
    .eq('status', 'DRAFT');
  if (error) return { ok: false, message: toMessage(error, '삭제에 실패했어요.') };
  return { ok: true, data: undefined };
}

// ═════════════════════════════════════════════════════════════
// 게시판  — 담당: 개발 B
// ═════════════════════════════════════════════════════════════

/** 원글 또는 댓글 작성. parentId 를 주면 댓글이 된다. */
export async function postChatMessage(
  supabase: DB,
  actionId: string,
  content: string,
  parentId?: string,
): Promise<Result> {
  const trimmed = content.trim();
  if (trimmed.length === 0)
    return { ok: false, message: '내용을 입력해주세요.' };
  if (trimmed.length > 1000)
    return { ok: false, message: '1000자를 넘을 수 없어요.' };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: '로그인이 필요합니다.' };

  const { error } = await supabase.from('chat_messages').insert({
    action_id: actionId,
    user_id: user.id,
    parent_id: parentId ?? null,
    content: trimmed,
  });

  if (error) return { ok: false, message: toMessage(error, '글 작성에 실패했어요.') };
  return { ok: true, data: undefined };
}

/** 본인 글 삭제. 원글을 지우면 딸린 댓글도 함께 지워진다. */
export async function deleteChatMessage(
  supabase: DB,
  messageId: string,
): Promise<Result> {
  const { error } = await supabase.rpc('delete_chat_message', {
    p_message_id: messageId,
  });
  if (error) return { ok: false, message: toMessage(error, '삭제에 실패했어요.') };
  return { ok: true, data: undefined };
}

// ═════════════════════════════════════════════════════════════
// 좋아요 · 저장 · 팔로우  — 담당: 디자이너(버튼), 개발 A(목록)
// 낙관적 업데이트를 쓰고, 실패하면 화면을 원래대로 되돌리세요.
// ═════════════════════════════════════════════════════════════

export async function toggleLike(
  supabase: DB,
  actionId: string,
  currentlyLiked: boolean,
): Promise<Result<boolean>> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: '로그인이 필요합니다.' };

  const { error } = currentlyLiked
    ? await supabase
        .from('likes')
        .delete()
        .eq('user_id', user.id)
        .eq('action_id', actionId)
    : await supabase
        .from('likes')
        .insert({ user_id: user.id, action_id: actionId });

  if (error) return { ok: false, message: toMessage(error, '처리에 실패했어요.') };
  return { ok: true, data: !currentlyLiked };
}

export async function toggleSave(
  supabase: DB,
  actionId: string,
  currentlySaved: boolean,
): Promise<Result<boolean>> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: '로그인이 필요합니다.' };

  const { error } = currentlySaved
    ? await supabase
        .from('saves')
        .delete()
        .eq('user_id', user.id)
        .eq('action_id', actionId)
    : await supabase
        .from('saves')
        .insert({ user_id: user.id, action_id: actionId });

  if (error) return { ok: false, message: toMessage(error, '처리에 실패했어요.') };
  return { ok: true, data: !currentlySaved };
}

export async function toggleFollow(
  supabase: DB,
  targetUserId: string,
  currentlyFollowing: boolean,
): Promise<Result<boolean>> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: '로그인이 필요합니다.' };
  if (user.id === targetUserId)
    return { ok: false, message: '자기 자신은 팔로우할 수 없어요.' };

  const { error } = currentlyFollowing
    ? await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', targetUserId)
    : await supabase
        .from('follows')
        .insert({ follower_id: user.id, following_id: targetUserId });

  if (error) return { ok: false, message: toMessage(error, '처리에 실패했어요.') };
  return { ok: true, data: !currentlyFollowing };
}

// ═════════════════════════════════════════════════════════════
// 공유 · 알림  — 담당: 민호
// ═════════════════════════════════════════════════════════════

/** 회원에게 공유. 대상에게 초대 알림이 만들어진다. */
export async function shareToUser(
  supabase: DB,
  actionId: string,
  targetUserId: string,
): Promise<Result> {
  const { error } = await supabase.rpc('notify_invite', {
    p_action_id: actionId,
    p_target: targetUserId,
  });
  if (error) return { ok: false, message: toMessage(error, '공유에 실패했어요.') };
  return { ok: true, data: undefined };
}

export async function markNotificationRead(
  supabase: DB,
  notificationId: string,
): Promise<Result> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);
  if (error) return { ok: false, message: toMessage(error, '처리에 실패했어요.') };
  return { ok: true, data: undefined };
}
