/**
 * 상단 바.
 *
 *   <Header title="JOIN ACTION" back />              뒤로가기 + 제목
 *   <Header title="MY" right={<Link…>⚙</Link>} />    우측 버튼
 *   <Header title="NOTIFICATIONS" back sticky />     스크롤해도 위에 붙어 있음
 */
'use client';

import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils/cn';

interface HeaderProps {
  title?: string;
  /** 뒤로가기 버튼을 보여줄지 */
  back?: boolean;
  /** 뒤로가기를 눌렀을 때 갈 곳. 없으면 브라우저 뒤로가기 */
  backHref?: string;
  right?: React.ReactNode;
  sticky?: boolean;
  className?: string;
}

export function Header({
  title,
  back,
  backHref,
  right,
  sticky,
  className,
}: HeaderProps) {
  const router = useRouter();

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
          onClick={() => (backHref ? router.push(backHref) : router.back())}
          aria-label="뒤로 가기"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-neutral-700 hover:bg-neutral-100"
        >
          ‹
        </button>
      ) : (
        <span className="w-2" />
      )}

      <h1 className="flex-1 truncate text-[13px] font-bold tracking-widest text-neutral-700">
        {title}
      </h1>

      <div className="flex items-center gap-1">{right}</div>
    </header>
  );
}
