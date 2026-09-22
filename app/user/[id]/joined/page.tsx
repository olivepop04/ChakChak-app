import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { ProfileActionList } from '@/components/my/ProfileActionList';
import { getParticipatedActions, getProfile } from '@/lib/queries/profiles';
import { createClient } from '@/lib/supabase/server';

export default async function JoinedActionsPage({
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

  const actions = await getParticipatedActions(supabase, id, viewerId);

  return (
    <main className="min-h-screen pb-24">
      {/* 통계 숫자·프로필 섹션과 같은 이름 (2026-09-11 회의) */}
      <Header
        title="참여 완료 액션"
        back
        backHref={`/user/${id}`}
        sticky
      />

      <div className="px-5 py-4">
        <SectionTitle>{actions.length}개</SectionTitle>
        <p className="mt-0.5 text-caption text-neutral-500">
          @{profile.nickname}님이 소감까지 작성한 액션
        </p>
      </div>

      <ProfileActionList
        actions={actions}
        emptyText="아직 참여 완료한 액션이 없어요."
      />
    </main>
  );
}
