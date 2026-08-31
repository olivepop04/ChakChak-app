import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getFollowing, getProfile } from '@/lib/queries/profiles';
import { UserList } from '@/components/ui/UserList';
import { EmptyState } from '@/components/ui/EmptyState';
import { Header } from '@/components/layout/Header';

export default async function FollowingPage({
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

  const following = await getFollowing(supabase, id, user?.id ?? null);

  return (
    <main className="pb-24">
      <Header title="팔로잉" back backHref={`/user/${id}`} sticky />

      <div className="px-5 py-4">
        <p className="text-[15px] font-bold text-neutral-900">
          {following.length}명
        </p>
        <p className="mt-0.5 text-[12px] text-neutral-500">
          관심 있는 사람들의 새로운 액션을 만나보세요.
        </p>
      </div>

      {following.length === 0 ? (
        <EmptyState
          icon="👋"
          title="아직 팔로우한 사람이 없어요"
          description="액션 상세에서 리더를 팔로우해보세요."
          action={{ label: '액션 찾아보기', href: '/discover' }}
        />
      ) : (
        <UserList users={following} />
      )}
    </main>
  );
}
