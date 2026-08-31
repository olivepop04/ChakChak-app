/**
 * 액션 이미지 갤러리 (최대 3장).
 * 좌우로 스와이프해서 넘기고, 아래 점으로 현재 위치를 표시합니다.
 */
'use client';

import { useRef, useState } from 'react';

export function ActionGallery({
  urls,
  thumbnailIndex,
  alt,
}: {
  urls: string[];
  thumbnailIndex: number;
  alt: string;
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
      <div className="flex aspect-[4/3] items-center justify-center bg-neutral-100 text-sm text-neutral-400">
        이미지 없음
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {ordered.map((url, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={url}
            src={url}
            alt={i === 0 ? alt : ''}
            className="aspect-[4/3] w-full flex-none snap-center object-cover"
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
