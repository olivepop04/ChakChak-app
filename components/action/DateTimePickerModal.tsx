'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** datetime-local 값(2026-09-24T18:00) → Date. 비어 있으면 지금 시각 */
function parseValue(value: string): Date {
  if (!value) return new Date();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function formatValue(date: Date, hour24: number, minute: number): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(hour24)}:${pad(minute)}`;
}

function isSameDate(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function normalizeHour(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.min(12, Math.max(1, Math.trunc(n))) : 12;
}

function normalizeMinute(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.min(59, Math.max(0, Math.trunc(n))) : 0;
}

/**
 * 날짜·시간 선택 모달 — 브라우저 기본 datetime-local 대신 씀.
 * ActionForm.tsx 의 모집 마감일·활동 시작·활동 종료 3개 필드가 이 컴포넌트를 각각 하나씩 띄워서 공유합니다.
 */
export function DateTimePickerModal({
  open,
  title,
  value,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  value: string;
  onClose: () => void;
  onConfirm: (value: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [period, setPeriod] = useState<'AM' | 'PM'>('AM');
  const [hourDraft, setHourDraft] = useState('12');
  const [minuteDraft, setMinuteDraft] = useState('00');
  const today = useRef(new Date());

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const base = parseValue(value);
    setViewDate(new Date(base.getFullYear(), base.getMonth(), 1));
    setSelectedDate(new Date(base.getFullYear(), base.getMonth(), base.getDate()));
    const h = base.getHours();
    setPeriod(h < 12 ? 'AM' : 'PM');
    setHourDraft(String(h % 12 === 0 ? 12 : h % 12));
    setMinuteDraft(pad(base.getMinutes()));
  }, [open, value]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open]);

  if (!mounted || !open) return null;

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function handleConfirm() {
    const hour12 = normalizeHour(hourDraft);
    const minute = normalizeMinute(minuteDraft);
    const hour24 = period === 'PM' ? (hour12 % 12) + 12 : hour12 % 12;
    onConfirm(formatValue(selectedDate, hour24, minute));
    onClose();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" className="w-full max-w-[342px] rounded-xl bg-white p-5">
        {/* 헤더 */}
        <div className="mb-4 flex items-center justify-between">
          <span className="text-subtitle font-bold text-neutral-900">{title}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        {/* 월 이동 */}
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setViewDate(new Date(year, month - 1, 1))}
            aria-label="이전 달"
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100"
          >
            <ChevronLeft className="h-[18px] w-[18px]" />
          </button>
          <span className="text-label font-bold text-hairline-focus">
            {year}년 {month + 1}월
          </span>
          <button
            type="button"
            onClick={() => setViewDate(new Date(year, month + 1, 1))}
            aria-label="다음 달"
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100"
          >
            <ChevronRight className="h-[18px] w-[18px]" />
          </button>
        </div>

        {/* 요일 헤더 */}
        <div className="mb-1 grid grid-cols-7 gap-[3px]">
          {WEEKDAYS.map((w, i) => (
            <span
              key={w}
              className={`flex h-7 items-center justify-center text-[12px] font-semibold ${
                i === 0 ? 'text-danger' : i === 6 ? 'text-info' : 'text-neutral-500'
              }`}
            >
              {w}
            </span>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div className="mb-4 grid grid-cols-7 gap-[3px]">
          {cells.map((day, i) => {
            if (day === null) return <span key={`blank-${i}`} />;
            const cellDate = new Date(year, month, day);
            const isSelected = isSameDate(cellDate, selectedDate);
            const isToday = isSameDate(cellDate, today.current);
            const dow = cellDate.getDay();
            const weekendColor =
              dow === 0 ? 'text-danger' : dow === 6 ? 'text-info' : 'text-neutral-800';

            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDate(cellDate)}
                className={`flex h-10 items-center justify-center rounded-full text-[12px] ${
                  isSelected
                    ? 'bg-brand font-bold text-white'
                    : isToday
                      ? `border border-neutral-300 font-bold ${weekendColor}`
                      : weekendColor
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>

        <div className="mb-4 h-px bg-neutral-200" />

        {/* 시간 선택 */}
        <div className="mb-5 flex flex-col gap-2">
          <span className="text-label font-semibold text-neutral-500">시간</span>
          <div className="flex items-center gap-2">
            <div className="flex flex-none overflow-hidden rounded-xl border border-neutral-300">
              <button
                type="button"
                onClick={() => setPeriod('AM')}
                className={`flex h-11 min-w-[52px] items-center justify-center text-body font-bold ${
                  period === 'AM' ? 'bg-brand text-white' : 'bg-white text-neutral-400'
                }`}
              >
                오전
              </button>
              <button
                type="button"
                onClick={() => setPeriod('PM')}
                className={`flex h-11 min-w-[52px] items-center justify-center text-body font-bold ${
                  period === 'PM' ? 'bg-brand text-white' : 'bg-white text-neutral-400'
                }`}
              >
                오후
              </button>
            </div>
            <input
              type="number"
              value={hourDraft}
              onChange={(e) => setHourDraft(e.target.value)}
              onBlur={() => setHourDraft(String(normalizeHour(hourDraft)))}
              aria-label="시"
              className="h-11 w-0 min-w-0 flex-1 appearance-none rounded-xl border border-neutral-300 text-center text-body font-bold text-hairline-focus outline-none focus:border-neutral-900 [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="text-body font-bold text-hairline-focus">:</span>
            <input
              type="number"
              value={minuteDraft}
              onChange={(e) => setMinuteDraft(e.target.value)}
              onBlur={() => setMinuteDraft(pad(normalizeMinute(minuteDraft)))}
              aria-label="분"
              className="h-11 w-0 min-w-0 flex-1 appearance-none rounded-xl border border-neutral-300 text-center text-body font-bold text-hairline-focus outline-none focus:border-neutral-900 [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 flex-1 items-center justify-center rounded-xl border border-neutral-300 text-body font-bold text-hairline-focus"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex h-11 flex-1 items-center justify-center rounded-xl bg-brand text-body font-bold text-white"
          >
            선택 완료
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
