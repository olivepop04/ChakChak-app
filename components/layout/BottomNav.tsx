/**
 * 하단 탭 5개.
 *
 * 비회원이 액션 만들기 · 내 액션 · 프로필을 누르면
 * middleware 가 로그인 화면으로 보냅니다. 액션 찾기는 비회원도 열리고,
 * 화면 안에서 로그인 안내를 보여줍니다. 여기서는 링크만 걸면 됩니다.
 */
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { House, SearchCheck, Plus, LayersPlus, UserCircle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const TABS = [
  { href: '/', label: '홈', icon: House, iconClassName: 'h-6 w-6' },
  { href: '/discover', label: '액션 찾기', icon: SearchCheck, iconClassName: 'h-6 w-6' },
  { href: '/action/create', label: '액션 만들기', icon: Plus, iconClassName: 'h-7 w-7' },
  { href: '/activity', label: '내 액션', icon: LayersPlus, iconClassName: 'h-5 w-5' },
  // h-5.5 는 Tailwind 기본 spacing 에 5.5 가 없어서 CSS 가 아예 안 생깁니다
  // (빌드 산출물에서 0건 확인). tailwind.config.ts 의 min-h-13 주석과 같은 함정이라
  // 임의값으로 적었습니다. 1.375rem = 22px — 소정님이 의도한 크기 그대로입니다.
  { href: '/my', label: '프로필', icon: UserCircle, iconClassName: 'h-[1.375rem] w-[1.375rem]' },
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
 *    알고 넘긴 것 (2026-09-21) — DRAFT 를 이어 쓰는 중(`/action/create?id=…`)에
 *    「액션 만들기」 탭을 누르면 `?id=` 없는 빈 폼으로 갑니다. ActionForm 에
 *    이탈 경고·자동저장이 없어서 저장 안 한 내용이 사라집니다. 탭을 보이게 한
 *    것 자체의 부작용이라 고치지 않기로 했습니다. 버그 제보가 아니라 결정입니다.
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

  // ★ 아래 세 가지를 빼지 마세요. 셋이 한 묶음입니다. (2026-09-21)
  //
  //   ① nav 의 text-size-adjust: 100%   탭 라벨을 폰 글자 배율에서 빼기
  //   ② ul 의 h-[var(--nav-h)]          탭 높이를 변수에 고정
  //   ③ li 의 min-w-0                   ① 이 뚫렸을 때 truncate 가 걸리게
  //
  //   왜 — 글자 크기를 최대로 올리면 탭이 62px 에서 107px 이상으로 커지는데
  //   하단 바들은 `bottom: calc(var(--nav-h) + env(...))` = 64px 에 있어서
  //   **탭이 버튼을 덮었습니다.** 실제로 이렇게 보였습니다 (수정 13 · 3쪽)
  //     · 참여 완료 액션 — 「결과 보기」 버튼이 아예 안 보임
  //     · 참여 예정 액션 — 「함께하는 크루와 이야기하기」 가 반만 보임
  //     · 액션 만들기 — 「저장 / 액션 생성하기」 가 탭에 잘림
  //
  //   글자를 안 키우는 쪽(①)과 높이를 못 늘리는 쪽(②)을 같이 걸어야 막힙니다.
  //   ① 만 있으면 브라우저가 그 속성을 무시할 때 뚫리고,
  //   ② 만 있으면 커진 글자가 64px 박스 안에서 잘립니다.
  //   ③ 이 없으면 ① 이 뚫렸을 때 탭 바가 가로로 삐져나가 프로필 탭이 화면 밖으로
  //   밀립니다 (375px 화면에서 556px 까지 벌어지는 것을 확인).
  //   실측(글자 300%): 탭 높이 65px 유지 · 하단 바 버튼이 클릭을 정상 수신.
  //
  //   탭 모양을 바꿀 때는 `app/globals.css` 의 `--nav-h` 를 같이 올리세요.
  //   그 변수를 쓰는 곳이 11개 파일이라 한 곳만 고치면 전부 따라옵니다.

  // ── 알고 넘긴 것 — 하단 탭이 화면 중간에 떠 보이는 현상 (2026-09-21) ──────
  //
  //   원인: **iOS 사파리의 페이지 확대(Page Zoom) 툴바가 켜져 있을 때만** 나는
  //   WebKit 뷰포트 엣지 케이스입니다 (성은님이 재현 조건을 찾았습니다).
  //   그 툴바가 열리면 레이아웃 뷰포트와 시각 뷰포트가 어긋나서, fixed 요소가
  //   화면 바닥이 아닌 곳에 그려지고 그 아래로 본문이 계속 보입니다.
  //   100% 배율에서는 나지 않으므로 발표 시연에는 영향이 없습니다.
  //
  //   ⚠️ `backdrop-blur` 가 원인이라고 판단해 2026-09-17에 `bg-white/95 backdrop-blur`
  //   를 `bg-white` 로 바꿨습니다(8f619dd). **그 진단은 틀렸습니다** — 빼고 배포한 뒤에도
  //   같은 증상이 재발했습니다. 배경은 원래 95% 불투명이라 되돌릴 이유도 없어서 그냥 뒀습니다.
  //   **다시 blur 를 넣어 원인을 찾으려 하지 마세요.** 관계없는 변수입니다.
  //
  //   레이아웃으로 고치려 들면 100% 환경에 사이드 이펙트가 납니다. 정식 출시
  //   스프린트에서 진단 코드(innerHeight · visualViewport.height · nav 위치를
  //   화면에 띄워 증상 순간을 캡처)부터 붙이기로 했습니다.
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-app border-t border-neutral-200 bg-white"
      style={{
        // 민호(성은님 PR, origin/dev 1c26890) — 글자 배율(200~300%)을 켜면 라벨이
        // 커지면서 탭이 부풀어 다른 화면 하단 버튼을 덮는 버그가 있었다. 이 두 줄이
        // 그 짝 수정 중 ①번 — 탭 라벨은 폰 글자 크기 설정을 따라가지 않게 막는다.
        // 아래 <ul> 의 h-[var(--nav-h)] 와 반드시 같이 있어야 한다 (하나만 빼면 재발).
        WebkitTextSizeAdjust: '100%',
        textSizeAdjust: '100%',
      }}
      aria-label="주요 메뉴"
    >
      {/*
        2026-09-21 홈피드 개편 — 활성 탭만 캡슐 배경 + 라벨, 비활성 탭은 아이콘만.
        라벨을 영구히 지운 게 아니라 활성 상태에 따라 매번 바뀌는 것이 핵심(고정 삭제 아님).
        색은 브랜드 그린 토큰(brand/brand-soft, tailwind.config.ts) 사용.

        아이콘·라벨 크기를 여기서 더 키운다면 app/globals.css 의 --nav-h(64px)도
        같이 올릴 것 — 하단 고정 바가 있는 11개 화면이 전부 이 변수로 자기 위치를 잡는다.
      */}
      <ul className="flex h-[var(--nav-h)] items-center justify-between px-4">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab.href);
          const Icon = tab.icon;
          return (
            <li key={tab.href} className="flex min-w-0 items-center justify-center">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                aria-label={active ? undefined : tab.label}
                className={cn(
                  'flex min-w-0 items-center justify-center gap-1.5 rounded-full transition-all duration-300 ease-in-out',
                  // 터치 타겟 44px 이상 — 활성 캡슐은 py-2.5(10px×2)+아이콘 24px = 44px
                  active
                    ? 'bg-brand-soft px-4 py-2.5 text-brand'
                    : 'h-11 w-11 text-neutral-400 hover:text-neutral-600',
                )}
              >
                <Icon className={cn(tab.iconClassName || 'h-6 w-6', 'shrink-0')} strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
                {active && (
                  <span className="max-w-full truncate whitespace-nowrap text-label font-bold">
                    {tab.label}
                  </span>
                )}
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
