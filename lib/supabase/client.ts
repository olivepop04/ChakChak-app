/**
 * 브라우저(클라이언트 컴포넌트)용 Supabase 클라이언트.
 *
 * 여기서는 ANON_KEY 만 쓴다. ANON_KEY 는 브라우저에 그대로 노출되며,
 * 그래도 안전한 이유는 RLS 정책이 실제 권한을 막아주기 때문이다.
 *
 * SERVICE_ROLE_KEY 를 이 파일에서 쓰면 절대 안 된다.
 */
'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/types/database';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
