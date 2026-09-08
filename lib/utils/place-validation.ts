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
 * 문제가 있으면 사람이 읽을 수 있는 한국어 문장으로 돌려줍니다.
 * 문제가 없으면 빈 배열입니다.
 */
export function getPlaceErrors({ address, placeName }: PlaceInput): string[] {
  const errors: string[] = [];

  const addr = (address ?? '').trim();
  if (!addr) {
    errors.push('활동 장소의 주소를 입력해주세요. 주소 검색을 쓰면 편합니다.');
  } else if (
    addr.split(/\s+/).length < MIN_ADDRESS_PARTS ||
    addr.length < MIN_ADDRESS_LENGTH
  ) {
    // 참여자가 그날 찾아갈 수 없는 주소입니다.
    // 반대로 상세 집주소(동·호)까지 적는 것은 개인정보라 AI 가 따로 봅니다.
    errors.push(
      `주소가 "${addr}" 뿐이라 참여자가 어디로 가야 할지 알 수 없어요. 주소 검색으로 다시 골라주세요.`,
    );
  }

  if (!(placeName ?? '').trim()) {
    errors.push('장소 이름을 입력해주세요. 예) 성동구민회관, 신라목욕탕');
  }

  return errors;
}
