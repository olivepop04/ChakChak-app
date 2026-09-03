import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildStoredSkills,
  splitStoredSkills,
} from '../app/my/_components/skill-selection.ts';

const FIXED = ['사진 촬영', '요리', '운전'];

test('재능 없음은 빈 배열이고 모르겠음은 null로 구분한다', () => {
  assert.deepEqual(buildStoredSkills(['없음'], '', FIXED), []);
  assert.equal(buildStoredSkills(['모르겠음'], '', FIXED), null);
});

test('고정 재능 여러 개와 기타 직접 입력을 함께 저장한다', () => {
  assert.deepEqual(
    buildStoredSkills(['사진 촬영', '요리', '기타'], '수어 통역', FIXED),
    ['사진 촬영', '요리', '수어 통역'],
  );
});

test('저장된 자유 입력 재능은 기타 입력칸으로 되돌린다', () => {
  assert.deepEqual(
    splitStoredSkills(['사진 촬영', '수어 통역'], FIXED),
    { selected: ['사진 촬영', '기타'], other: '수어 통역' },
  );
});
