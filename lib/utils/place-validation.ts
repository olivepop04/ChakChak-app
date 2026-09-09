/**
 * 활동 장소 검사 — 화면과 서버가 같은 규칙을 쓰기 위한 순수 함수.
 *
 * 「UI 및 기획 수정 4」 25쪽에서 나온 문제입니다.
 *
 *   "장소 설정 안했는데 액션 생성되고 게시됨"
 *   "주소에 '파주'라고만 적었는데도 공개됨"
 *
 * 주소 칸은 주소 검색으로도 채울 수 있지만 **직접 타이핑도 됩니다.**
 * 직접 친 경우를 걸러야 해서 값 자체를 봅니다.
 *
 * ★ 액션 만들기 화면(개발 B)과 공개 전 검수(민호)가 이 함수를 같이 씁니다.
 *   두 곳이 서로 다른 기준을 쓰면 "화면은 통과인데 공개가 안 되는" 일이 생깁니다.
 *
 * ── 2026-09-09 · 두 갈래로 나눴습니다 ──────────────────────────────
 *
 * 전에는 "파주" 라고만 적으면 아예 공개를 막았습니다. 그런데 장소는
 * 넓다·좁다가 딱 잘리지 않습니다. "○○공원", "○○역 3번 출구" 는
 * 도로명 주소가 없어도 참여자가 찾아갈 수 있습니다.
 *
 *   getPlaceErrors()    비었는가        → 막습니다 (BLOCK)
 *   getPlaceWarnings()  찾아갈 만한가   → 알려만 줍니다 (REVISE)
 *
 * 막는 것은 "정말 비었을 때" 뿐이고, 넓은지 좁은지는 알려준 뒤
 * 호스트가 판단합니다. 착한 일을 시작하려는 사람 앞에 벽을 세우지
 * 않기로 했습니다 (Review AI 개선 방향, 2026-09-09).
 */

/** 한국 주소는 최소 "시·도 + 시·군·구" 두 마디입니다 */
const MIN_ADDRESS_PARTS = 2;
/** "파주" 는 2글자. "경기도 파주시" 는 7글자 */
const MIN_ADDRESS_LENGTH = 6;

export interface PlaceInput {
  address?: string | null;
  placeName?: string | null;
}

/**
 * **비어 있는 것만** 돌려줍니다. 여기 걸리면 공개할 수 없습니다.
 * 문제가 없으면 빈 배열입니다.
 */
export function getPlaceErrors({ address, placeName }: PlaceInput): string[] {
  const errors: string[] = [];

  if (!(address ?? '').trim()) {
    errors.push('활동 장소의 주소를 알려주세요. 주소 검색을 쓰면 편합니다.');
  }
  if (!(placeName ?? '').trim()) {
    errors.push('장소 이름을 알려주세요. 예) 성동구민회관, 신라목욕탕');
  }

  return errors;
}

/**
 * **찾아가기 어려워 보이는 것**을 돌려줍니다. 공개를 막지는 않습니다.
 *
 * 주소가 비어 있는 경우는 여기서 다루지 않습니다 — `getPlaceErrors()` 담당입니다.
 */
export function getPlaceWarnings({ address }: PlaceInput): string[] {
  const addr = (address ?? '').trim();
  if (!addr) return [];

  if (addr.split(/\s+/).length < MIN_ADDRESS_PARTS || addr.length < MIN_ADDRESS_LENGTH) {
    return [
      `주소가 "${addr}" 라서 참여자가 어디로 가야 할지 정하기 어려울 수 있어요. 주소 검색으로 한 번 더 골라주시면 참여가 훨씬 쉬워져요.`,
    ];
  }

  return [];
}
