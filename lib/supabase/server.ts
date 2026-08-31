/**
 * 서버(서버 컴포넌트 / API Route)용 Supabase 클라이언트.
 *
 * createClient()  — 로그인한 사용자의 세션으로 동작한다. RLS 가 적용된다.
 *                   일반 기능(액션 CRUD, 참여, 채팅, 프로필)은 전부 이걸 쓴다.
 *
 * createAdminClient() — RLS 를 우회한다. 꼭 필요한 곳에서만.
 *                   현재 필요한 곳은 사실상 없다. 알림 생성도
 *                   SECURITY DEFINER 함수(03_functions.sql)가 처리한다.
 *                   쓸 일이 생기면 왜 필요한지 주석으로 남길 것.
 *
 * 주의: Next.js 15 에서 cookies() 는 Promise 다. await 가 필요하다.
 */
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createRawClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/types/database';

/**
 * @supabase/ssr 의 cookies 옵션은 신·구 두 방식의 union 이라
 * 객체 리터럴만으로는 타입 추론이 되지 않는다. 그래서 직접 적어 준다.
 */
type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // 서버 컴포넌트에서는 쿠키를 쓸 수 없다.
            // 세션 갱신은 middleware.ts 가 담당하므로 무시해도 된다.
          }
        },
      },
    },
  );
}

/** 로그인한 사용자를 가져온다. 없으면 null. */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** 로그인 + 프로필을 함께 가져온다. */
export async function getSessionProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return { user, profile };
}

/** RLS 우회. 서버에서만, 꼭 필요할 때만. */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았습니다.');
  }
  return createRawClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
