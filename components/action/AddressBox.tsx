/**
 * 장소 표시 + 주소 복사 + 지도 열기.
 *
 * 지도는 외부 링크로 엽니다. 지도 API 를 붙이면 키 발급과 요금이 따라오는데,
 * MVP 에서는 카카오맵 검색 링크로 충분합니다.
 */
'use client';

import { useToast } from '@/components/ui/Toast';

export function AddressBox({ address }: { address: string }) {
  const toast = useToast();

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      toast('주소를 복사했어요.', 'success');
    } catch {
      toast('복사에 실패했어요. 주소를 길게 눌러 복사해주세요.', 'error');
    }
  }

  const mapUrl = `https://map.kakao.com/link/search/${encodeURIComponent(address)}`;

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-neutral-50 p-4">
      <p className="text-sm leading-relaxed text-neutral-800">{address}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={copy}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-[12px] font-medium text-neutral-700"
        >
          주소 복사
        </button>
        <a
          href={mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-[12px] font-medium text-neutral-700"
        >
          지도에서 보기
        </a>
      </div>
    </div>
  );
}
