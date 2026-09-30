/**
 * 시간 조건으로 만들어지는 알림 2종.
 *
 * 나머지 4종(결과 작성 요청 · 결과 공개 · 취소 · 초대)은 상태가 바뀌는 순간
 * DB 함수 안에서 만들어집니다. 그런데 아래 둘은 "그냥 시간이 지나면" 생겨야 해서
 * 만들어 줄 사람이 없습니다.
 *
 *   SCHEDULE       활동 하루 전
 *   VOICE_REQUEST  결과 공개 후 5일이 지났는데 소감을 안 씀
 *
 * 정해진 시간에 도는 서버(크론)를 두지 않기 위해,
 * 사용자가 알림 화면을 열 때 조건을 확인해서 만듭니다(lazy 방식).
 *
 * event_key 가 UNIQUE 라서 여러 번 호출해도 같은 알림이 두 번 쌓이지 않습니다.
 *
 * ★ 서버에서만 부르세요. 알림은 "남에게" 만들어 주는 것이라 RLS 로는 넣을 수 없어
 *   Service Role 로 씁니다.
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/server';

export async function syncLazyNotifications(userId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const now = new Date();
    const rows: {
      user_id: string;
      type: string;
      action_id: string;
      event_key: string;
    }[] = [];

    // 내가 참여 중인 액션들
    const { data: parts } = await admin
      .from('participations')
      .select('action_id, status')
      .eq('user_id', userId)
      .neq('status', 'LEFT');

    if (!parts || parts.length === 0) return;

    const ids = parts.map((p) => p.action_id);
    const statusById = new Map(parts.map((p) => [p.action_id, p.status]));

    const { data: actions } = await admin
      .from('actions')
      .select('id, status, activity_start_at, activity_end_at')
      .in('id', ids);

    // 이미 소감을 쓴 액션은 제외해야 하므로 미리 조회
    const { data: voices } = await admin
      .from('crew_voices')
      .select('action_id')
      .eq('user_id', userId)
      .in('action_id', ids);
    const wroteVoice = new Set((voices ?? []).map((v) => v.action_id));

    const oneDay = 24 * 60 * 60 * 1000;
    const fiveDays = 5 * oneDay;

    for (const a of actions ?? []) {
      const myStatus = statusById.get(a.id);

      // 1) 활동 하루 전 — 아직 활동 전인 사람에게
      if (
        a.status === 'ACTIVE' &&
        myStatus === 'BEFORE_ACTION' &&
        a.activity_start_at
      ) {
        const start = new Date(a.activity_start_at).getTime();
        const diff = start - now.getTime();
        if (diff > 0 && diff <= oneDay) {
          rows.push({
            user_id: userId,
            type: 'SCHEDULE',
            action_id: a.id,
            event_key: `SCHEDULE:${a.id}:${userId}`,
          });
        }
      }

      // 2) 결과 공개 후 5일 — 소감을 아직 안 쓴 사람에게
      if (
        a.status === 'COMPLETED' &&
        myStatus === 'AFTER_ACTION' &&
        !wroteVoice.has(a.id) &&
        a.activity_end_at
      ) {
        const ended = new Date(a.activity_end_at).getTime();
        if (now.getTime() - ended >= fiveDays) {
          rows.push({
            user_id: userId,
            type: 'VOICE_REQUEST',
            action_id: a.id,
            event_key: `VOICE_REQUEST:${a.id}:${userId}`,
          });
        }
      }
    }

    if (rows.length === 0) return;

    // event_key 가 UNIQUE 라서 이미 있으면 무시됩니다
    await admin
      .from('notifications')
      .upsert(rows, { onConflict: 'event_key', ignoreDuplicates: true });
  } catch {
    // 알림 생성 실패가 알림 화면 자체를 막으면 안 됩니다.
    // (예: SERVICE_ROLE_KEY 미설정)
  }
}

/**
 * 모집 미달 알림 (F37) — 호스트에게.
 *
 * 모집 마감 시각이 지났는데 최소 인원/수량을 못 채운 액션이 있으면 알려줍니다.
 * 팀 합의대로 **자동으로 취소하지 않습니다.** 호스트가 보고 직접 정합니다.
 *
 *   그대로 진행 → 아무것도 안 하면 됩니다
 *   취소       → cancelAction() 을 부릅니다
 *
 * 위 syncLazyNotifications 는 "내가 참여한" 액션을 보지만
 * 이건 "내가 만든" 액션을 봅니다. 그래서 함수를 따로 뒀습니다.
 *
 * 지금 부르는 곳: app/notifications/page.tsx (민호)
 * 부르면 좋은 곳: app/activity/page.tsx 의 "내가 만든" 탭 (조장 · F37)
 *   호스트가 알림 화면을 안 열고 Activity 만 봐도 미달 상황을 알 수 있습니다.
 *   조장님이 F37 화면을 만들 때 추가해주세요.
 *
 * ★ 서버에서만 부르세요.
 */
export async function syncHostNotifications(userId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const nowIso = new Date().toISOString();

    // 내가 만든 ACTIVE 액션 중 모집 마감이 지났고, 아직 활동이 시작되지 않은 것.
    // 이 알림은 「진행할지 취소할지 정하라」 는 것인데 취소는 시작 전에만 됩니다(규칙 12).
    // 시작 뒤에도 만들면 누를 수 없는 결정을 요구하게 됩니다 (2026-09-30).
    const { data: actions } = await admin
      .from('actions')
      .select('id')
      .eq('owner_id', userId)
      .eq('status', 'ACTIVE')
      .not('recruit_end_at', 'is', null)
      .lt('recruit_end_at', nowIso)
      .gt('activity_start_at', nowIso);

    if (!actions || actions.length === 0) return;
    const ids = actions.map((a) => a.id);

    // 진행률은 뷰에서 읽습니다. 직접 합산하지 마세요.
    const { data: progress } = await admin
      .from('action_item_progress')
      .select('action_id, is_min_met')
      .in('action_id', ids);

    // 항목이 하나라도 최소를 못 채웠으면 미달로 봅니다
    const short = new Set<string>();
    for (const row of progress ?? []) {
      if (row.action_id && row.is_min_met === false) short.add(row.action_id);
    }
    if (short.size === 0) return;

    await admin.from('notifications').upsert(
      [...short].map((actionId) => ({
        user_id: userId,
        type: 'SHORTFALL',
        action_id: actionId,
        event_key: `SHORTFALL:${actionId}`,
      })),
      { onConflict: 'event_key', ignoreDuplicates: true },
    );
  } catch {
    // 실패해도 화면은 떠야 합니다
  }
}
