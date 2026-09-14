/**
 * 알림 서버 액션.
 *
 * 이 파일이 왜 있나 — 「읽음」은 DB만 바꿔서는 화면에 남지 않습니다.
 *
 * 알림을 누르면 두 가지를 동시에 해야 합니다.
 *   ① DB 에 읽음 표시
 *   ② 액션 화면으로 이동
 *
 * ②를 `router.push` 로 하면 알림 목록 화면이 **클라이언트 라우터 캐시에 그대로 남습니다.**
 * 뒤로 오면 Next 가 그 캐시를 다시 그리므로, 읽음으로 바꿨는데도 안 읽은 모습
 * (노란 배경 · 빨간 점)이 그대로 보입니다. 새로고침해야 비로소 바뀝니다.
 * 2026-09-14 에 이 상태로 보고가 들어왔습니다 (수정 NO9 · 3쪽).
 *
 * `router.refresh()` 를 `push` 바로 앞에 넣는 것으로는 안 됩니다 — 실측했습니다.
 *
 *   refresh 직후 곧바로 push   뒤로 오면 안 읽음 그대로   (이동이 무효화를 중단시킴)
 *   refresh 뒤 600ms 있다가 push   읽음으로 보임          (하지만 누를 때마다 멈칫함)
 *
 * 그래서 무효화를 **이동과 경쟁하지 않는 곳**으로 옮겼습니다. 서버 액션이 돌려주는
 * 응답에 `revalidatePath` 결과가 같이 실려 오므로, `await` 가 끝난 시점에는 이미
 * 캐시가 버려져 있습니다. 그 뒤에 이동하면 순서가 뒤집힐 일이 없습니다.
 *
 * 쓰기 자체는 `lib/mutations.ts` 의 함수를 그대로 씁니다 (CLAUDE.md — 쓰기는 한 곳에서).
 * 여기서 하는 일은 서버 supabase 클라이언트를 만들어 넘기고, 무효화를 붙이는 것뿐입니다.
 */
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { markNotificationRead } from '@/lib/mutations';
import type { Result } from '@/lib/mutations';

export async function markNotificationReadAction(
  notificationId: string,
): Promise<Result> {
  const supabase = await createClient();
  const res = await markNotificationRead(supabase, notificationId);

  // 실패하면 무효화하지 않습니다. 바뀐 것이 없으니 다시 가져올 이유도 없고,
  // 화면은 안 읽은 상태로 남아 있는 것이 맞습니다.
  if (!res.ok) return res;

  revalidatePath('/notifications');
  return res;
}
