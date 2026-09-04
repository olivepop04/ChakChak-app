/** 크루 채팅 접근 안내 버튼 — 데이터 조회 없이 현재 권한 결과만 사용합니다. */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

export function MessageAccessButton({
  actionId,
  canViewChat,
}: {
  actionId: string;
  canViewChat: boolean;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  function handleClick() {
    if (canViewChat) {
      router.push(`/action/${actionId}/chat`);
      return;
    }

    setIsOpen(true);
  }

  return (
    <>
      <Button type="button" size="lg" variant="secondary" fullWidth onClick={handleClick}>
        함께하는 크루와 이야기하기
      </Button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5"
          role="presentation"
          onClick={() => setIsOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="message-access-title"
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="message-access-title" className="text-[17px] font-bold text-neutral-900">
              참여 신청을 한 사람만 볼 수 있어요
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-neutral-500">
              이 액션에 참여하면 크루들과 이야기를 나눌 수 있어요.
            </p>
            <Button
              type="button"
              size="md"
              fullWidth
              className="mt-5"
              onClick={() => setIsOpen(false)}
            >
              확인
            </Button>
          </section>
        </div>
      )}
    </>
  );
}
