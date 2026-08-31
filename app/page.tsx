/**
 * Home — 액션 피드.
 *
 * 비회원도 볼 수 있는 화면입니다. user 가 null 일 수 있으니
 * user!.id 처럼 강제로 단언하지 마세요. 비회원이 열면 터집니다.
 */
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getActionFeed } from '@/lib/queries/actions';
import { getUnreadCount } from '@/lib/queries/notifications';
import { ActionCard } from '@/components/ui/ActionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Chip } from '@/components/ui/Chip';
import { CATEGORIES, type Category } from '@/lib/constants';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const selected = CATEGORIES.includes(category as Category)
    ? (category as Category)
    : undefined;

  const actions = await getActionFeed(supabase, {
    viewerId: user?.id ?? null,
    limit: 30,
    category: selected,
  });

  const unread = user ? await getUnreadCount(supabase, user.id) : 0;

  return (
    <main className="pb-24">
      {/* 헤더 */}
      <header className="flex items-center justify-between px-5 pb-3 pt-6">
        <div>
          <p className="text-xl font-bold tracking-tight text-neutral-900">GOOD</p>
          <p className="mt-0.5 text-[13px] text-neutral-500">
            오늘 함께할 수 있는 좋은 일
          </p>
        </div>

        {user ? (
          <Link
            href="/notifications"
            aria-label="알림"
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-xl text-neutral-600 hover:bg-neutral-100"
          >
            🔔
            {unread > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Link>
        ) : (
          <Link
            href="/login"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-[13px] font-semibold text-neutral-700"
          >
            로그인
          </Link>
        )}
      </header>

      {/* 카테고리 필터 — 주소로 관리하므로 useState 가 필요 없습니다 */}
      <div className="flex gap-2 overflow-x-auto px-5 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Link href="/" scroll={false}>
          <Chip selected={!selected}>전체</Chip>
        </Link>
        {CATEGORIES.map((c) => (
          <Link key={c} href={`/?category=${encodeURIComponent(c)}`} scroll={false}>
            <Chip selected={selected === c}>{c}</Chip>
          </Link>
        ))}
      </div>

      {/* 피드 */}
      {actions.length === 0 ? (
        <EmptyState
          icon="🌱"
          title={
            selected ? `${selected} 액션이 아직 없어요` : '아직 열린 액션이 없어요'
          }
          description="첫 번째 액션을 만들어 함께할 사람을 모아보세요."
          action={{ label: '액션 만들기', href: '/action/create' }}
        />
      ) : (
        <div className="flex flex-col gap-4 px-5">
          {actions.map((a) => (
            <ActionCard key={a.id} action={a} />
          ))}
        </div>
      )}
    </main>
  );
}
