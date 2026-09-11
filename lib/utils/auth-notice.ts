/**
 * 로그인 화면 맨 위에 띄우는 "왜 로그인 화면이 떴는지" 한 줄 (2026-09-11 회의).
 *
 * middleware 가 보호 화면 접근을 막을 때 `/login?next=…` 로 보냅니다.
 * 그런데 이유를 알려주지 않으면, 남의 프로필을 눌렀던 사람은
 * 앱이 고장난 것처럼 느낍니다. 아무 설명 없이 로그인 화면이 떠 버리니까요.
 *
 * next 경로를 보고 문구 하나를 고릅니다. 모르는 경로면 `null` —
 * 그때는 아무것도 띄우지 않습니다. 억지로 문구를 만들지 마세요.
 *
 * ⚠️ 여기 목록은 `lib/supabase/middleware.ts` 의 보호 경로와 짝입니다.
 *    거기에 경로를 더하면 여기에도 한 줄 더해주세요. 안 더해도 화면은 안 깨지고,
 *    안내만 안 나옵니다.
 */

/** 앞에서부터 먼저 걸리는 것이 이깁니다. 좁은 경로를 위에 두세요. */
const NOTICES: ReadonlyArray<{ path: string; message: string }> = [
  // 액션 만들기는 `/action/` 하위 규칙보다 먼저 걸러야 합니다.
  { path: '/action/create', message: '액션 만들기는 로그인 후 이용할 수 있어요.' },
  { path: '/user', message: '프로필 확인은 로그인 후 가능합니다.' },
  { path: '/my', message: '내 프로필은 로그인 후 볼 수 있어요.' },
  { path: '/activity', message: '내 활동은 로그인 후 볼 수 있어요.' },
  { path: '/notifications', message: '알림은 로그인 후 볼 수 있어요.' },
];

/** `/action/{id}/…` 의 보호되는 하위 화면. middleware 와 같은 목록입니다. */
const ACTION_SUBPATHS = [
  '/join',
  '/welcome',
  '/chat',
  '/crew',
  '/result/write',
  '/voice',
  '/share',
  '/edit',
];

/** `/my` 가 `/mypage` 까지 잡지 않도록, 정확히 같거나 그 아래일 때만 맞다고 봅니다. */
function isUnder(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function getLoginNotice(next: string): string | null {
  for (const { path, message } of NOTICES) {
    if (isUnder(next, path)) return message;
  }

  // `/action/{id}/join` 처럼 액션 하위 화면이면 한 문구로 묶어서 안내합니다.
  const actionSub = next.match(/^\/action\/[^/]+(\/.*)$/);
  if (actionSub && ACTION_SUBPATHS.some((sub) => actionSub[1].startsWith(sub))) {
    return '이 화면은 로그인 후 이용할 수 있어요.';
  }

  return null;
}
