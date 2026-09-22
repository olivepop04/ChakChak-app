/**
 * 액션 이미지 갤러리 (최대 3장).
 * 좌우로 스와이프해서 넘기고, 아래 점으로 현재 위치를 표시합니다.
 */
'use client';

import { useRef, useState } from 'react';
import { cn } from '@/lib/utils/cn';

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

  const [current, setCurrent] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setCurrent(Math.round(el.scrollLeft / el.clientWidth));
  }

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
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={cn(
          'flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          fill && 'h-full',
        )}
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
      </div>

      {ordered.length > 1 && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
          {ordered.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === current ? 'w-4 bg-white' : 'w-1.5 bg-white/50'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
