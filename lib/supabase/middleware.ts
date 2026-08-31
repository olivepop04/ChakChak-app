/**
 * 세션 갱신 로직.
 *
 * 이게 없으면 서버 컴포넌트가 로그인 상태를 알지 못한다.
 * 그러면 로그인한 사용자가 MY 로 들어갈 때
 * 화면이 한 번 보였다가 로그인으로 튕기는 현상이 난다.
 *
 * supabase.auth.getUser() 를 반드시 호출해야 토큰이 갱신된다.
 * 지우지 말 것.
 */
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/** cookies 옵션이 union 타입이라 추론이 안 된다. 직접 적어 준다. */
type CookieToSet = { name: string; value: string; options: CookieOptions };

/** 로그인해야만 들어갈 수 있는 경로 */
const PROTECTED_PREFIXES = [
  '/action/create',
  '/discover',
  '/activity',
  '/my',
  '/notifications',
  '/user',
];

/**
 * /action/[id] 는 비회원도 열람 가능하지만, 그 하위는 로그인 필요.
 * /action/[id]/result 는 결과 열람이라 공개다. 작성(/result/write)만 막는다.
 */
const PROTECTED_ACTION_SUBPATHS = [
  '/join',
  '/welcome', // You're In! 화면
  '/chat',
  '/crew',
  '/result/write',
  '/voice',
  '/share',
  '/edit',
];

function needsAuth(pathname: string): boolean {
  if (PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) return true;

  const m = pathname.match(/^\/action\/[^/]+(\/.*)$/);
  if (m) {
    return PROTECTED_ACTION_SUBPATHS.some((sub) => m[1].startsWith(sub));
  }
  return false;
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // 이 호출이 토큰을 갱신한다. 조건문으로 감싸지 말 것.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && needsAuth(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    // 로그인 후 원래 가려던 곳으로 돌려보낸다
    url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return response;
}
