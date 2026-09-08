/**
 * 활동 가능 지역 선택.
 *
 * 전국 전체 → 시·도 → 시·군·구 순으로 고르고, 여러 곳을 담을 수 있습니다.
 * (집·직장·고향처럼 생활권이 여러 개일 수 있어서요)
 *
 *   <RegionPicker value={regions} onChange={setRegions} />
 */
'use client';

import { useState } from 'react';
import {
  REGIONS,
  SIDO_LIST,
  NATIONWIDE,
  PROVINCE_WIDE,
  formatRegion,
  mergeRegionSelection,
  shortRegion,
} from '@/lib/constants/regions';
import { Button } from '@/components/ui/Button';

export function RegionPicker({
  value,
  onChange,
  max = 5,
}: {
  value: string[];
  onChange: (regions: string[]) => void;
  max?: number;
}) {
  const [open, setOpen] = useState(false);
  const [sido, setSido] = useState<string | null>(null);

  const isNationwide = value.includes(NATIONWIDE);

  function add(region: string) {
    onChange(mergeRegionSelection(value, region, max));
    setOpen(false);
    setSido(null);
  }

  function remove(region: string) {
    onChange(value.filter((v) => v !== region));
  }

  return (
    <div className="flex flex-col gap-2">
      {/* 고른 지역들 */}
      <div className="flex flex-wrap gap-2">
        {value.map((r) => (
          <span
            key={r}
            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-[13px] font-medium text-white"
          >
            {shortRegion(r)}
            <button
              type="button"
              onClick={() => remove(r)}
              aria-label={`${shortRegion(r)} 삭제`}
              className="text-white/70 hover:text-white"
            >
              ×
            </button>
          </span>
        ))}

        {!isNationwide && value.length < max && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-full border border-dashed border-neutral-300 px-3 py-1.5 text-[13px] text-neutral-500"
          >
            ＋ 지역 추가
          </button>
        )}
      </div>

      <p className="text-[11px] text-neutral-400">
        시·도 전체 또는 시·군·구 단위로 최대 {max}곳까지 고를 수 있어요.
        전국을 고르면 모든 지역의 액션을 추천받습니다.
      </p>

      {/* 선택 창 */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div className="max-h-[70vh] w-full max-w-app overflow-y-auto rounded-t-2xl bg-white">
            <div className="sticky top-0 flex items-center justify-between border-b border-neutral-100 bg-white px-5 py-4">
              <h2 className="text-[15px] font-semibold">
                {sido ? sido : '지역 추가'}
              </h2>
              <button
                type="button"
                onClick={() => (sido ? setSido(null) : setOpen(false))}
                className="text-[13px] text-neutral-500"
              >
                {sido ? '‹ 뒤로' : '닫기'}
              </button>
            </div>

            <ul className="divide-y divide-neutral-100">
              {!sido && (
                <li>
                  <button
                    type="button"
                    onClick={() => add(NATIONWIDE)}
                    className="flex w-full items-center justify-between px-5 py-3.5 text-left text-[15px] hover:bg-neutral-50"
                  >
                    전국 전체
                  </button>
                </li>
              )}

              {!sido
                ? SIDO_LIST.map((s) => (
                    <li key={s}>
                      <button
                        type="button"
                        onClick={() => setSido(s)}
                        className="flex w-full items-center justify-between px-5 py-3.5 text-left text-[15px] hover:bg-neutral-50"
                      >
                        {s}
                        <span className="text-neutral-300">›</span>
                      </button>
                    </li>
                  ))
                : [PROVINCE_WIDE, ...REGIONS[sido]].map((g) => (
                    <li key={g}>
                      <button
                        type="button"
                        onClick={() => add(formatRegion(sido, g))}
                        disabled={value.includes(formatRegion(sido, g))}
                        className="w-full px-5 py-3.5 text-left text-[15px] hover:bg-neutral-50 disabled:text-neutral-300"
                      >
                        {g === PROVINCE_WIDE ? `${sido} 전체` : g}
                      </button>
                    </li>
                  ))}
            </ul>

            <div className="sticky bottom-0 border-t border-neutral-100 bg-white p-4">
              <Button
                type="button"
                variant="secondary"
                fullWidth
                onClick={() => {
                  setOpen(false);
                  setSido(null);
                }}
              >
                닫기
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
