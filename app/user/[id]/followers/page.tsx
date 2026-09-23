import { notFound } from 'next/navigation';
import { UserRoundX } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getFollowers, getProfile } from '@/lib/queries/profiles';
import { UserList } from '@/components/ui/UserList';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Header } from '@/components/layout/Header';
import { shouldShowFollowEmptyHint } from '@/lib/utils/profile-display';

export default async function FollowersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = await getProfile(supabase, id, user?.id ?? null);
  if (!profile) notFound();

  const followers = await getFollowers(supabase, id, user?.id ?? null);

  return (
    <main className="pb-24">
      <Header title="팔로워" back backHref={`/user/${id}`} sticky />

      <div className="px-6 py-4">
        <SectionTitle>{followers.length}명</SectionTitle>
        <p className="mt-0.5 text-caption text-neutral-500">
          @{profile.nickname}님을 팔로우하는 사람
        </p>
      </div>

      {followers.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <UserRoundX className="h-12 w-12 text-neutral-400 stroke-[1.5]" />
          <p className="mt-3 text-base font-bold text-neutral-900">
            아직 팔로워가 없어요
          </p>
          {shouldShowFollowEmptyHint(user?.id, id) && (
            <p className="mt-1.5 text-label leading-relaxed text-neutral-500 break-keep">
              함께한 크루들을 팔로우하고 소감을 나눠보세요.
              <br />
              자연스럽게 내 팔로워도 늘어나요.
            </p>
          )}
        </div>
      ) : (
        <UserList users={followers} />
      )}
    </main>
  );
}
