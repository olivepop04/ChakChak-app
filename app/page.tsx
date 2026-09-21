/**
 * Home — 액션 피드.
 *
 * 비회원도 볼 수 있는 화면입니다. user 가 null 일 수 있으니
 * user!.id 처럼 강제로 단언하지 마세요. 비회원이 열면 터집니다.
 */
import Link from 'next/link';
import { Bell, Check } from 'lucide-react';
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
  searchParams: Promise<{ category?: string; sort?: string }>;
}) {
  const { category, sort } = await searchParams;
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
    sort: sort === 'POPULAR' ? 'POPULAR' : 'DEADLINE',
  });

  const unread = user ? await getUnreadCount(supabase, user.id) : 0;

  const currentSort = sort === 'POPULAR' ? 'POPULAR' : 'DEADLINE';

  const makeCategoryUrl = (c?: string) => {
    const p = new URLSearchParams();
    if (c) p.set('category', c);
    if (currentSort === 'POPULAR') p.set('sort', 'POPULAR');
    const q = p.toString();
    return q ? `/?${q}` : '/';
  };

  const makeSortUrl = (s: 'DEADLINE' | 'POPULAR') => {
    const p = new URLSearchParams();
    if (selected) p.set('category', selected);
    if (s === 'POPULAR') p.set('sort', 'POPULAR');
    const q = p.toString();
    return q ? `/?${q}` : '/';
  };

  return (
    <main className="pb-24">
      {/* 헤더 */}
      <header className="flex items-center justify-between px-5 pb-3 pt-6">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/chakchak-wordmark.png" alt="착착" className="h-[18px] w-auto" />
          <p className="mt-1 text-[13px] text-neutral-500">
            착착 쌓이는 착한 일
          </p>
        </div>

        {user ? (
          <Link
            href="/notifications"
            aria-label="알림"
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100"
          >
            <Bell className="h-5 w-5 text-neutral-700" />
            {/* 2026-09-21 홈피드 개편: 숫자 대신 점 — 벨 아이콘은 "있다/없다"만 알면 됨.
                unread 값 자체(및 getUnreadCount)는 그대로 두고 표시만 바꿈 */}
            {unread > 0 && (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full border border-white bg-red-500" />
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

      {/* 필터 영역 (카테고리 + 정렬) */}
      <div className="flex flex-col gap-3 px-5 pb-4">
        {/* 카테고리 필터 — 주소로 관리하므로 useState 가 필요 없습니다 */}
        <div className="flex flex-row flex-nowrap items-center gap-2 overflow-x-auto -mx-5 px-5 scroll-smooth [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Link href={makeCategoryUrl(undefined)} scroll={false} className="shrink-0">
            <Chip selected={!selected} as="span" tone="accent" className="whitespace-nowrap">
              전체
            </Chip>
          </Link>
          {CATEGORIES.map((c) => (
            <Link key={c} href={makeCategoryUrl(c)} scroll={false} className="shrink-0">
              <Chip selected={selected === c} as="span" tone="accent" className="whitespace-nowrap">
                {c}
              </Chip>
            </Link>
          ))}
        </div>

        {/* 정렬 필터 칩 — 칩이 맨 앞(왼쪽)에서 시작 */}
        {/* 앞의 「정렬」 라벨은 2026-09-10 회의로 뺐습니다. */}
        <div className="flex items-center gap-2 border-t border-neutral-100 pt-3">
          <Link href={makeSortUrl('DEADLINE')} scroll={false}>
            <Chip selected={currentSort === 'DEADLINE'} as="span" tone="neutral">
              {currentSort === 'DEADLINE' && <Check className="h-3 w-3" strokeWidth={2.5} />}
              마감 임박
            </Chip>
          </Link>
          <Link href={makeSortUrl('POPULAR')} scroll={false}>
            <Chip selected={currentSort === 'POPULAR'} as="span" tone="neutral">
              {currentSort === 'POPULAR' && <Check className="h-3 w-3" strokeWidth={2.5} />}
              인기순
            </Chip>
          </Link>
        </div>
      </div>

      {/* 피드 */}
      {actions.length === 0 ? (
        <EmptyState
          icon="🌱"
          title={
            selected ? `${selected} 액션이 아직 없어요` : '아직 해당 액션이 없어요'
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
