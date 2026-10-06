/**
 * 문의·건의하기 (2026-10-02).
 *
 * 로그인한 사람이 운영진에게 문의·건의·오류 신고를 보냅니다.
 * 보낸 글은 관리자만 읽습니다 — 보낸 사람도 다시 볼 수 없습니다(이번 범위).
 * 저장·권한은 supabase/22 와 lib/mutations.ts 의 submitFeedback() 이 맡습니다.
 *
 * /my 아래라 로그인은 미들웨어가 먼저 확인합니다(lib/supabase/middleware.ts).
 */
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { FeedbackForm } from './FeedbackForm';

export default async function FeedbackPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/my/feedback');

  return (
    <main className="pb-28">
      <Header title="문의·건의하기" back backHref="/my" sticky />
      <FeedbackForm />
    </main>
  );
}
