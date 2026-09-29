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
import { ChevronRight, MapPin, Plus, X } from 'lucide-react';
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
            // 고른 지역 = 연한 초록 바탕 + 초록 테두리·글자 (2026-09-29 프로필군 통일안, Chip tone="soft" 와 같은 값)
            className="inline-flex min-h-9 items-center gap-1 rounded-full border border-brand bg-brand-soft py-1 pl-3.5 pr-2 text-label font-semibold text-brand"
          >
            {shortRegion(r)}
            <button
              type="button"
              onClick={() => remove(r)}
              aria-label={`${shortRegion(r)} 삭제`}
              className="flex h-6 w-6 items-center justify-center rounded-full text-brand hover:bg-white/60"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </span>
        ))}

        {!isNationwide && value.length < max && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex min-h-9 items-center gap-1 rounded-full border border-dashed border-faint px-3.5 py-1 text-label font-medium text-neutral-800"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            지역 추가
          </button>
        )}
      </div>

      <p className="text-caption text-neutral-500">
        시·도 전체 또는 시·군·구 단위로 최대 {max}곳까지 고를 수 있어요.
        전국을 고르면 모든 지역의 액션을 추천받습니다.
      </p>

      {/* 선택 창 */}
      {open && (
        // 2026-09-29 통일안: 딤 40→50%(모달과 같게) · 위 모서리 16→12px(모서리 두 값 규칙) ·
        // 제목 앞 MapPin · 닫기는 아래 버튼 하나만 — 위쪽 「닫기」는 뺐고, 시·군·구 단계의 「‹ 뒤로」만 남김
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
          <div className="max-h-[70vh] w-full max-w-app overflow-y-auto rounded-t-xl bg-white">
            <div className="sticky top-0 flex items-center justify-between border-b border-neutral-100 bg-white px-6 py-4">
              <h2 className="flex items-center gap-2 text-subtitle font-bold text-neutral-800">
                <MapPin className="h-5 w-5 shrink-0" aria-hidden="true" />
                {sido ? sido : '지역 추가'}
              </h2>
              {sido && (
                <button
                  type="button"
                  onClick={() => setSido(null)}
                  className="min-h-9 px-1 text-label text-neutral-500"
                >
                  ‹ 뒤로
                </button>
              )}
            </div>

            <ul className="divide-y divide-neutral-100">
              {!sido && (
                <li>
                  <button
                    type="button"
                    onClick={() => add(NATIONWIDE)}
                    className="flex w-full items-center justify-between px-6 py-3.5 text-left text-body hover:bg-neutral-50"
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
                        className="flex w-full items-center justify-between px-6 py-3.5 text-left text-body hover:bg-neutral-50"
                      >
                        {s}
                        <ChevronRight className="h-[18px] w-[18px] text-faint" aria-hidden="true" />
                      </button>
                    </li>
                  ))
                : [PROVINCE_WIDE, ...REGIONS[sido]].map((g) => (
                    <li key={g}>
                      <button
                        type="button"
                        onClick={() => add(formatRegion(sido, g))}
                        disabled={value.includes(formatRegion(sido, g))}
                        className="w-full px-6 py-3.5 text-left text-body hover:bg-neutral-50 disabled:text-neutral-300"
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
