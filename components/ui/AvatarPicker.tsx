/**
 * 아바타 고르기 (2026-09-29).
 *
 * 회원가입에서 닉네임과 성별 사이에 들어갑니다(9/29 회의). 그림 8종 중 하나를 고릅니다.
 * 이 부품은 고른 값만 올려주고(onChange) 저장은 하지 않습니다 — 저장은 부르는 쪽 몫입니다.
 *
 *   <AvatarPicker value={avatar} onChange={setAvatar} />
 *
 * 고를 수 있는 값은 lib/constants 의 AVATAR_KEYS(supabase/20 의 is_avatar_key 와 같은 목록)만
 * 씁니다. 목록을 여기서 따로 적지 마세요 — DB 가 받는 값과 어긋나면 저장이 거절됩니다.
 *
 * 디자인: 동그라미 8개를 4개씩 두 줄, 고른 것은 포인트 그린 테두리. 모서리 pill(원) · 그림자 없음.
 */
'use client';

import { AVATAR_KEYS } from '@/lib/constants';
import { cn } from '@/lib/utils/cn';

export function AvatarPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (key: string) => void;
}) {
  return (
    <div role="group" aria-label="아바타 고르기" className="grid grid-cols-4 gap-3">
      {AVATAR_KEYS.map((key, i) => {
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={selected}
            aria-label={`아바타 ${i + 1}번`}
            onClick={() => onChange(key)}
            className={cn(
              // 원 크기는 칸 폭에 맞추되 64px 까지만 (2026-09-30 72 → 64) — 375px 에서도 한 줄에 4개(누르는 칸 44px 이상)
              'flex aspect-square w-full max-w-[64px] items-center justify-center justify-self-center rounded-full border-2 p-1 transition-colors',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
              selected ? 'border-brand' : 'border-transparent hover:border-hairline',
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/avatars/${key}.svg`}
              alt=""
              draggable={false}
              className="h-full w-full rounded-full"
            />
          </button>
        );
      })}
    </div>
  );
}
