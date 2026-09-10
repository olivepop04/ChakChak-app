/**
 * MY — 내 프로필.
 *
 * "참여 액션 수" 는 소감까지 쓴 것(ACTUALLY_PARTICIPATED)만 셉니다.
 * getProfile 이 계산해서 주므로 직접 세지 마세요.
 */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Bell } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/lib/queries/profiles';
import { getSavedActions } from '@/lib/queries/actions';
import { Avatar } from '@/components/ui/Avatar';
import { LogoutButton } from '@/components/ui/LogoutButton';
import { MySavedSection } from '@/components/my/MySavedSection';
import { ProfileStats } from '@/components/my/ProfileStats';
import { Header } from '@/components/layout/Header';
import { buildProfileStats } from '@/lib/utils/profile-display';

export default async function MyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/my');

  const profile = await getProfile(supabase, user.id, user.id);
  if (!profile) redirect('/login');

  const saved = await getSavedActions(supabase, user.id);

  return (
    <main className="pb-24">
      <Header
        title="MY"
        back
        backHref="/"
        right={
          <Link
            href="/notifications"
            aria-label="알림"
            className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-neutral-100 text-neutral-600"
          >
            <Bell className="h-5 w-5 text-neutral-700" />
          </Link>
        }
      />

      {/* 프로필 */}
      <section className="flex items-center gap-4 px-5 py-4">
        <Avatar name={profile.nickname} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-bold text-neutral-900">
            @{profile.nickname}
          </p>
          <p className="truncate text-[13px] text-neutral-500">{profile.name}</p>
          {profile.bio && (
            <p className="mt-1 line-clamp-2 text-[12px] text-neutral-500">
              {profile.bio}
            </p>
          )}
        </div>
        <Link
          href="/my/edit"
          className="shrink-0 rounded-lg border border-neutral-300 px-3 py-2 text-[12px] font-semibold text-neutral-700"
        >
          프로필 수정
        </Link>
      </section>

      {/* 통계 */}
      <ProfileStats
        stats={buildProfileStats({
          ledCount: profile.ledCount,
          participatedCount: profile.participatedCount,
          followerCount: profile.followerCount,
          followingCount: profile.followingCount,
          ledHref: '/activity?tab=created',
          participatedHref: '/activity',
          followersHref: `/user/${user.id}/followers`,
          followingHref: `/user/${user.id}/following`,
        })}
      />

      {/* 관심 카테고리 */}
      {profile.categories.length > 0 && (
        <section className="mt-7 px-5">
          <h2 className="pb-3 text-[15px] font-bold text-neutral-900">
            관심 카테고리
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {profile.categories.map((c) => (
              <span
                key={c}
                className="rounded-full bg-neutral-100 px-3 py-1.5 text-[12px] font-medium text-neutral-600"
              >
                {c}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* 내가 저장한 액션 */}
      <MySavedSection saved={saved} />

      {/* 설정 */}
      <section className="mt-8">
        <div className="divide-y divide-neutral-100 border-y border-neutral-100">
          <Link
            href="/my/edit#notification-settings"
            className="flex items-center justify-between px-5 py-4 text-[14px] text-neutral-700 hover:bg-neutral-50"
          >
            알림 설정
            <span className="text-neutral-300">›</span>
          </Link>
          <LogoutButton />
        </div>
      </section>

      {/* 하단 푸터 */}
      <footer className="mt-8 flex items-center justify-center gap-3 pb-4 text-center">
        <Link
          href="/terms?from=my"
          className="text-[12px] text-neutral-400 underline underline-offset-4 hover:text-neutral-600"
        >
          이용약관
        </Link>
        <span aria-hidden="true" className="text-[11px] text-neutral-300">
          ·
        </span>
        <Link
          href="/privacy?from=my"
          className="text-[12px] text-neutral-400 underline underline-offset-4 hover:text-neutral-600"
        >
          개인정보 처리방침
        </Link>
      </footer>
    </main>
  );
}
