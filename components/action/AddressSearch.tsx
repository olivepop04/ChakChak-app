'use client';

import { useState } from 'react';
import Script from 'next/script';

type PostcodeData = {
  address: string;
  roadAddress: string;
  jibunAddress: string;
  userSelectedType: 'R' | 'J';
};

type KakaoWindow = Window & {
  kakao?: {
    Postcode: new (options: {
      oncomplete: (data: PostcodeData) => void;
    }) => { open: () => void };
  };
};

export function AddressSearch({
  value,
  onChange,
  inputClassName,
}: {
  value: string;
  onChange: (value: string) => void;
  inputClassName: string;
}) {
  const [ready, setReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  function openPostcode() {
    const Postcode = (window as KakaoWindow).kakao?.Postcode;
    if (!Postcode) {
      setLoadFailed(true);
      return;
    }

    new Postcode({
      oncomplete: (data) => {
        const selectedAddress =
          data.userSelectedType === 'R' ? data.roadAddress : data.jibunAddress;
        onChange(selectedAddress || data.address);
      },
    }).open();
  }

  return (
    <>
      <Script
        id="kakao-postcode-script"
        src="https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"
        strategy="afterInteractive"
        onReady={() => {
          setReady(true);
          setLoadFailed(false);
        }}
        onError={() => setLoadFailed(true)}
      />

      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="주소를 검색해주세요"
          className={`${inputClassName} min-w-0 flex-1`}
        />
        <button
          type="button"
          onClick={openPostcode}
          disabled={!ready}
          className="min-h-11 shrink-0 rounded-xl border border-neutral-300 px-4 py-3 text-label font-semibold text-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400"
        >
          {loadFailed ? '불러오기 실패' : ready ? '주소 검색' : '불러오는 중'}
        </button>
      </div>

      {loadFailed && (
        <p className="text-caption text-red-600" role="alert">
          주소 검색을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해주세요.
        </p>
      )}
    </>
  );
}
