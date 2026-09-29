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

      <div className="px-6 py-4">
        <SectionTitle>{following.length}명</SectionTitle>
        <p className="mt-0.5 text-label text-neutral-500">
          @{profile.nickname}님이 팔로우하는 사람
        </p>
      </div>

      {following.length === 0 ? (
        // 빈 화면 — 회색 원(48px) + 아이콘 24px (알림·내 액션 빈 화면과 같은 모양, 2026-09-29)
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
          <span
            aria-hidden="true"
            className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100"
          >
            <UserRoundX className="h-6 w-6 text-neutral-500" />
          </span>
          <p className="text-body font-semibold text-neutral-800">
            아직 팔로우하는 사람이 없어요
          </p>
          {shouldShowFollowEmptyHint(user?.id, id) && (
            <p className="text-label leading-relaxed text-neutral-500 break-keep">
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
