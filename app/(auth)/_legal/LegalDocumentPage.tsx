'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowUp } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import type { LegalDocument } from './legal-documents';

type LegalDocumentPageProps = {
  document: LegalDocument;
  otherDocument: {
    href: '/terms' | '/privacy';
    label: string;
  };
};

// 2026-09-30 Day19 인증군 통일안 — 따로 그리던 헤더(글자 「‹」 + 아래 선)를 공용 상단 바로 교체.
// 「어디서 왔나(from)」 에 따라 돌아갈 곳을 고르는 로직은 그대로 두고 fallbackHref 로만 넘깁니다.
// (Header 도 history 가 있으면 router.back(), 없으면 fallbackHref 로 갑니다 — 전과 같은 동작)
function LegalHeader({ title }: { title: LegalDocument['headerTitle'] }) {
  const searchParams = useSearchParams();
  const from = searchParams.get('from');

  let fallbackHref = '/my';
  if (from === 'signup') {
    fallbackHref = '/signup';
  } else if (from === 'my') {
    fallbackHref = '/my';
  }

  return <Header title={title} back fallbackHref={fallbackHref} sticky asH1={false} />;
}

function OtherDocumentLink({
  otherDocument,
}: {
  otherDocument: LegalDocumentPageProps['otherDocument'];
}) {
  const searchParams = useSearchParams();
  const from = searchParams.get('from');
  const href = from ? `${otherDocument.href}?from=${from}` : otherDocument.href;

  return (
    <div className="mx-6 border-t border-neutral-100 pt-6 text-center">
      <Link
        href={href}
        className="text-label font-semibold text-neutral-600 underline underline-offset-4 hover:text-neutral-900"
      >
        {otherDocument.label}도 확인하기
      </Link>
    </div>
  );
}

export function LegalDocumentPage({
  document,
  otherDocument,
}: LegalDocumentPageProps) {
  const [showTopBtn, setShowTopBtn] = useState(false);

  useEffect(() => {
    function handleScroll() {
      if (window.scrollY > 200) {
        setShowTopBtn(true);
      } else {
        setShowTopBtn(false);
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <main className="min-h-dvh bg-white pb-8">
      <Suspense
        fallback={<Header title={document.headerTitle} back fallbackHref="/my" sticky asH1={false} />}
      >
        <LegalHeader title={document.headerTitle} />
      </Suspense>

      <article className="px-6 pb-8 pt-8">
        <div className="border-b border-neutral-100 pb-6">
          <p className="text-caption font-semibold tracking-wide text-neutral-400">
            CHAKCHAK POLICY
          </p>
          <h1 className="mt-2 font-paperlogy text-2xl font-extrabold text-[#333333]">
            {document.title}
          </h1>
          <span className="mt-3 inline-flex rounded-full bg-neutral-100 px-3 py-1.5 text-caption font-medium text-neutral-600">
            {document.version}
          </span>
        </div>

        <div className="space-y-8 pt-8">
          {document.sections.map((section, sectionIndex) => {
            const sectionId = `legal-section-${sectionIndex + 1}`;

            return (
              <section key={section.title} aria-labelledby={sectionId}>
                <h2
                  id={sectionId}
                  className="text-subtitle font-bold leading-relaxed text-[#333333]"
                >
                  {section.title}
                </h2>
                <div className="mt-3 space-y-2.5">
                  {section.blocks.map((block, index) =>
                    block.type === 'bullet' ? (
                      <p
                        key={`${section.title}-${index}`}
                        className="flex gap-2 pl-1 text-body leading-7 text-neutral-600"
                      >
                        <span aria-hidden="true" className="shrink-0">
                          •
                        </span>
                        <span>{block.text}</span>
                      </p>
                    ) : (
                      <p
                        key={`${section.title}-${index}`}
                        className="whitespace-pre-line text-body leading-7 text-neutral-600"
                      >
                        {block.text}
                      </p>
                    ),
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </article>

      <Suspense
        fallback={
          <div className="mx-6 border-t border-neutral-100 pt-6 text-center">
            <Link
              href={otherDocument.href}
              className="text-label font-semibold text-neutral-600 underline underline-offset-4 hover:text-neutral-900"
            >
              {otherDocument.label}도 확인하기
            </Link>
          </div>
        }
      >
        <OtherDocumentLink otherDocument={otherDocument} />
      </Suspense>

      {showTopBtn && (
        <button
          type="button"
          onClick={scrollToTop}
          aria-label="맨 위로 이동"
          // 글자 「↑」 → lucide ArrowUp · 누르는 칸 44px (2026-09-30)
          className="fixed bottom-6 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-white text-[#333333] transition-all active:scale-95 hover:bg-neutral-50"
        >
          <ArrowUp className="h-5 w-5" aria-hidden="true" />
        </button>
      )}
    </main>
  );
}
