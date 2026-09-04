'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { LegalDocument } from './legal-documents';

type LegalDocumentPageProps = {
  document: LegalDocument;
  otherDocument: {
    href: '/terms' | '/privacy';
    label: string;
  };
};

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
      <header className="sticky top-0 z-20 flex h-14 items-center border-b border-neutral-100 bg-white/95 px-4 backdrop-blur">
        {/*
          홈으로 보냅니다. 이 화면은 두 곳에서 열립니다 —
          MY(회원)와 가입 3단계(아직 회원 아님). 어느 한쪽으로 고정하면
          다른 쪽이 막힙니다. /my 는 로그인이 필요해서 가입 중인 사람이
          누르면 로그인 화면으로 튕기고, /signup 은 회원이 가입 화면으로 갑니다.
          홈은 비회원도 볼 수 있어 양쪽 다 됩니다.
        */}
        <Link
          href="/"
          aria-label="홈으로 돌아가기"
          className="flex h-10 w-10 items-center justify-center rounded-full text-2xl text-neutral-700 hover:bg-neutral-100"
        >
          ‹
        </Link>
        <p className="absolute left-1/2 -translate-x-1/2 text-[15px] font-semibold text-neutral-900">
          약관 안내
        </p>
      </header>

      <article className="px-5 pb-8 pt-8">
        <div className="border-b border-neutral-200 pb-7">
          <p className="text-[12px] font-semibold tracking-wide text-neutral-400">
            CHAKCHAK POLICY
          </p>
          <h1 className="mt-2 text-[26px] font-bold tracking-tight text-neutral-900">
            {document.title}
          </h1>
          <span className="mt-3 inline-flex rounded-full bg-neutral-100 px-3 py-1.5 text-[12px] font-medium text-neutral-600">
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
                  className="text-[16px] font-bold leading-relaxed text-neutral-900"
                >
                  {section.title}
                </h2>
                <div className="mt-3 space-y-2.5">
                  {section.blocks.map((block, index) =>
                    block.type === 'bullet' ? (
                      <p
                        key={`${section.title}-${index}`}
                        className="flex gap-2 pl-1 text-[14px] leading-7 text-neutral-600"
                      >
                        <span aria-hidden="true" className="shrink-0">
                          •
                        </span>
                        <span>{block.text}</span>
                      </p>
                    ) : (
                      <p
                        key={`${section.title}-${index}`}
                        className="whitespace-pre-line text-[14px] leading-7 text-neutral-600"
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

      <div className="mx-5 border-t border-neutral-200 pt-6 text-center">
        <Link
          href={otherDocument.href}
          className="text-[13px] font-semibold text-neutral-600 underline underline-offset-4 hover:text-neutral-900"
        >
          {otherDocument.label}도 확인하기
        </Link>
      </div>

      {showTopBtn && (
        <button
          type="button"
          onClick={scrollToTop}
          aria-label="맨 위로 이동"
          className="fixed bottom-6 right-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-lg font-bold text-neutral-700 shadow-lg transition-all active:scale-95 hover:bg-neutral-50"
        >
          ↑
        </button>
      )}
    </main>
  );
}
