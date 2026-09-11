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
import { LIMITS, UPLOAD, type NotificationType } from '@/lib/constants';
import { getBioValidationError } from '@/lib/utils/profile-validation';

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
// 액션 초안 저장  — 담당: 개발 B
// ═════════════════════════════════════════════════════════════

export interface ActionDraftInput {
  title: string;
  description?: string | null;
  /** 대표 카테고리. categories 를 주면 안 줘도 됩니다 */
  category: string;
  /** 카테고리 1~3개 (14). 첫 번째가 대표가 됩니다 */
  categories?: string[];
  imageUrls?: string[];
  thumbnailIndex?: number;
  /** 주소 검색으로 고른 값. 예) 서울특별시 강동구 … */
  address?: string | null;
  /** 호스트가 직접 적는 장소 이름. 예) 신라목욕탕 */
  placeName?: string | null;
  notice?: string | null;
  recruitEndAt?: string | null;
  activityStartAt?: string | null;
  activityEndAt?: string | null;
}

/**
 * 액션 초안 저장. 없으면 만들고(DRAFT), 있으면 덮어씁니다.
 *
 * ★ 화면에서 actions 를 직접 insert/update 하지 마세요.
 *
 * 두 가지를 대신 처리합니다.
 *
 *  1. 날짜 앞뒤 검사 (F14)
 *     DB 에도 같은 규칙이 있지만, DB 가 거절하면 영어 메시지만 나옵니다.
 *     여기서 먼저 걸러서 한국어로 알려줍니다.
 *
 *  2. 장소명(place_name) 같은 새 컬럼을 빠뜨리지 않게
 *
 * 제목만 채워도 저장됩니다. 자동 임시저장(F30·F33)에 쓰세요 —
 * 액션이 먼저 만들어져야 사진 업로드 칸이 열립니다.
 *
 * 공개된 액션은 소개·안내사항만 바뀝니다. 나머지를 건드리면
 * DB 트리거가 한국어 메시지로 거절합니다 (F41).
 */
export async function saveActionDraft(
  supabase: DB,
  input: ActionDraftInput,
  actionId?: string | null,
): Promise<Result<string>> {
  const title = input.title.trim();
  if (!title) return { ok: false, message: '제목을 입력해주세요.' };

  const recruitEnd = input.recruitEndAt ?? null;
  const start = input.activityStartAt ?? null;
  const end = input.activityEndAt ?? null;

  // 날짜 앞뒤가 맞는지 (F14)
  if (start && end && new Date(start) >= new Date(end)) {
    return {
      ok: false,
      message:
        '활동 종료는 활동 시작보다 뒤여야 해요. 종료 시각을 다시 확인해주세요.',
    };
  }
  if (recruitEnd && start && new Date(recruitEnd) > new Date(start)) {
    return {
      ok: false,
      message:
        '모집 마감은 활동 시작보다 앞서야 해요. 마감일을 활동 시작일 이전으로 바꿔주세요.',
    };
  }

  const images = input.imageUrls ?? [];
  const payload = {
    title,
    description: input.description?.trim() || null,
    category: input.category,
    // categories 를 주면 그걸 쓰고, 안 주면 대표 하나만 넣습니다.
    // DB 트리거가 category 를 categories[0] 으로 맞춰줍니다 (14).
    categories: input.categories?.length
      ? input.categories
      : [input.category],
    image_urls: images,
    thumbnail_index: Math.min(
      input.thumbnailIndex ?? 0,
      Math.max(images.length - 1, 0),
    ),
    address: input.address?.trim() || null,
    place_name: input.placeName?.trim() || null,
    notice: input.notice?.trim() || null,
    recruit_end_at: recruitEnd,
    activity_start_at: start,
    activity_end_at: end,
  };

  if (actionId) {
    const { error } = await supabase
      .from('actions')
      .update(payload)
      .eq('id', actionId);
    if (error)
      return { ok: false, message: toMessage(error, '저장에 실패했어요.') };
    return { ok: true, data: actionId };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: '로그인이 필요해요.' };

  const { data, error } = await supabase
    .from('actions')
    .insert({ ...payload, owner_id: user.id, status: 'DRAFT' })
    .select('id')
    .single();

  if (error || !data)
    return { ok: false, message: toMessage(error, '저장에 실패했어요.') };
  return { ok: true, data: data.id };
}

/**
 * 공개한 액션의 소개·안내사항만 고칩니다 (F41).
 *
 * ★ 공개된 액션에는 saveActionDraft() 를 쓰지 마세요.
 *
 *   saveActionDraft 는 제목·날짜·장소까지 전부 보냅니다. 그런데 DB 트리거가
 *   "공개 뒤에는 소개·안내만" 을 강제하면서 값이 하나라도 다르면 거절합니다.
 *   화면의 날짜 입력칸(datetime-local)은 초를 버리기 때문에, 저장된 값을
 *   읽어서 그대로 되돌려 보내도 밀리초가 달라 막힙니다.
 *
 *   이 함수는 소개·안내 두 칸만 보내므로 그 문제가 없습니다.
 *
 * 작성 중(DRAFT)인 액션은 saveActionDraft() 로 무엇이든 고칠 수 있습니다.
 */
export async function updateActionText(
  supabase: DB,
  actionId: string,
  input: { description?: string | null; notice?: string | null },
): Promise<Result> {
  const patch: Database['public']['Tables']['actions']['Update'] = {};
  if (input.description !== undefined)
    patch.description = input.description?.trim() || null;
  if (input.notice !== undefined) patch.notice = input.notice?.trim() || null;

  if (Object.keys(patch).length === 0) return { ok: true, data: undefined };

  const { error } = await supabase
    .from('actions')
    .update(patch)
    .eq('id', actionId);
  if (error) return { ok: false, message: toMessage(error, '저장에 실패했어요.') };
  return { ok: true, data: undefined };
}

export interface ActionResultInput {
  content?: string | null;
  /** 결과 사진. 최소 1장 필수 */
  imageUrls: string[];
  /** 호스트가 남기는 한마디 */
  ownerVoice?: string | null;
}

/**
 * 결과 저장 (있으면 덮어씁니다).
 *
 * ★ 저장한 다음에 completeAction() 을 부르세요. 순서를 바꾸면
 *   "결과를 먼저 작성해주세요" 로 거절됩니다.
 *
 * 사진 최소 1장은 DB CHECK 로도 막혀 있지만, 여기서 먼저 걸러
 * 한국어로 알려줍니다.
 */
export async function saveActionResult(
  supabase: DB,
  actionId: string,
  input: ActionResultInput,
): Promise<Result> {
  if (input.imageUrls.length < UPLOAD.RESULT_IMAGE_MIN)
    return {
      ok: false,
      message: `결과 사진을 최소 ${UPLOAD.RESULT_IMAGE_MIN}장 올려주세요. 활동을 보여주는 사진이 있어야 크루들이 결과를 확인할 수 있어요.`,
    };
  if (input.imageUrls.length > UPLOAD.RESULT_IMAGE_MAX)
    return {
      ok: false,
      message: `결과 사진은 최대 ${UPLOAD.RESULT_IMAGE_MAX}장까지 올릴 수 있어요.`,
    };

  const { error } = await supabase.from('action_results').upsert(
    {
      action_id: actionId,
      content: input.content?.trim() || null,
      image_urls: input.imageUrls,
      owner_voice: input.ownerVoice?.trim() || null,
    },
    { onConflict: 'action_id' },
  );
  if (error)
    return { ok: false, message: toMessage(error, '결과 저장에 실패했어요.') };
  return { ok: true, data: undefined };
}

// ═════════════════════════════════════════════════════════════
// 프로필 · 알림 설정  — 담당: 개발 A
// ═════════════════════════════════════════════════════════════

/** 닉네임이 이미 쓰이고 있는가. 본인 것은 제외한다 */
export async function isNicknameTaken(
  supabase: DB,
  nickname: string,
  exceptUserId?: string,
): Promise<boolean> {
  let q = supabase.from('profiles').select('id').eq('nickname', nickname.trim());
  if (exceptUserId) q = q.neq('id', exceptUserId);
  const { data } = await q.maybeSingle();
  return !!data;
}

export interface ProfileInput {
  nickname?: string;
  bio?: string | null;
  categories?: string[];
  regions?: string[];
  /** 참여 가능 시간 2단계 (F38). [{ day: '평일', slots: ['오전'] }] */
  timePrefs?: { day: string; slots: string[] }[];
  /**
   * 나눌 수 있는 재능 (10). `SKILLS` 목록에서 고른 값만 넣으세요.
   *
   *   넘기지 않음  이번에 안 건드림
   *   null         "아직 잘 모르겠음" — 나중에 다시 물어봅니다
   *   []           "재능 없음"        — 다시 묻지 않습니다
   *
   * 둘을 섞으면 재능 없는 사람에게 AI 가 계속 재능을 묻습니다.
   */
  skills?: string[] | null;
}

/**
 * 프로필 저장 (가입 3단계 · 프로필 수정 공용).
 *
 * ★ 화면에서 profiles 를 직접 update 하지 마세요.
 *
 * timePrefs 를 넘기면 예전 available_times 도 함께 채웁니다.
 * 추천 점수(lib/utils/scoring.ts)가 아직 옛 컬럼을 보고 있어서,
 * 둘 중 하나만 채우면 추천이 조용히 어긋납니다.
 * scoring.ts 를 time_prefs 로 옮긴 뒤에 이 변환을 지우세요.
 */
export async function updateProfile(
  supabase: DB,
  userId: string,
  input: ProfileInput,
): Promise<Result> {
  // 생성된 Update 타입을 그대로 씁니다.
  // Record<string, unknown> 로 두면 supabase-js 가 "정의되지 않은 컬럼"으로 보고 거절합니다.
  const patch: Database['public']['Tables']['profiles']['Update'] = {};

  if (input.nickname !== undefined) {
    const nick = input.nickname.trim();
    if (nick.length < LIMITS.NICKNAME_MIN || nick.length > LIMITS.NICKNAME_MAX)
      return {
        ok: false,
        message: `닉네임은 ${LIMITS.NICKNAME_MIN}~${LIMITS.NICKNAME_MAX}자로 입력해주세요.`,
      };
    if (await isNicknameTaken(supabase, nick, userId))
      return { ok: false, message: '이미 사용 중인 닉네임이에요.' };
    patch.nickname = nick;
  }

  if (input.bio !== undefined) {
    const bioError = getBioValidationError(input.bio);
    if (bioError) return { ok: false, message: bioError };
    patch.bio = input.bio?.trim() || null;
  }
  if (input.categories !== undefined) patch.categories = input.categories;
  if (input.regions !== undefined) patch.regions = input.regions;

  // 재능 (10). null 과 빈 배열이 다릅니다.
  //   undefined  이번에 안 건드림 → 컬럼을 그대로 둡니다
  //   null       "아직 모르겠음"  → 나중에 다시 물어봅니다
  //   []         "재능 없음"      → 다시 묻지 않습니다
  // ?? [] 같은 걸 쓰면 이 구분이 사라집니다.
  if (input.skills !== undefined) patch.skills = input.skills;

  if (input.timePrefs !== undefined) {
    patch.time_prefs = input.timePrefs;
    // 옛 컬럼도 같이 채운다 (추천 점수가 아직 이걸 본다)
    const flat = new Set<string>();
    for (const p of input.timePrefs) {
      if (p.day && p.day !== '상관없음') flat.add(p.day);
      for (const s of p.slots) if (s && s !== '상관없음') flat.add(s);
    }
    patch.available_times = [...flat];
  }

  if (Object.keys(patch).length === 0) return { ok: true, data: undefined };

  const { error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId);
  if (error) return { ok: false, message: toMessage(error, '저장에 실패했어요.') };
  return { ok: true, data: undefined };
}

/**
 * 알림 켜고 끄기 (F25).
 *
 * 끈 종류만 넘기세요. 빈 배열이면 전부 받습니다.
 * 껐다고 표시된 알림은 DB 트리거가 아예 만들지 않습니다.
 */
export async function updateNotifySettings(
  supabase: DB,
  userId: string,
  turnedOff: NotificationType[],
): Promise<Result> {
  const { error } = await supabase
    .from('profiles')
    .update({ notify_off: turnedOff })
    .eq('id', userId);
  if (error)
    return {
      ok: false,
      message: toMessage(error, '알림 설정을 저장하지 못했어요.'),
    };
  return { ok: true, data: undefined };
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

// 사유 없이 나가는 leaveAction() 은 뺐습니다 (2026-09-11).
//
// 그 함수는 participations 를 LEFT 로 바꾸기만 해서,
// 크루챗에 사유도 안 남고 **호스트에게 알림도 가지 않았습니다.**
// 호스트는 크루가 빠진 것을 모른 채 모집 현황만 줄어드는 것을 보게 됩니다.
//
// 나가기는 아래 leaveActionWithReason() 하나로만 하세요.
// DB 의 leave_action RPC 는 시간 검사 테스트(verify:db)가 쓰고 있어 남겨둡니다.

/**
 * 사유를 남기고 나가기 (2026-09-01 개편 · F40)
 *
 * 한 번 부르면 세 가지가 한꺼번에 일어난다. 중간에 실패하면 전부 되돌아간다.
 *
 *   ① 사유를 게시판에 올린다   (아직 크루라서 권한이 있다)
 *   ② 참여 상태를 LEFT 로
 *   ③ 호스트에게 알림          (사유가 함께 전달된다)
 *
 * ★ 화면에서 이 세 가지를 나눠 부르지 마세요.
 *   나가고 나면 게시판에 글 쓸 권한이 사라져서, 순서가 틀어지면 글이 안 올라갑니다.
 *
 * 사유는 5자 이상 1000자 이하. 서버가 검사하고 한국어 메시지를 돌려줍니다.
 * 한 번 올린 사유는 본인도 지울 수 없으니, 보내기 전에 확인 창을 띄워주세요.
 */
export async function leaveActionWithReason(
  supabase: DB,
  actionId: string,
  reason: string,
): Promise<Result> {
  const { error } = await supabase.rpc('leave_action_with_reason', {
    p_action_id: actionId,
    p_reason: reason,
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

/**
 * 취소. 사유 5자 이상. 참여자 전원에게 알림이 간다.
 *
 * **활동 시작 전까지만** 됩니다 (12). 활동이 시작됐으면 취소가 아니라
 * `endActionEarly()` 입니다 — 활동을 했으니 없던 일로 만들면 안 됩니다.
 */
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

/**
 * 조기 종료. **활동 중에만** 됩니다. 사유 5자 이상 (12).
 *
 * 취소와 다릅니다 — 활동은 실제로 있었으므로 액션이 사라지지 않고
 * `ENDED` 가 됩니다. 그래서 "내가 만든 액션" 에 계속 세어지고,
 * 크루는 소감을 쓰면 참여 완료가 됩니다. 예정 종료와 흐름이 같습니다.
 *
 * 사유는 크루챗에 공지로 남고 **아무도 지울 수 없습니다.**
 */
export async function endActionEarly(
  supabase: DB,
  actionId: string,
  reason: string,
): Promise<Result> {
  const { error } = await supabase.rpc('end_action_early', {
    p_action_id: actionId,
    p_reason: reason,
  });
  if (error)
    return { ok: false, message: toMessage(error, '활동 종료에 실패했어요.') };
  return { ok: true, data: undefined };
}

export interface ActionItemInput {
  type: 'PERSON' | 'GOODS';
  name: string;
  /** RANGE = 정해진 인원(min~max), MINIMUM = 최소 인원만(max 없음) */
  targetType: 'RANGE' | 'MINIMUM';
  minRequired: number;
  /** RANGE 면 필수, MINIMUM 이면 넣지 말 것 */
  maxAllowed?: number | null;
  /** 물품은 '통','개' 등. 사람은 자동으로 '명' */
  unit?: string;
  genderRequirement?: 'MALE' | 'FEMALE' | 'ANY';
  conditionName?: string | null;
  conditionDesc?: string | null;
}

/**
 * 모집 항목 저장 (기존 항목을 지우고 새로 씁니다).
 *
 * ★ action_items 를 직접 .insert() 하지 마세요.
 *
 * PostgREST 는 여러 행을 한 번에 넣을 때 컬럼 목록을 하나로 합칩니다.
 * 그래서 어떤 행에만 없는 키는 "생략" 이 아니라 명시적 NULL 로 전송되고,
 * DB 의 DEFAULT 값이 적용되지 않아 NOT NULL 위반으로 실패합니다.
 * (실제로 gender_requirement 에서 이 문제가 났습니다)
 *
 * 이 함수는 모든 컬럼을 빠짐없이 채워서 그 문제를 막습니다.
 */
export async function saveActionItems(
  supabase: DB,
  actionId: string,
  items: ActionItemInput[],
): Promise<Result> {
  if (items.length === 0)
    return { ok: false, message: '모집 항목을 하나 이상 추가해주세요.' };

  for (const it of items) {
    if (it.targetType === 'RANGE' && (it.maxAllowed ?? null) === null)
      return { ok: false, message: `「${it.name}」의 최대 인원을 입력해주세요.` };
    if (it.targetType === 'RANGE' && (it.maxAllowed as number) < it.minRequired)
      return { ok: false, message: `「${it.name}」의 최대 인원이 최소보다 작습니다.` };
  }

  await supabase.from('action_items').delete().eq('action_id', actionId);

  // 모든 컬럼을 명시적으로 채운다 (위 주석 참고)
  const rows = items.map((it, i) => ({
    action_id: actionId,
    type: it.type,
    name: it.name,
    target_type: it.targetType,
    min_required: it.minRequired,
    max_allowed: it.targetType === 'MINIMUM' ? null : (it.maxAllowed ?? null),
    unit: it.type === 'PERSON' ? '명' : (it.unit || '개'),
    gender_requirement:
      it.type === 'GOODS' ? 'ANY' : (it.genderRequirement ?? 'ANY'),
    condition_name: it.conditionName ?? null,
    condition_desc: it.conditionDesc ?? null,
    sort_order: i,
  }));

  const { error } = await supabase.from('action_items').insert(rows);
  if (error)
    return { ok: false, message: toMessage(error, '모집 항목 저장에 실패했어요.') };
  return { ok: true, data: undefined };
}

/**
 * 공개된 액션에 모집 항목을 **추가만** 합니다 (B8).
 *
 * ★ 공개된 액션에 `saveActionItems()` 를 쓰지 마세요.
 *   그 함수는 "전부 지우고 다시 넣기" 방식이라, 이미 참여한 크루들의
 *   항목 선택이 한 번에 사라집니다 (participation_items 가 CASCADE 입니다).
 *   DB 트리거(supabase/10)가 막아주지만, 애초에 이 함수를 쓰세요.
 *
 * 기존 항목은 고치거나 지울 수 없습니다. 이미 신청한 사람이 있으니까요.
 */
export async function addActionItems(
  supabase: DB,
  actionId: string,
  items: ActionItemInput[],
): Promise<Result> {
  if (items.length === 0)
    return { ok: false, message: '추가할 모집 항목을 하나 이상 입력해주세요.' };

  for (const it of items) {
    if (!it.name.trim())
      return { ok: false, message: '모집 항목의 이름을 입력해주세요.' };
    if (it.targetType === 'RANGE' && (it.maxAllowed ?? null) === null)
      return { ok: false, message: `「${it.name}」의 최대 인원을 입력해주세요.` };
    if (it.targetType === 'RANGE' && (it.maxAllowed as number) < it.minRequired)
      return { ok: false, message: `「${it.name}」의 최대 인원이 최소보다 작습니다.` };
  }

  // 새 항목이 기존 항목 뒤에 오도록 sort_order 를 이어 붙입니다
  const { data: last } = await supabase
    .from('action_items')
    .select('sort_order')
    .eq('action_id', actionId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const base = (last?.sort_order ?? -1) + 1;

  // 여러 행을 한 번에 넣을 때는 모든 컬럼을 빠짐없이 채웁니다 (CLAUDE.md 8번)
  const rows = items.map((it, i) => ({
    action_id: actionId,
    type: it.type,
    name: it.name.trim(),
    target_type: it.targetType,
    min_required: it.minRequired,
    max_allowed: it.targetType === 'MINIMUM' ? null : (it.maxAllowed ?? null),
    unit: it.type === 'PERSON' ? '명' : (it.unit || '개'),
    gender_requirement:
      it.type === 'GOODS' ? 'ANY' : (it.genderRequirement ?? 'ANY'),
    condition_name: it.conditionName ?? null,
    condition_desc: it.conditionDesc ?? null,
    sort_order: base + i,
  }));

  const { error } = await supabase.from('action_items').insert(rows);
  if (error)
    return { ok: false, message: toMessage(error, '모집 항목 추가에 실패했어요.') };
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
