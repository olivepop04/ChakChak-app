/**
 * 화면 아래에서 잠깐 올라오는 알림.
 *
 * app/layout.tsx 에 <ToastProvider> 가 이미 감싸져 있으니
 * 아무 클라이언트 컴포넌트에서나 훅만 부르면 됩니다.
 *
 *   'use client';
 *   const toast = useToast();
 *
 *   toast('참여가 확정됐어요.');           // 기본
 *   toast(res.message, 'error');           // 실패
 *
 * mutations 함수가 돌려주는 message 를 그대로 넘기면 됩니다.
 */
'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import { cn } from '@/lib/utils/cn';

type ToastTone = 'default' | 'error' | 'success';

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

const ToastContext = createContext<(msg: string, tone?: ToastTone) => void>(
  () => {},
);

export function useToast() {
  return useContext(ToastContext);
}

const TONE: Record<ToastTone, string> = {
  default: 'bg-neutral-900 text-white',
  error: 'bg-red-600 text-white',
  success: 'bg-emerald-600 text-white',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, tone: ToastTone = 'default') => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, message, tone }]);
    // 3초 뒤 자동으로 사라진다
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}

      {/* 하단 탭 및 하단 고정 CTA 버튼보다 위에 띄워지도록 z-index 및 bottom 오프셋 설정 */}
      <div
        className="pointer-events-none fixed left-1/2 -translate-x-1/2 bottom-44 z-50 flex w-full max-w-[calc(100%-32px)] sm:max-w-[calc(480px-32px)] flex-col items-center gap-2"
        role="status"
        aria-live="polite"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto w-full rounded-xl px-4 py-3 text-label font-medium shadow-lg text-center',
              'animate-[toast-in_180ms_ease-out]',
              TONE[t.tone],
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
