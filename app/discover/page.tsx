import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DiscoverChat } from '@/components/action/DiscoverChat';
import { Header } from '@/components/layout/Header';

export default async function DiscoverPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/discover');

  const { data: profile } = await supabase
    .from('profiles')
    .select('nickname')
    .eq('id', user.id)
    .maybeSingle();

  return (
    <main className="pb-24">
      <Header title="DISCOVER" back backHref="/" sticky />
      <DiscoverChat nickname={profile?.nickname ?? '회원'} />
    </main>
  );
}
