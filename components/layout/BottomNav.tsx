/**
 * 하단 탭 5개.
 *
 * 비회원이 DISCOVER · ＋ · ACTIVITY · MY 를 누르면
 * middleware 가 로그인 화면으로 보냅니다. 여기서는 링크만 걸면 됩니다.
 */
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HouseHeart, SearchCheck, Plus, Grid2x2Plus, UserCircle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const TABS = [
  { href: '/', label: '홈', icon: HouseHeart },
  { href: '/discover', label: '액션 찾기', icon: SearchCheck },
  { href: '/action/create', label: '액션 만들기', icon: Plus },
  { href: '/activity', label: '내 액션', icon: Grid2x2Plus },
  { href: '/my', label: '프로필', icon: UserCircle },
] as const;

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname.startsWith(href);
}

/**
 * 하단 탭을 숨기는 화면들.
 *
 * ⚠️ 2026-09-18 지시서 1번으로 글쓰기 화면 5개(액션 만들기 · 참여 신청 ·
 *    소감 작성 · 결과 작성 · 프로필 수정)를 여기서 뺐습니다. "글쓰기 중에
 *    다른 화면으로 갈 길이 없다"는 요청이라, 탭을 다시 보이게 하는 대신
 *    각 화면의 하단 제출 바를 --nav-h 만큼 띄워서 안 겹치게 했습니다
 *    (globals.css의 --nav-h, 각 Form의 bottom-[calc(var(--nav-h)+…)] 참고).
 *    다시 숨기면 안 됩니다 — 탭이 이 다섯 화면 탈출구입니다.
 *
 * ⚠️ /welcome(참여 완료)은 2026-09-01 합의(F02)로 목록에서 뺐습니다.
 *    거기서 하단 탭이 보여야 "HOME으로 가기" 버튼을 지울 수 있습니다(F43).
 *    다시 넣으면 참여 완료 화면에서 홈으로 갈 방법이 사라집니다.
 */
const HIDDEN = [
  '/terms',
  '/privacy',
  // 가입 환영 화면 (2026-09-11). 「셋 중 하나 골라 시작하기」 가 이 화면의 일인데,
  // 하단 탭이 경쟁하는 선택지 5개를 또 내밀고 있었습니다.
  //
  // 그리고 글자 200% 에서 탭이 62px -> 107px 로 커져서 버튼 두 개가 탭에 가렸습니다.
  // 여백을 극단까지 줄여도(pt-4 · pt-2 · gap-1) 43px 이 모자랐습니다 — 실측.
  // 탭을 숨기는 것 말고는 해결이 안 됐습니다.
  //
  // ⚠️ 위의 /welcome(참여 완료) 주석과 같은 함정이 있습니다 — 탭을 숨기면 나갈 길이
  //    사라집니다. 그래서 이 화면에는 「홈으로」 링크를 따로 넣어 뒀습니다.
  //    그 링크를 지우면 안 됩니다.
  '/signup/welcome',
];

export function BottomNav() {
  const pathname = usePathname();

  if (HIDDEN.some((p) => pathname.startsWith(p) || pathname.endsWith(p))) {
    return null;
  }

  // ★ 배경을 불투명하게 둡니다. backdrop-blur 를 다시 넣지 마세요. (2026-09-17)
  //
  //   전에는 `bg-white/95 backdrop-blur` 였습니다. 그런데 아이폰에서
  //   **하단 탭이 화면 중간에 떠 있는** 제보가 왔습니다 (성은님).
  //     · 아이폰 크롬 — iOS 크롬은 내부가 WebKit 이라 사파리와 같은 렌더 엔진입니다
  //     · 그때그때 다르고, 브라우저를 끄고 다시 들어오면 풀립니다
  //     · 민호 폰·소정님 폰에서는 안 났습니다
  //
  //   CSS 규칙이 틀린 것은 아닙니다 — html·body·ToastProvider 어디에도
  //   transform·filter·contain 이 없어서 고정 기준은 화면(뷰포트)이 맞습니다.
  //   375×812 측정에서도 탭은 750~812 에 정확히 붙어 있었습니다.
  //
  //   간헐적이고 재시작으로 풀리는 것은 **합성 레이어 상태가 틀어지는 것**입니다.
  //   반투명 배경 + backdrop-filter 가 걸린 position:fixed 요소는 iOS WebKit 에서
  //   스크롤 직후 옛 자리에 그려지는 알려진 문제가 있습니다.
  //   앱 전체에서 fixed + backdrop-blur 조합은 **이 요소 하나뿐**이었습니다 (전수 확인).
  //
  //   원래 95% 불투명이라 눈에 보이는 차이는 거의 없습니다.
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-app border-t border-neutral-200 bg-white"
      aria-label="주요 메뉴"
    >
      <ul className="flex">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab.href);
          const Icon = tab.icon;
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
                <Icon className="h-6 w-6" strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
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
