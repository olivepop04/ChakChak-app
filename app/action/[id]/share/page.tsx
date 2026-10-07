import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SharePanel } from '@/components/action/SharePanel';
import { Header } from '@/components/layout/Header';

export default async function SharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/action/${id}/share`);

  const { data: action } = await supabase
    .from('actions')
    .select('id, title, status')
    .eq('id', id)
    .maybeSingle();
  if (!action) notFound();

  return (
    <main>
      <Header title="공유하기" back backHref={`/action/${id}`} sticky asH1={false} />

      {/* 위 안내 한 줄 — 공유 모달(ShareModal)과 같은 모양 (2026-10-05) */}
      <div className="flex flex-col gap-1 border-b border-neutral-100 px-6 py-4">
        <p className="text-caption font-medium text-neutral-500">이 액션을 공유해요</p>
        {/* 2026-10-06 디자인 패치 — 공유할 액션명을 초록으로 강조 */}
        <h1 className="line-clamp-2 font-paperlogy text-xl font-bold leading-snug tracking-tight text-brand">
          {action.title}
        </h1>
      </div>

      <SharePanel actionId={id} viewerId={user.id} className="flex flex-col gap-6 px-6 py-5" />
    </main>
  );
}
