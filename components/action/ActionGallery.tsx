/**
 * 액션 이미지 갤러리 (최대 3장).
 * 좌우로 스와이프해서 넘기고, 마우스가 있는 기기(컴퓨터)에서는 좌우 화살표로도 넘깁니다 — ArrowScroller.
 * 아래 점(현재 위치 표시)은 2026-09-29 에 뺐습니다 — 화살표가 첫·마지막 장에서 숨어서 위치를 대신 알려줍니다.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * 가로 스크롤 칸 + 컴퓨터용 좌우 화살표 (2026-09-29, 조장님 의견).
 *
 * 액션 상세 · 홈 카드(ActionGallery) 와 결과 보기 사진 줄이 같은 화살표를 씁니다.
 * 새 파일로 떼지 않고 여기 둔 것은 담당표(CLAUDE.md)에 줄을 늘리지 않기 위해서입니다.
 *
 * - 화살표는 hover 가 되는 기기에서만 보입니다. 폰은 지금처럼 밀어서 넘깁니다.
 * - 첫 칸에서는 ←, 마지막 칸에서는 → 를 숨깁니다. 넘칠 게 없으면 둘 다 숨깁니다.
 * - ⚠️ 홈 카드에서는 이 칸 전체가 상세로 가는 Link 안에 있습니다 (CLAUDE.md 규칙 16).
 *   화살표 클릭이 그 Link 로 올라가면 상세로 넘어가 버려서, preventDefault +
 *   stopPropagation 으로 막습니다. 둘 중 하나라도 지우면 카드에서만 조용히 깨집니다.
 */
export function ArrowScroller({
  children,
  className,
  wrapperClassName,
  step = 'page',
  arrowsFocusable = true,
}: {
  children: React.ReactNode;
  /** 스크롤되는 칸의 className (flex · overflow-x-auto 등) */
  className?: string;
  wrapperClassName?: string;
  /** 'page' = 한 칸 폭만큼(한 장씩 넘기는 갤러리), 'partial' = 폭의 80%(여러 장이 보이는 사진 줄) */
  step?: 'page' | 'partial';
  /** 화살표를 키보드 Tab 으로 잡을지. 링크 안(카드)에 들어가는 곳은 false */
  arrowsFocusable?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const update = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    update();
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    // 칸 자체 + 안의 사진들까지 봅니다. 사진이 늦게 뜨면 전체 폭이 그때 바뀌기 때문입니다
    // (결과 보기 사진 줄은 사진마다 폭이 달라서, 칸만 보면 → 가 안 뜹니다)
    const observer = new ResizeObserver(update);
    observer.observe(el);
    Array.from(el.children).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, [update]);

  function move(direction: -1 | 1) {
    return (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const el = scrollRef.current;
      if (!el) return;
      const distance = step === 'page' ? el.clientWidth : el.clientWidth * 0.8;
      el.scrollBy({ left: direction * distance, behavior: 'smooth' });
    };
  }

  // 흰 원 바탕 없이 흰 화살표만 (2026-09-29). 밝은 사진 위에서도 보이게 옅은 그림자만 깝니다.
  // 누르는 칸은 32px 그대로 — 아이콘만 커졌습니다.
  const arrowClass =
    'pointer-events-auto absolute top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center text-white opacity-90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] transition-opacity hover:opacity-100 [@media(hover:hover)]:flex';

  return (
    <div className={cn('relative', wrapperClassName)}>
      <div
        ref={scrollRef}
        onScroll={update}
        className={className}
      >
        {children}
      </div>

      {!atStart && (
        <button
          type="button"
          aria-label="이전 사진"
          tabIndex={arrowsFocusable ? undefined : -1}
          onClick={move(-1)}
          className={cn(arrowClass, 'left-3')}
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={2.5} aria-hidden="true" />
        </button>
      )}
      {!atEnd && (
        <button
          type="button"
          aria-label="다음 사진"
          tabIndex={arrowsFocusable ? undefined : -1}
          onClick={move(1)}
          className={cn(arrowClass, 'right-3')}
        >
          <ChevronRight className="h-6 w-6" strokeWidth={2.5} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export function ActionGallery({
  urls,
  thumbnailIndex,
  alt,
  fill = false,
}: {
  urls: string[];
  thumbnailIndex: number;
  alt: string;
  /** 부모가 높이를 고정해둔 곳(카드)에서 쓸 때 true — aspect-[4/3] 대신 부모 높이(h-full)에 맞춘다 */
  fill?: boolean;
}) {
  // 대표 이미지가 맨 앞에 오도록 순서를 바꾼다
  const ordered =
    urls.length > 1 && thumbnailIndex > 0
      ? [urls[thumbnailIndex], ...urls.filter((_, i) => i !== thumbnailIndex)]
      : urls;

  if (ordered.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-neutral-100 text-sm text-neutral-400',
          fill ? 'h-full' : 'aspect-[4/3]',
        )}
      >
        이미지 없음
      </div>
    );
  }

  return (
    <div className={cn('relative', fill && 'h-full')}>
      <ArrowScroller
        wrapperClassName={cn(fill && 'h-full')}
        className={cn(
          'flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          fill && 'h-full',
        )}
        // fill 은 카드(홈·액션 찾기)에서만 씁니다 — 카드는 사진 칸 전체가 링크라 화살표를 Tab 순서에서 뺍니다
        arrowsFocusable={!fill}
      >
        {ordered.map((url, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={url}
            src={url}
            alt={i === 0 ? alt : ''}
            loading={i === 0 ? undefined : 'lazy'}
            className={cn(
              'w-full flex-none snap-center object-cover',
              fill ? 'h-full' : 'aspect-[4/3]',
            )}
          />
        ))}
      </ArrowScroller>

    </div>
  );
}
