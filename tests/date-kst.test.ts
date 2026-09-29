/**
 * 날짜 표시는 한국 시간(KST) 고정 — 실행 환경 시간대와 무관해야 합니다.
 *
 * 최지수님이 2026-09-23에 찾은 버그를 지킵니다. `lib/utils/date.ts` 가
 * `getMonth()`·`getHours()` 처럼 **실행 환경 시간대**를 쓰는 함수를 써서,
 * 우리 PC(KST)에서는 맞지만 **배포 서버(UTC)에서 9시간 당겨져** 보였습니다.
 *
 *   토요일 10:00–17:00 활동 → 배포본에서 `9월 26일 (토) 01:00–08:00`
 *
 * 로컬에서는 절대 재현되지 않는 종류라, 아래 기대값을 **KST 로 못박아** 둡니다.
 * 이 파일은 `TZ=UTC npm test` 와 `TZ=Asia/Seoul npm test` 에서 **둘 다** 통과해야
 * 합니다. 한쪽만 통과하면 그 함수가 다시 환경 시간대를 타는 것입니다.
 *
 * 2026-09-26 은 토요일입니다. KST 10:00 = 그날 01:00Z 입니다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDate,
  formatDateShort,
  formatTime,
  formatActivityPeriod,
  isWeekend,
  timeUntilDeadline,
  deadlineDDay,
} from '../lib/utils/date.ts';

test('표시 함수는 KST 기준이다 — 배포(UTC)에서도 같은 값', () => {
  // KST 2026-09-26(토) 10:00
  const sat10 = '2026-09-26T01:00:00Z';

  assert.equal(formatDate(sat10), '9월 26일 (토)');
  assert.equal(formatDateShort(sat10), '9월 26일');
  assert.equal(formatTime(sat10), '10:00');
});

test('활동 시간대가 9시간 당겨지지 않는다 (지수님이 보고한 그 화면)', () => {
  // KST 2026-09-26(토) 10:00–17:00
  const period = formatActivityPeriod(
    '2026-09-26T01:00:00Z',
    '2026-09-26T08:00:00Z',
  );
  assert.equal(period, '9월 26일 (토) 10:00–17:00');

  // 옛 버그가 되살아나면 UTC 환경에서 01:00–08:00 이 됩니다.
  assert.ok(!period.includes('01:00'), '01:00 이 보이면 UTC 로 그린 것입니다');
});

test('KST 자정 근처는 KST 날짜로 그린다', () => {
  // KST 2026-09-26(토) 00:30 = 09-25(금) 15:30Z — UTC 로 읽으면 하루 밀립니다
  assert.equal(formatDate('2026-09-25T15:30:00Z'), '9월 26일 (토)');
  assert.equal(formatTime('2026-09-25T15:30:00Z'), '00:30');

  // KST 2026-09-26(토) 23:30 = 같은 날 14:30Z
  assert.equal(formatDate('2026-09-26T14:30:00Z'), '9월 26일 (토)');
  assert.equal(formatTime('2026-09-26T14:30:00Z'), '23:30');
});

test('UTC 날짜가 갈리는 활동도 같은 날로 묶는다', () => {
  // KST 09-26(토) 06:00–09:00 = 09-25T21:00Z – 09-26T00:00Z (UTC 날짜가 다름)
  assert.equal(
    formatActivityPeriod('2026-09-25T21:00:00Z', '2026-09-26T00:00:00Z'),
    '9월 26일 (토) 06:00–09:00',
  );
});

test('진짜 이틀에 걸친 활동은 긴 형식으로 그린다', () => {
  // KST 09-26(토) 22:00 – 09-27(일) 02:00
  assert.equal(
    formatActivityPeriod('2026-09-26T13:00:00Z', '2026-09-26T17:00:00Z'),
    '9월 26일 (토) 22:00 – 9월 27일 (일) 02:00',
  );
});

test('isWeekend 가 요일을 뒤집지 않는다 — 추천 점수가 여기 걸려 있다', () => {
  // KST 토요일 08:00 = 금요일 23:00Z. UTC 로 읽으면 「평일」 로 뒤집힙니다.
  assert.equal(isWeekend('2026-09-25T23:00:00Z'), true, '토 08:00 은 주말');

  // KST 일요일 01:00 = 토요일 16:00Z
  assert.equal(isWeekend('2026-09-26T16:00:00Z'), true, '일 01:00 은 주말');

  // KST 월요일 08:00 = 일요일 23:00Z — 거꾸로도 뒤집히면 안 됩니다
  assert.equal(isWeekend('2026-09-27T23:00:00Z'), false, '월 08:00 은 평일');

  // KST 금요일 23:00 = 금요일 14:00Z
  assert.equal(isWeekend('2026-09-25T14:00:00Z'), false, '금 23:00 은 평일');

  assert.equal(isWeekend(null), false);
});

test('남은 시간 계산에는 KST 변환을 넣지 않는다 (차이만 본다)', () => {
  const in3days = new Date(Date.now() + 3 * 86400000 + 60000).toISOString();
  assert.equal(timeUntilDeadline(in3days), '3일 남음');
  assert.equal(deadlineDDay(in3days), 'D-3');

  const past = new Date(Date.now() - 60000).toISOString();
  assert.equal(timeUntilDeadline(past), null);
  assert.equal(deadlineDDay(past), null);
});

test('날짜가 없는 DRAFT 는 그대로 안내 문구', () => {
  assert.equal(formatDate(null), '날짜 미정');
  assert.equal(formatDateShort(null), '날짜 미정');
  assert.equal(formatTime(null), '');
  assert.equal(formatActivityPeriod(null, null), '일정 미정');
});

test('date.ts 가 환경 시간대 함수를 다시 쓰지 않는다', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../lib/utils/date.ts', import.meta.url), 'utf8');

  // toKst() 로 옮긴 뒤 getUTC* 로 읽는 것이 규칙입니다.
  for (const banned of ['getMonth()', 'getDate()', 'getDay()', 'getHours()', 'getMinutes()', 'toDateString()']) {
    assert.ok(
      !src.includes(`.${banned}`),
      `date.ts 가 .${banned} 를 씁니다 — 배포(UTC)에서 표시가 틀어집니다. toKst() + getUTC* 를 쓰세요`,
    );
  }
});

test('scoring.ts 도 환경 시간대 함수를 쓰지 않는다 — 추천 점수가 여기 걸려 있다', async () => {
  const { readFileSync } = await import('node:fs');
  const raw = readFileSync(new URL('../lib/utils/scoring.ts', import.meta.url), 'utf8');

  // 2026-09-28 지수님 PR1. 배포(UTC)에서 토요일 오전 10시 활동이 「밤」 으로 판정돼
  // 「주말 오전」 만 되는 사람에게 시간 점수(당시 15점)가 통째로 안 붙었습니다.
  // 함수를 하나씩 불러 보는 대신 소스를 읽습니다 — 나중에 들어온 함수가 getHours() 를 써도 잡힙니다.
  // 주석 안의 설명(「getHours() 가 9시간 어긋났습니다」)은 빼고 코드만 봅니다.
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const banned of ['getMonth()', 'getDate()', 'getDay()', 'getHours()', 'getMinutes()', 'toDateString()']) {
    assert.ok(
      !code.includes(`.${banned}`),
      `scoring.ts 가 .${banned} 를 씁니다 — 배포(UTC)에서 추천 점수가 틀어집니다. KST 로 옮긴 뒤 getUTC* 를 쓰세요 (CLAUDE.md 규칙 17)`,
    );
  }
});
