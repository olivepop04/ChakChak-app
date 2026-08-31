import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/ui/Toast';
import { BottomNav } from '@/components/layout/BottomNav';

export const metadata: Metadata = {
  title: 'GOOD',
  description: '좋은 일을 찾고, 함께하고, 다시 나누는 곳',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#ffffff',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="antialiased">
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
