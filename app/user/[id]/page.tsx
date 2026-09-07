/**
 * 타인 프로필.
 *
 * 공개 범위 (팀 합의 D10)
 *   보여줌: 닉네임(주 표기) · 자기소개 · 통계 4종 · 만든 액션 · 참여한 액션(완료된 것만)
 *   숨김:   이메일 · 참여 예정 액션 · 저장 목록 · 알림
 *
 * "참여 예정" 을 노출하면 이 사람이 언제 어디에 갈지가 공개됩니다.
 * getParticipatedActions 가 완료된 것만 돌려주므로 직접 쿼리하지 마세요.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getProfile, getParticipatedActions } from '@/lib/queries/profiles';
import { getPublicActionsByOwner } from '@/lib/queries/actions';
import { Avatar } from '@/components/ui/Avatar';
import { FollowButton } from '@/components/ui/ToggleButtons';
import { Header } from '@/components/layout/Header';
import { ProfileActionSection } from '@/components/my/ProfileActionSection';

function Stat({ value, label, href }: { value: number; label: string; href?: string }) {
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

export default async function UserProfilePage({
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

  const [created, joined] = await Promise.all([
    getPublicActionsByOwner(supabase, id, viewerId),
    getParticipatedActions(supabase, id, viewerId),
  ]);

  return (
    <main className="pb-24">
      <Header title="프로필" back sticky />

      <section className="flex items-center gap-4 px-5 py-5">
        <Avatar name={profile.nickname} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-bold text-neutral-900">
            @{profile.nickname}
          </p>
          {profile.bio && (
            <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed text-neutral-500">
              {profile.bio}
            </p>
          )}
        </div>
        {profile.isMe ? (
          <Link
            href="/my/edit"
            className="shrink-0 rounded-lg border border-neutral-300 px-3 py-2 text-[12px] font-semibold text-neutral-700"
          >
            프로필 수정
          </Link>
        ) : (
          user && (
            <FollowButton
              targetUserId={profile.id}
              initialFollowing={profile.followedByMe}
              className="shrink-0"
            />
          )
        )}
      </section>

      <section className="mx-5 flex rounded-xl border border-neutral-200">
        <Stat value={profile.participatedCount} label="참여 액션" />
        <Stat value={profile.ledCount} label="호스트한 액션" />
        <Stat
          value={profile.followerCount}
          label="팔로워"
          href={`/user/${id}/followers`}
        />
        <Stat
          value={profile.followingCount}
          label="팔로잉"
          href={`/user/${id}/following`}
        />
      </section>

      {profile.categories.length > 0 && (
        <section className="px-5 pt-5">
          <p className="pb-2 text-[12px] font-semibold text-neutral-500">
            관심 카테고리 :
          </p>
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

      <ProfileActionSection
        title="호스트한 액션"
        emptyText="아직 호스트한 액션이 없어요."
        actions={created}
      />

      <ProfileActionSection
        title="참여한 액션"
        emptyText="아직 완료한 액션이 없어요."
        description="활동이 끝나고 소감까지 작성한 액션만 보여요."
        actions={joined}
      />
    </main>
  );
}
