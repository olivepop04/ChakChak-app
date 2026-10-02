/**
 * 관리자 — 문의·건의 모아보기 (2026-10-02).
 *
 * 관리자가 아니면 404 를 냅니다. 「권한이 없어요」 대신 404 인 것은
 * 이런 화면이 있다는 것 자체를 알리지 않기 위해서입니다.
 *
 * 진짜로 막는 곳은 DB 입니다(supabase/22 · feedback 의 SELECT 정책 = is_admin()).
 * 이 화면의 검사를 지워도 관리자가 아니면 빈 목록만 옵니다.
 *
 * 관리자 지정은 SQL 편집기에서 admins 표에 넣습니다 — 22_update.sql 맨 아래 예시.
 */
import { notFound, redirect } from 'next/navigation';
import { MessageSquareText } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getFeedbackForAdmin, isAdmin } from '@/lib/queries/feedback';
import { Header } from '@/components/layout/Header';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { formatDate, formatTime } from '@/lib/utils/date';
import { FEEDBACK_CATEGORY_LABEL } from '@/lib/utils/feedback';

export const dynamic = 'force-dynamic';

export default async function AdminFeedbackPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/admin/feedback');

  if (!(await isAdmin(supabase))) notFound();

  const items = await getFeedbackForAdmin(supabase);

  return (
    <main className="min-h-screen pb-28">
      <Header title="문의·건의" back backHref="/my" sticky />

      <div className="px-6 py-4">
        <SectionTitle>{items.length}건</SectionTitle>
        <p className="mt-0.5 text-label text-neutral-500">새로 온 것부터 보여요 (최근 200건)</p>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={MessageSquareText} title="아직 받은 의견이 없어요" />
      ) : (
        <ul className="flex flex-col gap-3 px-6">
          {items.map((item) => (
            <li key={item.id} className="rounded-xl border border-hairline p-4">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-caption font-semibold text-brand">
                  {FEEDBACK_CATEGORY_LABEL[item.category]}
                </span>
                <span className="ml-auto text-caption text-neutral-400">
                  {formatDate(item.createdAt)} {formatTime(item.createdAt)}
                </span>
              </div>

              <p className="mt-3 whitespace-pre-wrap break-words text-body leading-relaxed text-neutral-800">
                {item.body}
              </p>

              <div className="mt-3 flex items-center gap-2 text-label text-neutral-500">
                {item.author ? (
                  <>
                    <Avatar name={item.author.nickname} avatar={item.author.avatar} size="sm" />
                    <span>@{item.author.nickname}</span>
                  </>
                ) : (
                  // 프로필을 지우면 글도 같이 지워지므로(ON DELETE CASCADE) 보통은 오지 않습니다
                  <span>알 수 없는 사용자</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
