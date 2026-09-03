/**
 * MY 페이지 저장한 액션 영역.
 *
 * 초기에는 최신 2개만 세로형(variant="default")으로 표시하며,
 * + 더보기 클릭 시 추가 목록이 가로형(variant="horizontal")으로 확장됩니다.
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ActionCard } from '@/components/ui/ActionCard';
import type { ActionCardData } from '@/lib/types/view';

export function MySavedSection({ saved }: { saved: ActionCardData[] }) {
  const [expanded, setExpanded] = useState(false);

  if (saved.length === 0) {
    return (
      <section className="mt-7">
        <div className="flex items-center justify-between px-5 pb-3">
          <h2 className="text-[15px] font-bold text-neutral-900">
            내가 저장한 액션 <span className="text-neutral-400">0</span>
          </h2>
        </div>
        <p className="mx-5 rounded-xl bg-neutral-50 px-4 py-6 text-center text-[13px] text-neutral-400">
          아직 저장한 액션이 없어요.
        </p>
      </section>
    );
  }

  const initialItems = saved.slice(0, 2);
  const extraItems = saved.slice(2);

  return (
    <section className="mt-7">
      <div className="flex items-center justify-between px-5 pb-3">
        <h2 className="text-[15px] font-bold text-neutral-900">
          내가 저장한 액션{' '}
          <span className="text-neutral-400">{saved.length}</span>
        </h2>
        {saved.length > 2 && (
          <Link href="/my/saved" className="text-[12px] text-neutral-500 hover:text-neutral-900">
            모두 보기 ›
          </Link>
        )}
      </div>

      <div className="flex flex-col gap-4 px-5">
        {/* 초기 2개: 세로형 카드 (variant="default") */}
        {initialItems.map((a) => (
          <ActionCard key={a.id} action={a} variant="default" showStatus />
        ))}

        {/* 더보기 클릭 시 펼쳐지는 추가 목록: 가로형 카드 (variant="horizontal") */}
        {expanded && extraItems.length > 0 && (
          <div className="flex flex-col gap-3 pt-1">
            {extraItems.map((a) => (
              <ActionCard key={a.id} action={a} variant="horizontal" showStatus />
            ))}
          </div>
        )}

        {/* + 더보기 버튼 */}
        {extraItems.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="mt-1 flex h-11 w-full items-center justify-center rounded-xl border border-neutral-200 bg-white text-[13px] font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 active:bg-neutral-100"
          >
            {expanded
              ? '저장한 액션 접기 ▲'
              : `+ 더보기 (저장한 액션 ${extraItems.length}개 더보기)`}
          </button>
        )}
      </div>
    </section>
  );
}
