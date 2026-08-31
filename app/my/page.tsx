/**
 * MY — 내 프로필.
 *
 * "참여 액션 수" 는 소감까지 쓴 것(ACTUALLY_PARTICIPATED)만 셉니다.
 * getProfile 이 계산해서 주므로 직접 세지 마세요.
 */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/lib/queries/profiles';
import { getSavedActions } from '@/lib/queries/actions';
import { Avatar } from '@/components/ui/Avatar';
import { ActionCard } from '@/components/ui/ActionCard';
import { LogoutButton } from '@/components/ui/LogoutButton';

function Stat({
  value,
  label,
  href,
}: {
  value: number;
  label: string;
  href?: string;
}) {
  const inner = (
    <div className="flex flex-1 flex-col items-center gap-0.5 py-3">
      <span className="text-[19px] font-bold tabular-nums text-neutral-900">
        {value}
      </span>
      <span className="text-[11px] text-neutral-500">{label}</span>
    </div>
  );
  return href ? (
    <Link href={href} className="flex flex-1">
      {inner}
    </Link>
  ) : (
    inner
  );
}

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
      <header className="flex items-center justify-between px-5 pb-2 pt-6">
        <h1 className="text-xl font-bold tracking-tight text-neutral-900">MY</h1>
        <Link
          href="/notifications"
          aria-label="알림"
          className="flex h-10 w-10 items-center justify-center rounded-full text-lg hover:bg-neutral-100"
        >
          🔔
        </Link>
      </header>

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
      <section className="mx-5 flex rounded-xl border border-neutral-200">
        <Stat value={profile.participatedCount} label="참여 액션" />
        <Stat value={profile.ledCount} label="리드한 액션" />
        <Stat
          value={profile.followerCount}
          label="팔로워"
          href={`/user/${user.id}/followers`}
        />
        <Stat
          value={profile.followingCount}
          label="팔로잉"
          href={`/user/${user.id}/following`}
        />
      </section>

      {/* 관심 카테고리 */}
      {profile.categories.length > 0 && (
        <section className="flex flex-wrap gap-1.5 px-5 pt-5">
          {profile.categories.map((c) => (
            <span
              key={c}
              className="rounded-full bg-neutral-100 px-3 py-1.5 text-[12px] font-medium text-neutral-600"
            >
              {c}
            </span>
          ))}
        </section>
      )}

      {/* 저장한 액션 */}
      <section className="mt-7">
        <div className="flex items-center justify-between px-5 pb-3">
          <h2 className="text-[15px] font-bold text-neutral-900">
            내가 저장한 액션{' '}
            <span className="text-neutral-400">{saved.length}</span>
          </h2>
          {saved.length > 2 && (
            <Link href="/my/saved" className="text-[12px] text-neutral-500">
              모두 보기 ›
            </Link>
          )}
        </div>

        {saved.length === 0 ? (
          <p className="mx-5 rounded-xl bg-neutral-50 px-4 py-6 text-center text-[13px] text-neutral-400">
            아직 저장한 액션이 없어요.
          </p>
        ) : (
          <div className="flex flex-col gap-4 px-5">
            {saved.slice(0, 2).map((a) => (
              <ActionCard key={a.id} action={a} showStatus />
            ))}
          </div>
        )}
      </section>

      {/* 계정 설정 */}
      <section className="mt-8">
        <h2 className="px-5 pb-2 text-[12px] font-semibold tracking-wide text-neutral-400">
          계정 설정
        </h2>
        <div className="divide-y divide-neutral-100 border-y border-neutral-100">
          <Link
            href="/my/edit"
            className="flex items-center justify-between px-5 py-4 text-[14px] text-neutral-700 hover:bg-neutral-50"
          >
            프로필 수정
            <span className="text-neutral-300">›</span>
          </Link>
          <Link
            href="/my/saved"
            className="flex items-center justify-between px-5 py-4 text-[14px] text-neutral-700 hover:bg-neutral-50"
          >
            저장한 액션
            <span className="text-neutral-300">›</span>
          </Link>
          <LogoutButton />
        </div>
      </section>
    </main>
  );
}
