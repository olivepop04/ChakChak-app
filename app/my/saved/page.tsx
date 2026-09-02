import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSavedActions } from '@/lib/queries/actions';
import { EmptyState } from '@/components/ui/EmptyState';
import { Header } from '@/components/layout/Header';
import { SavedActionList } from './SavedActionList';

export default async function SavedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/my/saved');

  const saved = await getSavedActions(supabase, user.id);

  return (
    <main className="pb-24">
      <Header title="저장한 액션" back backHref="/my" sticky />

      {saved.length === 0 ? (
        <EmptyState
          icon="🔖"
          title="저장한 액션이 없어요"
          description="마음에 드는 액션을 저장해두면 여기 모여요."
          action={{ label: '액션 찾아보기', href: '/discover' }}
        />
      ) : (
        <SavedActionList actions={saved} />
      )}
    </main>
  );
}
