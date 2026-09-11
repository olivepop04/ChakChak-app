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
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getProfile, getParticipatedActions } from '@/lib/queries/profiles';
import { getPublicActionsByOwner } from '@/lib/queries/actions';
import { Header } from '@/components/layout/Header';
import { ProfileActionSection } from '@/components/my/ProfileActionSection';
import { UserProfileSummary } from './UserProfileSummary';

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

      <UserProfileSummary
        id={profile.id}
        nickname={profile.nickname}
        bio={profile.bio}
        isMe={profile.isMe}
        canFollow={Boolean(user)}
        followedByMe={profile.followedByMe}
        ledCount={profile.ledCount}
        participatedCount={profile.participatedCount}
        initialFollowerCount={profile.followerCount}
        followingCount={profile.followingCount}
      />

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

      <ProfileActionSection
        title="호스트한 액션"
        emptyText="아직 호스트한 액션이 없어요."
        actions={created}
        href={`/user/${id}/created`}
      />

      {/* 통계 숫자와 같은 것을 가리키므로 이름을 맞춥니다 (2026-09-11 회의).
          내 활동의 「참여한 액션」 탭은 참여 예정까지 전부 보여주므로 이름이 다릅니다. */}
      <ProfileActionSection
        title="참여 완료 액션"
        emptyText="아직 완료한 액션이 없어요."
        description="활동이 끝나고 소감까지 작성한 액션만 보여요."
        actions={joined}
        href={`/user/${id}/joined`}
      />
    </main>
  );
}
