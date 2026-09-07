import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getFollowers, getProfile } from '@/lib/queries/profiles';
import { UserList } from '@/components/ui/UserList';
import { EmptyState } from '@/components/ui/EmptyState';
import { Header } from '@/components/layout/Header';

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

      <div className="px-5 py-4">
        <p className="text-[15px] font-bold text-neutral-900">
          {followers.length}명
        </p>
        <p className="mt-0.5 text-[12px] text-neutral-500">
          @{profile.nickname}님을 팔로우하는 사람
        </p>
      </div>

      {followers.length === 0 ? (
        <EmptyState
          icon="👥"
          title="아직 팔로워가 없어요."
          description="액션을 시작하고 새로운 크루를 만나보세요."
          action={{ label: '액션 찾아보기', href: '/discover' }}
        />
      ) : (
        <UserList users={followers} />
      )}
    </main>
  );
}
