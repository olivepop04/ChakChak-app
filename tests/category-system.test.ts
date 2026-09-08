import test from 'node:test';
import assert from 'node:assert/strict';

// 생성 폼 카테고리 상태 관리 시뮬레이션
function createCategoryState(initial: string[] = ['환경']) {
  let categories = [...initial];

  return {
    getCategories: () => [...categories],
    getPrimary: () => categories[0] ?? null,
    select: (cat: string) => {
      if (categories.includes(cat)) {
        if (categories[0] !== cat) {
          // 대표 변경
          categories = [cat, ...categories.filter((c) => c !== cat)];
        }
      } else {
        if (categories.length >= 3) {
          return false; // 최대 3개제한
        }
        categories.push(cat);
      }
      return true;
    },
    deselect: (cat: string) => {
      if (categories.length === 1 && categories[0] === cat) {
        return false; // 최소 1개 유지
      }
      categories = categories.filter((c) => c !== cat);
      return true;
    },
  };
}

test('처음 추가된 카테고리가 자동으로 대표가 된다', () => {
  const state = createCategoryState(['동물']);
  assert.equal(state.getPrimary(), '동물');
  assert.deepEqual(state.getCategories(), ['동물']);
});

test('카테고리를 최대 3개까지 선택할 수 있다', () => {
  const state = createCategoryState(['동물']);
  assert.equal(state.select('환경'), true);
  assert.equal(state.select('지역사회'), true);
  assert.equal(state.select('교육'), false); // 4번째 선택 거부
  assert.deepEqual(state.getCategories(), ['동물', '환경', '지역사회']);
});

test('이미 선택된 카테고리를 클릭하면 대표 카테고리가 해당 카테고리로 변경된다', () => {
  const state = createCategoryState(['동물', '환경', '지역사회']);
  assert.equal(state.getPrimary(), '동물');

  state.select('지역사회');
  assert.equal(state.getPrimary(), '지역사회');
  assert.deepEqual(state.getCategories(), ['지역사회', '동물', '환경']);
});

test('대표 카테고리를 해제하면 다음 카테고리가 자동으로 대표가 된다', () => {
  const state = createCategoryState(['지역사회', '동물', '환경']);
  state.deselect('지역사회');
  assert.equal(state.getPrimary(), '동물');
  assert.deepEqual(state.getCategories(), ['동물', '환경']);
});

test('하나만 남은 카테고리는 해제할 수 없다', () => {
  const state = createCategoryState(['동물']);
  assert.equal(state.deselect('동물'), false);
  assert.deepEqual(state.getCategories(), ['동물']);
});

// 피드 카드 뱃지 노출 수 로직 검증
function getCardBadgeInfo(categories: string[] = [], fallbackCategory = '카테고리') {
  const primaryCategory = (categories && categories[0]) || fallbackCategory;
  const allCategories = categories && categories.length > 0 ? categories : [primaryCategory];
  const extraCount = allCategories.length - 1;
  return { primaryCategory, extraCount };
}

test('피드 카드는 카테고리가 1개일 때 +N 뱃지가 표시되지 않는다', () => {
  const info = getCardBadgeInfo(['지역사회']);
  assert.equal(info.primaryCategory, '지역사회');
  assert.equal(info.extraCount, 0);
});

test('피드 카드는 카테고리가 2개 이상일 때 +N 뱃지 개수를 정확히 계산한다', () => {
  const info2 = getCardBadgeInfo(['지역사회', '환경']);
  assert.equal(info2.primaryCategory, '지역사회');
  assert.equal(info2.extraCount, 1);

  const info3 = getCardBadgeInfo(['지역사회', '환경', '동물']);
  assert.equal(info3.primaryCategory, '지역사회');
  assert.equal(info3.extraCount, 2);
});
