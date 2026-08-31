/**
 * 프로필 수정.
 *
 * 이름과 성별은 바꿀 수 없습니다 (표시만 합니다).
 *  - 이름: 신뢰를 위해 가입 후 변경 불가
 *  - 성별: 항목별 성별 제한 검증에 쓰이는 값이라 임의로 못 바꾸게 합니다
 */
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { ProfileEditForm } from '@/components/ui/ProfileEditForm';
import type { Gender } from '@/lib/constants';

export default async function ProfileEditPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/my/edit');

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, nickname, gender, bio, categories, available_times, regions')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile) redirect('/login');

  return (
    <main>
      <Header title="프로필 수정" back backHref="/my" sticky />
      <ProfileEditForm
        userId={user.id}
        initial={{
          name: profile.name,
          nickname: profile.nickname,
          gender: profile.gender as Gender,
          bio: profile.bio ?? '',
          categories: profile.categories ?? [],
          availableTimes: profile.available_times ?? [],
          regions: profile.regions ?? [],
        }}
      />
    </main>
  );
}
