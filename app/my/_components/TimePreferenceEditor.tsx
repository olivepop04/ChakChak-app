'use client';

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
          className="rounded-xl border border-neutral-200 bg-neutral-50 p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <FieldLabel>선호시간 {index + 1}</FieldLabel>
            {value.length > 1 && (
              <button
                type="button"
                onClick={() => removePreference(index)}
                className="text-label font-medium text-neutral-400 hover:text-red-500"
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
                    className={`flex min-h-11 flex-1 items-center justify-center rounded-xl border py-3 text-label font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                      pref.day === day
                        ? 'border-neutral-900 bg-neutral-900 text-white'
                        : 'border-neutral-300 bg-white text-neutral-600'
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
              selected={pref.slots}
              onToggle={(slot) => toggleSlot(index, slot)}
            />
          </div>
        </div>
      ))}

      {value.length === 0 && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-caption text-amber-700">
          선호시간을 한 개 이상 추가해주세요.
        </p>
      )}

      {(canAdd || value.length === 0) && (
        <button
          type="button"
          onClick={addPreference}
          className="flex min-h-11 items-center justify-center rounded-xl border border-dashed border-neutral-300 py-3 text-label font-semibold text-neutral-600 hover:bg-neutral-50"
        >
          + 선호시간 추가
        </button>
      )}

      {summary && (
        <p className="rounded-xl bg-neutral-100 px-4 py-3 text-caption leading-relaxed text-neutral-600">
          선택한 시간: <b className="font-semibold text-neutral-900">{summary}</b>
        </p>
      )}
    </div>
  );
}
