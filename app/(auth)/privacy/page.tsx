import type { Metadata } from 'next';
import { LegalDocumentPage } from '../_legal/LegalDocumentPage';
import { getLegalDocument } from '../_legal/legal-documents';

export const metadata: Metadata = {
  title: '개인정보 처리방침 | 착착',
  description: '착착 개인정보 처리방침',
};

export default function PrivacyPage() {
  return (
    <LegalDocumentPage
      document={getLegalDocument('privacy')}
      otherDocument={{ href: '/terms', label: '이용약관' }}
    />
  );
}
