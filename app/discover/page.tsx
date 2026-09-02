import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/lib/queries/profiles';
import { DiscoverChat } from '@/components/action/DiscoverChat';
import { Header } from '@/components/layout/Header';

export default async function DiscoverPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getProfile(supabase, user.id, user.id) : null;

  return (
    <main className="pb-24">
      <Header title="DISCOVER" back backHref="/" sticky />
      <DiscoverChat
        nickname={profile?.nickname ?? '회원'}
        authenticated={Boolean(user)}
      />
    </main>
  );
}
