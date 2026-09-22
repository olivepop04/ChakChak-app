import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { ProfileActionList } from '@/components/my/ProfileActionList';
import { getPublicActionsByOwner } from '@/lib/queries/actions';
import { getProfile } from '@/lib/queries/profiles';
import { createClient } from '@/lib/supabase/server';

export default async function CreatedActionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const viewerId = user?.id ?? null;

  const profile = await getProfile(supabase, id, viewerId);
  if (!profile) notFound();

  const actions = await getPublicActionsByOwner(supabase, id, viewerId);

  return (
    <main className="min-h-screen pb-24">
      <Header
        title="호스트한 액션"
        back
        backHref={`/user/${id}`}
        sticky
      />

      <div className="px-5 py-4">
        <SectionTitle>{actions.length}개</SectionTitle>
        <p className="mt-0.5 text-caption text-neutral-500">
          @{profile.nickname}님이 호스트한 공개 액션
        </p>
      </div>

      <ProfileActionList
        actions={actions}
        emptyText="아직 호스트한 액션이 없어요."
      />
    </main>
  );
}
