/**
 * 날짜 표시.
 *
 * 화면마다 다르게 적으면 "8월 30일" / "8/30" / "2026-08-30" 이 섞입니다.
 * 여기 함수만 쓰세요.
 *
 * DRAFT 액션은 날짜가 비어 있을 수 있어서 전부 null 을 받습니다.
 */

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

/** 8월 30일 (토) */
export function formatDate(iso: string | null): string {
  if (!iso) return '날짜 미정';
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAY[d.getDay()]})`;
}

/** 8월 30일 */
export function formatDateShort(iso: string | null): string {
  if (!iso) return '날짜 미정';
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/**
 * 09:00 · 14:00 — 24시간제로 통일합니다 (2026-09-01 합의).
 * 시(hour)에도 0을 채웁니다. 예전에는 "9:00" 과 "14:00" 이 섞여 보였습니다.
 */
export function formatTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 8월 30일 (토) 14:00–17:00 */
export function formatActivityPeriod(
  startIso: string | null,
  endIso: string | null,
): string {
  if (!startIso) return '일정 미정';
  const start = formatDate(startIso);
  const from = formatTime(startIso);
  if (!endIso) return `${start} ${from}`;

  const s = new Date(startIso);
  const e = new Date(endIso);
  const sameDay = s.toDateString() === e.toDateString();

  return sameDay
    ? `${start} ${from}–${formatTime(endIso)}`
    : `${start} ${from} – ${formatDate(endIso)} ${formatTime(endIso)}`;
}

/** 방금 전 · 3시간 전 · 어제 · 8월 30일 */
export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMin = Math.floor((Date.now() - then) / 60000);

  if (diffMin < 1) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return '어제';
  if (diffDay < 7) return `${diffDay}일 전`;

  return formatDateShort(iso);
}

/** 모집 마감까지 남은 시간. 지났으면 null */
export function timeUntilDeadline(iso: string | null): string | null {
  if (!iso) return null;
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs <= 0) return null;

  const days = Math.floor(diffMs / 86400000);
  if (days >= 1) return `${days}일 남음`;

  const hours = Math.floor(diffMs / 3600000);
  if (hours >= 1) return `${hours}시간 남음`;
  return '곧 마감';
}

/** 모집 마감까지 남은 일수를 D-day 뱃지 문구로. 지났거나 없으면 null */
export function deadlineDDay(iso: string | null): string | null {
  if (!iso) return null;
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs <= 0) return null;
  const days = Math.floor(diffMs / 86400000);
  return days >= 1 ? `D-${days}` : 'D-Day';
}

/** 요일이 주말인가. Discover 추천 점수 계산에 씁니다. */
export function isWeekend(iso: string | null): boolean {
  if (!iso) return false;
  const day = new Date(iso).getDay();
  return day === 0 || day === 6;
}
