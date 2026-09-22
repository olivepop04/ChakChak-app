'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { LegalDocument } from './legal-documents';

type LegalDocumentPageProps = {
  document: LegalDocument;
  otherDocument: {
    href: '/terms' | '/privacy';
    label: string;
  };
};

function LegalHeader({ title }: { title: LegalDocument['headerTitle'] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from');

  let fallbackHref = '/my';
  if (from === 'signup') {
    fallbackHref = '/signup';
  } else if (from === 'my') {
    fallbackHref = '/my';
  }

  function handleBack(e: React.MouseEvent<HTMLAnchorElement>) {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      e.preventDefault();
      router.back();
    }
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center border-b border-neutral-100 bg-white/95 px-4 backdrop-blur">
      <Link
        href={fallbackHref}
        onClick={handleBack}
        aria-label="이전 페이지로 돌아가기"
        className="flex h-10 w-10 items-center justify-center rounded-full text-2xl text-neutral-700 hover:bg-neutral-100"
      >
        ‹
      </Link>
      <p className="ml-2 text-body font-semibold text-neutral-900">
        {title}
      </p>
    </header>
  );
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
    <div className="mx-5 border-t border-neutral-200 pt-6 text-center">
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
    <main className="min-h-dvh bg-white pb-12">
      <Suspense
        fallback={
          <header className="sticky top-0 z-20 flex h-14 items-center border-b border-neutral-100 bg-white/95 px-4 backdrop-blur">
            <Link
              href="/my"
              aria-label="이전 페이지로 돌아가기"
              className="flex h-10 w-10 items-center justify-center rounded-full text-2xl text-neutral-700 hover:bg-neutral-100"
            >
              ‹
            </Link>
            <p className="ml-2 text-body font-semibold text-neutral-900">
              {document.headerTitle}
            </p>
          </header>
        }
      >
        <LegalHeader title={document.headerTitle} />
      </Suspense>

      <article className="px-5 pb-8 pt-8">
        <div className="border-b border-neutral-200 pb-7">
          <p className="text-caption font-semibold tracking-wide text-neutral-400">
            CHAKCHAK POLICY
          </p>
          <h1 className="mt-2 text-[26px] font-bold tracking-tight text-neutral-900">
            {document.title}
          </h1>
          <span className="mt-3 inline-flex rounded-full bg-neutral-100 px-3 py-1.5 text-caption font-medium text-neutral-600">
            {document.version}
          </span>
        </div>

        <div className="space-y-9 pt-8">
          {document.sections.map((section, sectionIndex) => {
            const sectionId = `legal-section-${sectionIndex + 1}`;

            return (
              <section key={section.title} aria-labelledby={sectionId}>
                <h2
                  id={sectionId}
                  className="text-subtitle font-bold leading-relaxed text-neutral-900"
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
          <div className="mx-5 border-t border-neutral-200 pt-6 text-center">
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
          className="fixed bottom-6 right-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-lg font-bold text-neutral-700 transition-all active:scale-95 hover:bg-neutral-50"
        >
          ↑
        </button>
      )}
    </main>
  );
}
