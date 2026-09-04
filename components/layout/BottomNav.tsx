/**
 * 하단 탭 5개.
 *
 * 비회원이 DISCOVER · ＋ · ACTIVITY · MY 를 누르면
 * middleware 가 로그인 화면으로 보냅니다. 여기서는 링크만 걸면 됩니다.
 */
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';

const TABS = [
  { href: '/', label: 'HOME', icon: '⌂' },
  { href: '/discover', label: 'DISCOVER', icon: '⌕' },
  { href: '/action/create', label: 'CREATE', icon: '＋' },
  { href: '/activity', label: 'ACTIVITY', icon: '◷' },
  { href: '/my', label: 'MY', icon: '○' },
] as const;

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname.startsWith(href);
}

/**
 * 하단 탭을 숨기는 화면들 (정확히 5곳).
 * 집중해서 무언가를 작성·진행하는 중에는 탭이 방해가 됩니다.
 *
 * 1. /action/create (액션 만들기)
 * 2. /action/[id]/join (참여 신청)
 * 3. /action/[id]/voice (소감 작성)
 * 4. /action/[id]/result/write (결과 작성)
 * 5. /my/edit (프로필 수정)
 *
 * ⚠️ /welcome(참여 완료)은 2026-09-01 합의(F02)로 목록에서 뺐습니다.
 *    거기서 하단 탭이 보여야 "HOME으로 가기" 버튼을 지울 수 있습니다(F43).
 */
const HIDDEN = [
  '/action/create',
  '/join',
  '/voice',
  '/result/write',
  '/my/edit',
];

export function BottomNav() {
  const pathname = usePathname();

  if (HIDDEN.some((p) => pathname.startsWith(p) || pathname.endsWith(p))) {
    return null;
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-app border-t border-neutral-200 bg-white/95 backdrop-blur"
      aria-label="주요 메뉴"
    >
      <ul className="flex">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab.href);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center gap-0.5 py-2.5 transition-colors',
                  active ? 'text-neutral-900' : 'text-neutral-400',
                )}
              >
                <span className="text-lg leading-none" aria-hidden="true">
                  {tab.icon}
                </span>
                <span className="text-[10px] font-semibold tracking-wide">
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {/* 아이폰 하단 홈 인디케이터 영역 */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
