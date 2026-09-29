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
import { CircleAlert, CircleCheck, type LucideIcon } from 'lucide-react';

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

/**
 * 2026-09-30 오버레이 통일안 — 판은 셋 다 #333, 종류는 앞 아이콘 색으로만 구분.
 * 에러 판을 danger(#EA764B)로 칠하면 흰 글자 대비가 2.9:1 이라 못 읽습니다.
 * (전에는 에러가 토큰에 없는 red-600 이었습니다.)
 */
const TONE_ICON: Record<ToastTone, { icon: LucideIcon; className: string } | null> = {
  default: null,
  success: { icon: CircleCheck, className: 'text-brand' },
  error: { icon: CircleAlert, className: 'text-danger' },
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
        {items.map((t) => {
          const tone = TONE_ICON[t.tone];
          const Icon = tone?.icon;
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex w-full animate-[toast-in_180ms_ease-out] items-center justify-center gap-2 rounded-xl bg-[#333333] px-4 py-3 text-center text-label font-medium text-white"
            >
              {tone && Icon && (
                <Icon
                  className={`h-4 w-4 shrink-0 ${tone.className}`}
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
              )}
              <span>{t.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
