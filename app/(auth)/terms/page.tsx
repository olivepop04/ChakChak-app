import type { Metadata } from 'next';
import { LegalDocumentPage } from '../_legal/LegalDocumentPage';
import { getLegalDocument } from '../_legal/legal-documents';

export const metadata: Metadata = {
  title: '이용약관 | 착착',
  description: '착착 서비스 이용약관',
};

export default function TermsPage() {
  return (
    <LegalDocumentPage
      document={getLegalDocument('terms')}
      otherDocument={{ href: '/privacy', label: '개인정보 처리방침' }}
    />
  );
}
