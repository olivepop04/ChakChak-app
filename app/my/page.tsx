/**
 * MY — 내 프로필.
 *
 * "참여 액션 수" 는 소감까지 쓴 것(ACTUALLY_PARTICIPATED)만 셉니다.
 * getProfile 이 계산해서 주므로 직접 세지 마세요.
 */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Bell, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/lib/queries/profiles';
import { getSavedActions } from '@/lib/queries/actions';
import { Avatar } from '@/components/ui/Avatar';
import { LogoutButton } from '@/components/ui/LogoutButton';
import { SectionTitle } from '@/components/ui/SectionTitle';
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
        title="내 프로필"
        back
        backHref="/"
        right={
          <Link
            href="/notifications"
            aria-label="알림"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-neutral-100 text-neutral-600"
          >
            <Bell className="h-5 w-5 text-neutral-700" />
          </Link>
        }
      />

      {/* 프로필 */}
      <section className="flex items-center gap-4 px-6 py-4">
        <Avatar name={profile.nickname} avatar={profile.avatar} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-subtitle font-bold text-neutral-900">
            @{profile.nickname}
          </p>
          <p className="truncate text-label text-neutral-500">{profile.name}</p>
          {profile.bio && (
            <p className="mt-1 line-clamp-2 text-label leading-normal text-neutral-500">
              {profile.bio}
            </p>
          )}
        </div>
        <Link
          href="/my/edit"
          className="inline-flex min-h-9 shrink-0 items-center rounded-full border border-hairline px-3.5 text-label font-semibold text-neutral-800"
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
          ledHref: '/activity',
          participatedHref: '/activity?tab=joined',
          followersHref: `/user/${user.id}/followers`,
          followingHref: `/user/${user.id}/following`,
        })}
      />

      {/* 관심 카테고리 */}
      {profile.categories.length > 0 && (
        <section className="mt-6 px-6">
          <SectionTitle className="pb-3">관심 카테고리</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {profile.categories.map((c) => (
              // 관심 카테고리 = 연한 초록 바탕 + 초록 테두리·글자 (2026-09-29 프로필군 통일안)
              <span
                key={c}
                className="inline-flex h-7 items-center rounded-full border border-brand bg-brand-soft px-3 text-caption font-semibold text-brand"
              >
                {c}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* 내가 저장한 액션 */}
      <MySavedSection saved={saved} />

      {/* 설정 — 2026-09-29: 구분선 없음(사이·위·아래), 14→15px, › 글자 → ChevronRight.
          LogoutButton 줄과 같은 모양이라 둘을 같이 고칩니다 (Day 13 보류분) */}
      <section className="mt-8">
        <Link
          href="/my/edit#notification-settings"
          className="flex min-h-[52px] items-center justify-between px-6 text-body font-medium text-neutral-800 hover:bg-neutral-50"
        >
          알림 설정
          <ChevronRight className="h-[18px] w-[18px] text-faint" aria-hidden="true" />
        </Link>
        <LogoutButton />
      </section>

      {/* 하단 푸터 */}
      <footer className="mt-8 flex items-center justify-center gap-3 pb-4 text-center">
        <Link
          href="/terms?from=my"
          className="text-label text-neutral-500 underline underline-offset-4 hover:text-neutral-700"
        >
          이용약관
        </Link>
        <span aria-hidden="true" className="text-caption text-faint">
          ·
        </span>
        <Link
          href="/privacy?from=my"
          className="text-label text-neutral-500 underline underline-offset-4 hover:text-neutral-700"
        >
          개인정보 처리방침
        </Link>
      </footer>
    </main>
  );
}
