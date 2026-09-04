import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getLegalDocument,
  type LegalDocumentSlug,
} from '../app/(auth)/_legal/legal-documents.ts';

test('공개 경로에 맞는 약관 문서를 돌려준다', () => {
  const cases: Array<{
    slug: LegalDocumentSlug;
    title: string;
    firstSection: string;
  }> = [
    {
      slug: 'terms',
      title: '착착 이용약관',
      firstSection: '제1조 (목적)',
    },
    {
      slug: 'privacy',
      title: '착착 개인정보 처리방침',
      firstSection: '제1조 (개인정보 처리방침의 목적)',
    },
  ];

  for (const expected of cases) {
    const document = getLegalDocument(expected.slug);
    assert.equal(document.title, expected.title);
    assert.equal(document.version, '버전 0.1 · MVP용');
    assert.equal(document.sections[0]?.title, expected.firstSection);
    assert.equal(document.sections.at(-1)?.title, '부칙');
  }
});

test('정의하지 않은 문서 주소는 제공하지 않는다', () => {
  assert.equal(getLegalDocument('unknown'), undefined);
});

test('개인정보 처리방침은 목록 항목을 문단과 구분해 유지한다', () => {
  const privacy = getLegalDocument('privacy');
  const collection = privacy?.sections.find(
    (section) => section.title === '제3조 (처리하는 개인정보의 항목)',
  );

  assert.ok(collection);
  assert.ok(collection.blocks.some((block) => block.type === 'bullet'));
  assert.ok(collection.blocks.some((block) => block.type === 'paragraph'));
});
