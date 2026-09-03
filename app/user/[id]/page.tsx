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
import { ActionCard } from '@/components/ui/ActionCard';
import { FollowButton } from '@/components/ui/ToggleButtons';
import { Header } from '@/components/layout/Header';

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
        <Stat value={profile.ledCount} label="리드한 액션" />
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
        <div className="flex flex-wrap gap-1.5 px-5 pt-5">
          {profile.categories.map((c) => (
            <span
              key={c}
              className="rounded-full bg-neutral-100 px-3 py-1.5 text-[12px] font-medium text-neutral-600"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      <section className="mt-7">
        <h2 className="px-5 pb-3 text-[15px] font-bold text-neutral-900">
          만든 액션 <span className="text-neutral-400">{created.length}</span>
        </h2>
        {created.length === 0 ? (
          <p className="mx-5 rounded-xl bg-neutral-50 px-4 py-6 text-center text-[13px] text-neutral-400">
            아직 만든 액션이 없어요.
          </p>
        ) : (
          <div className="flex flex-col gap-4 px-5">
            {created.map((a) => (
              <ActionCard key={a.id} action={a} showStatus />
            ))}
          </div>
        )}
      </section>

      <section className="mt-7">
        <h2 className="px-5 pb-1 text-[15px] font-bold text-neutral-900">
          참여한 액션 <span className="text-neutral-400">{joined.length}</span>
        </h2>
        <p className="px-5 pb-3 text-[11px] text-neutral-400">
          활동이 끝난 액션만 보여요.
        </p>
        {joined.length === 0 ? (
          <p className="mx-5 rounded-xl bg-neutral-50 px-4 py-6 text-center text-[13px] text-neutral-400">
            아직 완료한 액션이 없어요.
          </p>
        ) : (
          <div className="flex flex-col gap-4 px-5">
            {joined.map((a) => (
              <ActionCard key={a.id} action={a} showStatus />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
