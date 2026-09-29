import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSavedActions } from '@/lib/queries/actions';
import { Star } from 'lucide-react';
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
    <main className="min-h-screen pb-28">
      <Header title="저장한 액션" back backHref="/my" sticky />

      {saved.length === 0 ? (
        // 2026-09-29 통일안 — 이모지 🔖 → 회색 원 + Star(저장 아이콘과 같은 모양),
        // 검정 「액션 찾아보기」 버튼은 없앰(하단 탭 「액션 찾기」와 겹침). 공용 EmptyState 는 안 건드림
        <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
          <span
            aria-hidden="true"
            className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100"
          >
            <Star className="h-6 w-6 text-neutral-500" />
          </span>
          <p className="text-body font-semibold text-neutral-800">저장한 액션이 없어요</p>
          <p className="text-label leading-relaxed text-neutral-500">
            마음에 드는 액션을 저장해두고 다시 볼 수 있어요.
          </p>
        </div>
      ) : (
        <SavedActionList actions={saved} />
      )}
    </main>
  );
}
