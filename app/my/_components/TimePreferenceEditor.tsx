'use client';

import { Plus, TriangleAlert } from 'lucide-react';
import { ChipGroup } from '@/components/ui/Chip';
import { FieldLabel } from '@/components/ui/FieldLabel';
import {
  TIME_DAYS,
  TIME_SLOTS,
  describeTimePref,
  type TimeDay,
  type TimePref,
  type TimeSlot,
} from '@/lib/constants';

export function TimePreferenceEditor({
  value,
  onChange,
}: {
  value: TimePref[];
  onChange: (next: TimePref[]) => void;
}) {
  function changeDay(index: number, day: TimeDay) {
    const current = value[index];
    if (!current) return;

    // "상관없음"은 다른 요일 조합과 동시에 둘 필요가 없습니다.
    if (day === '상관없음') {
      onChange([{ day, slots: current.slots }]);
      return;
    }

    const next = [...value];
    next[index] = { ...current, day };
    onChange(next);
  }

  function toggleSlot(index: number, slot: TimeSlot) {
    const current = value[index];
    if (!current) return;

    let slots: TimeSlot[];
    if (slot === '상관없음') {
      slots = current.slots.includes(slot) ? [] : ['상관없음'];
    } else {
      const withoutAny = current.slots.filter((s) => s !== '상관없음');
      slots = withoutAny.includes(slot)
        ? withoutAny.filter((s) => s !== slot)
        : [...withoutAny, slot];
    }

    const next = [...value];
    next[index] = { ...current, slots };
    onChange(next);
  }

  function addPreference() {
    const used = new Set(value.map((pref) => pref.day));
    const day = TIME_DAYS.find((candidate) => !used.has(candidate));
    if (!day) return;
    onChange([...value, { day, slots: ['상관없음'] }]);
  }

  function removePreference(index: number) {
    onChange(value.filter((_, currentIndex) => currentIndex !== index));
  }

  const hasAnyDay = value.some((pref) => pref.day === '상관없음');
  const canAdd = !hasAnyDay && value.length < 2;
  const summary = value
    .filter((pref) => pref.slots.length > 0)
    .map(describeTimePref)
    .join(', ');

  return (
    <div className="flex flex-col gap-3">
      {value.map((pref, index) => (
        <div
          key={`${pref.day}-${index}`}
          className="rounded-xl bg-neutral-100 p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <FieldLabel className="text-neutral-800">선호시간 {index + 1}</FieldLabel>
            {value.length > 1 && (
              <button
                type="button"
                onClick={() => removePreference(index)}
                className="min-h-8 px-1 text-label font-medium text-neutral-500 hover:text-neutral-800"
              >
                삭제
              </button>
            )}
          </div>

          <div className="mt-3 flex flex-col gap-2">
            <span className="text-label text-neutral-500">1. 가능한 요일</span>
            <div className="flex gap-2">
              {TIME_DAYS.map((day) => {
                const usedByOther = value.some(
                  (other, otherIndex) => otherIndex !== index && other.day === day,
                );
                return (
                  <button
                    key={day}
                    type="button"
                    disabled={usedByOther}
                    aria-pressed={pref.day === day}
                    onClick={() => changeDay(index, day)}
                    // 선택 = 초록 채움 (요일·시간대는 초록 채움, 재능·카테고리·지역은 연한 초록 — 2026-09-29 확정)
                    className={`flex min-h-11 flex-1 items-center justify-center rounded-xl border py-3 text-label transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                      pref.day === day
                        ? 'border-brand bg-brand font-semibold text-white'
                        : 'border-hairline bg-white font-medium text-neutral-500'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <span className="text-label text-neutral-500">
              2. 가능한 시간대 · 여러 개 선택 가능
            </span>
            <ChipGroup
              options={TIME_SLOTS}
              tone="accent"
              selected={pref.slots}
              onToggle={(slot) => toggleSlot(index, slot)}
            />
          </div>
        </div>
      ))}

      {value.length === 0 && (
        // 주의 토큰(warning) — 확인 모달의 노란 칸과 같은 모양 (2026-09-29, amber 기본색 정리)
        <p className="flex items-center gap-2 rounded-xl border border-warning bg-warning-soft px-3 py-2.5 text-label font-medium text-warning-ink">
          <span className="flex h-6 w-6 flex-none items-center justify-center rounded-lg bg-warning">
            <TriangleAlert className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
          </span>
          선호시간을 한 개 이상 추가해주세요.
        </p>
      )}

      {(canAdd || value.length === 0) && (
        <button
          type="button"
          onClick={addPreference}
          className="flex min-h-11 items-center justify-center gap-1 rounded-xl border border-dashed border-faint py-3 text-body font-semibold text-neutral-800 hover:bg-neutral-50"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          선호시간 추가
        </button>
      )}

      {summary && (
        <p className="rounded-xl bg-brand-soft px-4 py-3 text-label leading-normal text-neutral-800">
          선택한 시간: <b className="font-bold text-brand">{summary}</b>
        </p>
      )}
    </div>
  );
}
