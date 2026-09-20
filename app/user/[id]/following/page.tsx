import { notFound } from 'next/navigation';
import { UserRoundX } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getFollowing, getProfile } from '@/lib/queries/profiles';
import { UserList } from '@/components/ui/UserList';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Header } from '@/components/layout/Header';
import { shouldShowFollowEmptyHint } from '@/lib/utils/profile-display';

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
        <SectionTitle>{following.length}명</SectionTitle>
        <p className="mt-0.5 text-[12px] text-neutral-500">
          @{profile.nickname}님이 팔로우하는 사람
        </p>
      </div>

      {following.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <UserRoundX className="h-12 w-12 text-neutral-400 stroke-[1.5]" />
          <p className="mt-3 text-base font-bold text-neutral-900">
            아직 팔로우하는 사람이 없어요
          </p>
          {shouldShowFollowEmptyHint(user?.id, id) && (
            <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-500 break-keep">
              함께하고 싶은 호스트나 크루를 팔로우해보세요.
              <br />
              새로 열리는 액션 소식을 놓치지 않고 확인할 수 있어요.
            </p>
          )}
        </div>
      ) : (
        <UserList users={following} />
      )}
    </main>
  );
}
