/**
 * 장소 표시 + 주소 복사 + 지도 열기.
 *
 * 지도는 외부 링크로 엽니다. 지도 API 를 붙이면 키 발급과 요금이 따라오는데,
 * MVP 에서는 카카오맵 검색 링크로 충분합니다.
 *
 * ★ 배경·패딩은 이 컴포넌트가 갖지 않습니다 — 부르는 쪽(액션 상세의 "일정 · 장소")이
 *   활동 일정과 같은 박스를 씌웁니다. 2026-09-22 개편.
 */
'use client';

import { MapPin } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

export function AddressBox({
  placeName,
  address,
}: {
  placeName?: string | null;
  address: string;
}) {
  const toast = useToast();

  function getCopyText() {
    const cleanAddress = address?.trim() ?? '';
    const cleanPlace = placeName?.trim() ?? '';

    if (cleanAddress && cleanPlace && cleanAddress !== cleanPlace) {
      return `${cleanAddress} ${cleanPlace}`;
    }
    return cleanAddress || cleanPlace;
  }

  async function copy() {
    const textToCopy = getCopyText();
    if (!textToCopy) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      toast('주소를 복사했어요.', 'success');
    } catch {
      toast('복사에 실패했어요. 주소를 길게 눌러 복사해주세요.', 'error');
    }
  }

  const mapSearchQuery = placeName ? `${placeName} ${address}` : address;
  const mapUrl = `https://map.kakao.com/link/search/${encodeURIComponent(mapSearchQuery)}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
        <div className="flex flex-col gap-0.5">
          {placeName ? (
            <>
              {address && (
                <p className="text-[11px] leading-snug text-neutral-500 break-words">
                  {address}
                </p>
              )}
              <h3 className="text-sm font-bold leading-snug text-neutral-900 break-keep">
                {placeName}
              </h3>
            </>
          ) : (
            <p className="text-sm font-semibold leading-relaxed text-neutral-900 break-words">
              {address}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 pl-6">
        <button
          type="button"
          onClick={copy}
          className="text-[13px] font-medium text-neutral-900 underline transition-colors hover:text-neutral-600"
        >
          주소 복사
        </button>
        <span className="h-3.5 w-px shrink-0 bg-neutral-200" aria-hidden="true" />
        <a
          href={mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[13px] font-medium text-neutral-900 underline transition-colors hover:text-neutral-600"
        >
          지도에서 보기
        </a>
      </div>
    </div>
  );
}
