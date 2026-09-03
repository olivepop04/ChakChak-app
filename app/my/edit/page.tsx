/**
 * 프로필 수정.
 *
 * 이름과 성별은 바꿀 수 없습니다 (표시만 합니다).
 *  - 이름: 신뢰를 위해 가입 후 변경 불가
 *  - 성별: 항목별 성별 제한 검증에 쓰이는 값이라 임의로 못 바꾸게 합니다
 */
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/lib/queries/profiles';
import { Header } from '@/components/layout/Header';
import { ProfileEditForm } from '@/components/ui/ProfileEditForm';

export default async function ProfileEditPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/my/edit');

  // 직접 조회하지 않고 공용 함수를 씁니다.
  // 컬럼이 늘어도(time_prefs · notify_off 처럼) 여기를 안 고쳐도 됩니다.
  const profile = await getProfile(supabase, user.id, user.id);
  if (!profile) redirect('/login');

  return (
    <main>
      <Header title="프로필 수정" back backHref="/my" sticky />
      <ProfileEditForm
        userId={user.id}
        initial={{
          name: profile.name,
          nickname: profile.nickname,
          gender: profile.gender,
          bio: profile.bio ?? '',
          skills: profile.skills,
          categories: profile.categories,
          availableTimes: profile.availableTimes,
          timePrefs: profile.timePrefs,
          notifyOff: profile.notifyOff,
          regions: profile.regions,
        }}
      />
    </main>
  );
}
