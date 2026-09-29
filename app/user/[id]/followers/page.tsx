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
        <p className="mt-0.5 text-label text-neutral-500">
          @{profile.nickname}님을 팔로우하는 사람
        </p>
      </div>

      {followers.length === 0 ? (
        // 빈 화면 — 회색 원(48px) + 아이콘 24px (알림·내 액션 빈 화면과 같은 모양, 2026-09-29)
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
          <span
            aria-hidden="true"
            className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100"
          >
            <UserRoundX className="h-6 w-6 text-neutral-500" />
          </span>
          <p className="text-body font-semibold text-neutral-800">
            아직 팔로워가 없어요
          </p>
          {shouldShowFollowEmptyHint(user?.id, id) && (
            <p className="text-label leading-relaxed text-neutral-500 break-keep">
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
