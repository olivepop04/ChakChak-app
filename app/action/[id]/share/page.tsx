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
      <Header title="공유하기" back backHref={`/action/${id}`} sticky />

      <div className="border-b border-neutral-100 px-6 py-4">
        <h1 className="line-clamp-2 text-subtitle font-bold leading-snug text-neutral-900">
          {action.title}
        </h1>
      </div>

      <SharePanel actionId={id} viewerId={user.id} />
    </main>
  );
}
