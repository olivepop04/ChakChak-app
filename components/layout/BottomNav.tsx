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
 * 하단 탭을 숨기는 화면들.
 * 집중해서 무언가를 작성·진행하는 중에는 탭이 방해가 됩니다.
 *
 * ⚠️ /welcome(참여 완료)은 2026-09-01 합의(F02)로 목록에서 뺐습니다.
 *    거기서 하단 탭이 보여야 "HOME으로 가기" 버튼을 지울 수 있습니다(F43).
 *    다시 넣으면 참여 완료 화면에서 홈으로 갈 방법이 사라집니다.
 *
 * ────────────────────────────────────────────────────────────
 * 📌 소정님 — 이 목록을 손보실 때 읽어주세요 (2026-09-04)
 *
 * 2026-09-03 회의에서 "하단 탭 숨김은 **다섯 곳만**" 으로 정했습니다.
 * 지금은 11개입니다. 아래에 어느 줄이 회의 결정이고 어느 줄이 아닌지
 * 표시해뒀으니, 정리하실 때 그대로 지우시면 됩니다.
 *
 * 다만 /terms · /privacy 두 줄은 **회의 뒤에 새로 생긴 화면**이라
 * 결정에 없습니다. 지수님이 약관 페이지를 만들면서 넣으신 것이고,
 * 남길지 뺄지는 소정님이 정하시면 됩니다.
 *   - 남긴다  → 약관을 읽는 동안 탭이 안 보입니다 (전체화면 문서처럼)
 *   - 뺀다    → 로그인·가입과 똑같이 탭이 보입니다 (회의 결정과 일관됨)
 *
 * 어느 쪽이든 저희는 괜찮습니다. 정하시면 이 주석도 같이 지워주세요.
 * ────────────────────────────────────────────────────────────
 */
const HIDDEN = [
  // ── 회의에서 "숨긴다" 로 정한 다섯 곳 ──
  '/action/create', // 액션 만들기
  '/join', // 참여 신청
  '/voice', // 소감
  '/result/write', // 결과 작성
  '/my/edit', // 프로필 수정

  // ── 회의에서 "목록에서 뺀다" 로 정한 네 곳 (아직 안 뺐습니다) ──
  '/login',
  '/signup',
  '/chat',
  '/share',

  // ── 회의 뒤에 생긴 화면. 결정된 바 없습니다 ──
  '/terms',
  '/privacy',
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
