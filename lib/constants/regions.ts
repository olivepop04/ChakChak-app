/**
 * 활동 가능 지역 (시·도 → 시·군·구).
 *
 * 저장 형식은 '서울특별시 강남구' 처럼 한 문자열입니다.
 * profiles.regions 가 TEXT[] 라서 여러 곳을 담을 수 있습니다 (집·직장·고향).
 *
 * 상세 주소는 받지 않습니다. 시·군·구까지만입니다.
 *
 * 참고: 광역시와 경기도는 전체를 담았고, 나머지 도는 주요 시·군만 넣었습니다.
 * 시연에 필요한 지역이 빠져 있으면 아래 목록에 추가하면 됩니다.
 */

export const NATIONWIDE = '전국';
export const PROVINCE_WIDE = '전체';

export const REGIONS: Record<string, string[]> = {
  서울특별시: [
    '강남구','강동구','강북구','강서구','관악구','광진구','구로구','금천구',
    '노원구','도봉구','동대문구','동작구','마포구','서대문구','서초구','성동구',
    '성북구','송파구','양천구','영등포구','용산구','은평구','종로구','중구','중랑구',
  ],
  부산광역시: [
    '강서구','금정구','기장군','남구','동구','동래구','부산진구','북구',
    '사상구','사하구','서구','수영구','연제구','영도구','중구','해운대구',
  ],
  대구광역시: ['남구','달서구','달성군','동구','북구','서구','수성구','중구','군위군'],
  인천광역시: [
    '강화군','계양구','미추홀구','남동구','동구','부평구','서구','연수구','옹진군','중구',
  ],
  광주광역시: ['광산구','남구','동구','북구','서구'],
  대전광역시: ['대덕구','동구','서구','유성구','중구'],
  울산광역시: ['중구','남구','동구','북구','울주군'],
  세종특별자치시: ['세종시'],
  경기도: [
    '가평군','고양시','과천시','광명시','광주시','구리시','군포시','김포시',
    '남양주시','동두천시','부천시','성남시','수원시','시흥시','안산시','안성시',
    '안양시','양주시','양평군','여주시','연천군','오산시','용인시','의왕시',
    '의정부시','이천시','파주시','평택시','포천시','하남시','화성시',
  ],
  강원특별자치도: [
    '강릉시','동해시','속초시','원주시','춘천시','태백시','삼척시','홍천군','평창군',
  ],
  충청북도: ['청주시','충주시','제천시','음성군','진천군','옥천군','영동군'],
  충청남도: ['천안시','아산시','서산시','당진시','공주시','논산시','보령시','예산군'],
  전북특별자치도: ['전주시','군산시','익산시','정읍시','남원시','김제시','완주군'],
  전라남도: ['목포시','여수시','순천시','나주시','광양시','담양군','해남군'],
  경상북도: ['포항시','경주시','김천시','안동시','구미시','영주시','경산시','칠곡군'],
  경상남도: ['창원시','진주시','통영시','사천시','김해시','밀양시','거제시','양산시'],
  제주특별자치도: ['제주시','서귀포시'],
};

export const SIDO_LIST = Object.keys(REGIONS);

/** 저장용 문자열로 만든다: ('서울특별시', '강남구') → '서울특별시 강남구' */
export function formatRegion(sido: string, sigungu: string): string {
  return `${sido} ${sigungu}`;
}

/**
 * 지역을 추가할 때 전국·시도 전체·세부 지역이 서로 중복되지 않게 정리한다.
 * 예: 서울 성동구가 있는 상태에서 서울 전체를 고르면 서울 전체 하나만 남는다.
 */
export function mergeRegionSelection(
  current: string[],
  region: string,
  max: number,
): string[] {
  if (region === NATIONWIDE) return [NATIONWIDE];

  const [nextSido, nextSigungu] = region.split(' ');
  let next = current.filter((item) => item !== NATIONWIDE);

  if (nextSigungu === PROVINCE_WIDE) {
    next = next.filter((item) => item.split(' ')[0] !== nextSido);
  } else {
    next = next.filter(
      (item) => item !== formatRegion(nextSido, PROVINCE_WIDE),
    );
  }

  if (next.includes(region)) return next;
  if (next.length >= max) return current;
  return [...next, region];
}

/** 화면에 짧게 보여줄 때: '서울특별시 강남구' → '서울 강남구' */
export function shortRegion(region: string): string {
  if (region === NATIONWIDE) return '전국';
  const [sido, ...rest] = region.split(' ');
  const short = sido
    .replace('특별자치시', '')
    .replace('특별자치도', '')
    .replace('특별시', '')
    .replace('광역시', '')
    .replace('도', '');
  return [short, ...rest].join(' ');
}

/**
 * 시·도 표기를 하나로 맞춥니다 — '서울특별시' 와 '서울' 이 같은 곳이 되게.
 *
 * 저장된 활동 지역은 `REGIONS` 의 정식 이름('서울특별시 강남구')인데,
 * 주소는 우편번호 검색이 주는 줄인 이름('서울 강남구 …')으로도 들어옵니다.
 * '충청북도 → 충북' 처럼 글자를 떼는 것만으로는 안 맞는 곳이 있어 표로 둡니다.
 */
const SIDO_SHORT: Record<string, string> = {
  서울특별시: '서울',
  부산광역시: '부산',
  대구광역시: '대구',
  인천광역시: '인천',
  광주광역시: '광주',
  대전광역시: '대전',
  울산광역시: '울산',
  세종특별자치시: '세종',
  경기도: '경기',
  강원특별자치도: '강원',
  충청북도: '충북',
  충청남도: '충남',
  전북특별자치도: '전북',
  전라남도: '전남',
  경상북도: '경북',
  경상남도: '경남',
  제주특별자치도: '제주',
};

function shortSido(name: string): string {
  return SIDO_SHORT[name] ?? name;
}

/**
 * 액션의 주소(자유 텍스트)가 사용자의 활동 지역과 겹치는지.
 * Discover 추천 점수 계산에 씁니다. 좌표가 없으므로 문자열로만 비교합니다.
 *
 * ★ 시·도를 먼저 맞추고, 시·군·구는 토막 단위로 비교합니다 (2026-10-01).
 *
 *   전에는 시·군·구 이름이 주소 안에 들어 있기만 하면 일치로 봤습니다.
 *   그래서 두 가지가 한꺼번에 틀렸습니다.
 *
 *     「부산광역시 남구」 사용자 → 「서울특별시 강남구」 액션이 가까운 지역
 *       '강남구' 안에 '남구' 가 들어 있어서입니다. 이런 쌍이 9개 있습니다
 *       (남구⊂강남구 · 동구⊂성동구 · 서구⊂강서구 · 양주시⊂남양주시 …).
 *
 *     「부산광역시 남구」 사용자 → 「대구광역시 남구」 액션이 가까운 지역
 *       같은 이름의 구가 여러 시·도에 있습니다 (중구·동구·서구·남구·북구·강서구).
 *
 *   주소에 시·도가 아예 없으면(예: '강남구 테헤란로 1') 예전처럼 시·군·구만 봅니다.
 *   그 경우에도 토막 단위라 '강남구' 가 '남구' 로 걸리지는 않습니다.
 */
export function matchesRegion(address: string | null, userRegions: string[]): boolean {
  if (!address) return false;
  if (userRegions.includes(NATIONWIDE)) return true;

  const tokens = address.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;

  const addressSido = shortSido(tokens[0]);
  const hasSido = SIDO_LIST.some((s) => shortSido(s) === addressSido);
  const rest = hasSido ? tokens.slice(1) : tokens;

  return userRegions.some((r) => {
    const [sido, sigungu] = r.split(' ');
    if (!sigungu) return false;
    if (hasSido && shortSido(sido) !== addressSido) return false;
    if (sigungu === PROVINCE_WIDE) return hasSido;
    // 세종처럼 시·도 아래 지역이 하나뿐이면 주소에 그 이름이 따로 안 적힙니다
    if (hasSido && REGIONS[sido]?.length === 1 && REGIONS[sido][0] === sigungu) {
      return true;
    }
    return rest.includes(sigungu);
  });
}
