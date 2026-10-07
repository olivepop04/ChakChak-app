/**
 * 날짜 표시.
 *
 * 화면마다 다르게 적으면 "8월 30일" / "8/30" / "2026-08-30" 이 섞입니다.
 * 여기 함수만 쓰세요.
 *
 * DRAFT 액션은 날짜가 비어 있을 수 있어서 전부 null 을 받습니다.
 *
 * ★ 표시는 **한국 시간(KST) 고정**입니다 (2026-09-24).
 *
 *   전에는 `getMonth()`·`getHours()` 처럼 **실행 환경의 시간대**를 쓰는 함수를 썼습니다.
 *   우리 PC 는 KST 라 로컬에서는 맞았지만, **배포 서버는 UTC 로 돌기 때문에
 *   서버 컴포넌트에서 그린 날짜·시각이 9시간 당겨져 보였습니다.**
 *
 *     토요일 10:00–17:00 활동 → 로컬(KST) 9월 26일 (토) 10:00–17:00
 *                             → 배포(UTC) 9월 26일 (토) 01:00–08:00
 *
 *   저장소 어디에도 TZ 설정이 없어서 배포본은 UTC 입니다. `TZ=UTC` 로 실제
 *   재현했습니다. 최지수님이 찾아주셨습니다 (2026-09-23 건의 참고 항목).
 *
 *   한국은 1988년 이후 일광절약시간이 없어서 **+9 고정**이 정확합니다.
 *   덤으로 서버와 클라이언트가 같은 값을 그리게 되어, 브라우저 시간대가
 *   KST 가 아닌 사용자에게서 나던 서버/클라이언트 표시 불일치도 없어집니다.
 *
 *   **새 함수를 넣을 때도 `getMonth()`·`getHours()` 류를 직접 쓰지 마세요.**
 *   아래 `toKst()` 로 옮긴 뒤 `getUTC*` 로 읽으면 됩니다.
 */

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

/** KST = UTC+9. 한국은 일광절약시간이 없어 고정값이 정확합니다. */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * ISO 문자열을 KST 로 옮긴 Date.
 *
 * **반드시 `getUTC*` 로 읽으세요.** 옮긴 값을 `getHours()` 로 읽으면
 * 로컬 시간대가 한 번 더 더해져서 두 번 틀립니다.
 */
function toKst(iso: string): Date {
  return new Date(new Date(iso).getTime() + KST_OFFSET_MS);
}

/** 8월 30일 (토) */
export function formatDate(iso: string | null): string {
  if (!iso) return '날짜 미정';
  const d = toKst(iso);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${WEEKDAY[d.getUTCDay()]})`;
}

/** 8월 30일 */
export function formatDateShort(iso: string | null): string {
  if (!iso) return '날짜 미정';
  const d = toKst(iso);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
}

/**
 * 09:00 · 14:00 — 24시간제로 통일합니다 (2026-09-01 합의).
 * 시(hour)에도 0을 채웁니다. 예전에는 "9:00" 과 "14:00" 이 섞여 보였습니다.
 */
export function formatTime(iso: string | null): string {
  if (!iso) return '';
  const d = toKst(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
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

  // 같은 날인지도 KST 기준으로 봅니다. `toDateString()` 은 로컬 시간대를 써서,
  // 배포(UTC)에서는 KST 자정 근처 활동이 이틀에 걸친 것처럼 갈라졌습니다.
  const s = toKst(startIso);
  const e = toKst(endIso);
  const sameDay =
    s.getUTCFullYear() === e.getUTCFullYear() &&
    s.getUTCMonth() === e.getUTCMonth() &&
    s.getUTCDate() === e.getUTCDate();

  return sameDay
    ? `${start} ${from}–${formatTime(endIso)}`
    : `${start} ${from} – ${formatDate(endIso)} ${formatTime(endIso)}`;
}

/**
 * 방금 전 · 3시간 전 · 어제 · 8월 30일
 *
 * 앞부분은 두 시각의 **차이**라 시간대와 무관합니다. 7일이 넘어가면
 * `formatDateShort` 로 넘기므로 그때부터 KST 표시가 됩니다.
 */
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

/**
 * 모집 마감까지 남은 시간. 지났으면 null
 *
 * **시간대와 무관합니다** — 두 시각의 차이만 봅니다. KST 변환을 넣지 마세요.
 */
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

/**
 * 모집 마감까지 남은 **날짜 수**를 D-day 뱃지 문구로. 지났거나 없으면 null
 *
 *   마감이 오늘(KST)  → 'D-Day'
 *   마감이 내일(KST)  → 'D-1'   — 남은 시간이 24시간보다 짧아도
 *
 * **KST 달력 날짜로 셉니다** (2026-10-06 고침). 전에는 남은 시간을 24시간으로 나눠서,
 * 지금 10월 6일 15:25 · 마감 10월 7일 14:00 이면 22시간 남아 「D-Day」 가 떴습니다.
 * 같은 화면의 「모집 일정 — 10월 7일 (수)까지」 와 어긋났습니다 (지수님 보고).
 * 날짜를 보므로 시간대가 필요합니다 — 배포(UTC)에서도 한국 날짜로 셉니다.
 *
 * @param now 시험용. 화면에서는 넘기지 마세요.
 */
export function deadlineDDay(iso: string | null, now: Date = new Date()): string | null {
  if (!iso) return null;
  const end = new Date(iso).getTime();
  if (end <= now.getTime()) return null;
  const days = kstDayNumber(end) - kstDayNumber(now.getTime());
  return days >= 1 ? `D-${days}` : 'D-Day';
}

/** KST 기준으로 1970-01-01 부터 며칠째인지. 두 값의 차이가 달력 날짜 차이입니다 */
function kstDayNumber(ms: number): number {
  return Math.floor((ms + KST_OFFSET_MS) / 86400000);
}

/**
 * 요일이 주말인가. Discover 추천 점수 계산에 씁니다.
 *
 * **여기가 틀리면 점수가 반대로 붙습니다.** `lib/utils/scoring.ts` 가 이 함수로
 * 주말·평일을 갈라 참여 가능 시간 점수를 주는데, 배포(UTC)에서는 토요일 오전 8시
 * 활동이 금요일 밤으로 밀려 **평일로 판정**됐습니다. KST 고정으로 고쳤습니다.
 */
export function isWeekend(iso: string | null): boolean {
  if (!iso) return false;
  const day = toKst(iso).getUTCDay();
  return day === 0 || day === 6;
}
