/**
 * 장소 표시 + 주소 복사 + 지도 열기.
 *
 * 지도는 외부 링크로 엽니다. 지도 API 를 붙이면 키 발급과 요금이 따라오는데,
 * MVP 에서는 카카오맵 검색 링크로 충분합니다.
 */
'use client';

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
    <div className="flex flex-col gap-3 rounded-xl bg-neutral-50 p-4">
      <div className="flex flex-col gap-1">
        {placeName ? (
          <>
            <h3 className="text-[15px] font-bold leading-snug text-neutral-900 break-keep">
              {placeName}
            </h3>
            {address && (
              <p className="text-xs leading-relaxed text-neutral-500 break-words">
                {address}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm font-semibold leading-relaxed text-neutral-900 break-words">
            {address}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 pt-0.5">
        <button
          type="button"
          onClick={copy}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-[12px] font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
        >
          주소 복사
        </button>
        <a
          href={mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-[12px] font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
        >
          지도에서 보기
        </a>
      </div>
    </div>
  );
}
