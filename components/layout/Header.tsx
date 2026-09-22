/**
 * 상단 바.
 *
 *   <Header title="JOIN ACTION" back />              뒤로가기 + 제목
 *   <Header title="MY" right={<Link…>⚙</Link>} />    우측 버튼
 *   <Header title="NOTIFICATIONS" back sticky />     스크롤해도 위에 붙어 있음
 */
'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface HeaderProps {
  title?: string;
  /** 뒤로가기 버튼을 보여줄지 */
  back?: boolean;
  /** 뒤로가기를 눌렀을 때 갈 곳 (직접 접근 시 대체 경로). 없으면 브라우저 뒤로가기 기본 */
  backHref?: string;
  /** backHref 의 별칭 (직접 접근 시 대체 경로) */
  fallbackHref?: string;
  right?: React.ReactNode;
  sticky?: boolean;
  className?: string;
}

export function Header({
  title,
  back,
  backHref,
  fallbackHref,
  right,
  sticky,
  className,
}: HeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    const fallback = fallbackHref ?? backHref ?? '/';
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  };

  return (
    <header
      className={cn(
        'flex h-14 items-center gap-2 border-b border-neutral-100 bg-white px-3',
        sticky && 'sticky top-0 z-30',
        className,
      )}
    >
      {back ? (
        <button
          type="button"
          onClick={handleBack}
          aria-label="뒤로 가기"
          className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200 transition-colors"
        >
          <ChevronLeft className="h-5 w-5 text-neutral-700" />
        </button>
      ) : (
        <span className="w-2" />
      )}

      {/*
        페이지 제목은 15px 입니다. 13px 로 내리지 마세요. (2026-09-17, 수정 NO10 8쪽)

        전에는 13px 이었는데, 그러면 **앱에서 가장 위에 있는 제목이 가장 작았습니다** —
        섹션 제목 15px · 액션 제목 17px 보다 작았습니다. 게다가 입력칸 라벨
        (text-[13px] … text-neutral-700) 과 크기·색이 완전히 같고 굵기만 달랐습니다.

        약관·개인정보 화면은 제 헤더를 따로 그리는데 거기는 원래 15px 였습니다
        (app/(auth)/_legal/LegalDocumentPage.tsx). 즉 13px 이 예외였습니다.

        실측 (375×812 · `<Header` 호출 29곳 전수):
          · 제목은 전부 코드에 박힌 문자열이고 가장 긴 것이 「참여 완료 액션」 8자입니다.
            사용자 입력이 들어오는 자리는 없습니다.
          · 15px 자연폭 112.5px vs 제목칸 299px — 잘리는 화면이 0곳입니다.

        ⚠️ 글자 확대는 **경로가 두 개**고, 방향이 서로 반대입니다. 둘 다 봐야 합니다.
          (가) 브라우저 루트 글꼴 배율 — h-14 가 rem 이라 헤더가 56 → 112px 로 같이 커지고
               제목은 px 고정이라 그대로입니다. 이 경로는 커질수록 여유가 늘어납니다.
          (나) 폰 설정의 글자 배율 — `app/globals.css` 가 일부러
               `text-size-adjust: auto` 로 되돌려 뒀습니다(그 파일 주석 참고).
               이 경로에서는 **글자만 커지고 h-14 는 56px 에 머뭅니다.**
               줄박스는 글자의 1.5배라, 넘치기 시작하는 배율이
               13px 은 287% · **15px 은 249%** 입니다 — 즉 (나) 에서는 15px 이 13px 보다
               여유가 **적습니다.** 200% 에서는 22.5×2 = 45px < 56px 이라 둘 다 안전해서
               올려도 됩니다만, 나중에 h-14 를 건드릴 때 이 값을 기억하세요.

        8쪽의 나머지(자간·색 통일, 이중 h1 정리)는 발표 후 소정님 전담입니다.
      */}
      <h1 className="flex-1 truncate text-body font-bold tracking-widest text-neutral-700">
        {title}
      </h1>

      <div className="flex items-center gap-1">{right}</div>
    </header>
  );
}
