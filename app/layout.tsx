import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { ToastProvider } from '@/components/ui/Toast';
import { BottomNav } from '@/components/layout/BottomNav';

const paperlogy = localFont({
  src: '../public/fonts/Paperlogy-7Bold.woff2',
  variable: '--font-paperlogy',
  display: 'swap',
});

// 본문 폰트(Pretendard) 는 next/font/local 이 아니라 globals.css 의 일반 @font-face 로
// 연결한다. Pretendard 9개 굵기 파일(각 2.6~2.76MB, 한글 완성형 전체 글리프)을
// next/font/local 로 묶으면 빌드 시점 폰트 분석(fallback 메트릭 계산)이 메모리를
// 32GB 까지 먹다가 "JavaScript heap out of memory" 로 dev 서버가 죽는다 — 실측 확인됨.
// Paperlogy 는 파일이 1개라 괜찮았지만 9개는 이 방식과 안 맞는다.

export const metadata: Metadata = {
  title: '착착',
  description: '착한 일을 착착, 쉽고 즐겁게!',
};

/**
 * maximumScale 을 두지 않습니다 (2026-09-09 회의).
 *
 * 전에는 maximumScale: 1 이 있어서 안드로이드에서 두 손가락으로 벌려도
 * 화면이 커지지 않았습니다. 글자가 작다고 느끼는 사람이 손쓸 방법이 없었습니다.
 * 확대를 막지 않는 것이 접근성 기준이기도 합니다.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
  // BottomNav·ChatBoard 의 env(safe-area-inset-bottom) 이 실제 값을 받으려면 필요합니다.
  // 이게 없으면 iOS Safari가 노치·홈 인디케이터 아래로 화면을 확장하지 않아 0으로 계산됩니다.
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className={`antialiased ${paperlogy.variable}`}>
        {/*
          ToastProvider 로 감싸 두었기 때문에 어느 클라이언트 컴포넌트에서든
          useToast() 를 바로 쓸 수 있습니다.
          BottomNav 는 화면에 따라 스스로 숨습니다 (BottomNav.tsx 의 HIDDEN 목록).
        */}
        <ToastProvider>
          <div className="app-shell">{children}</div>
          <BottomNav />
        </ToastProvider>
      </body>
    </html>
  );
}
