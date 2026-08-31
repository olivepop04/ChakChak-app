/**
 * 이미지 업로드 (미리보기 · 대표 지정 · 삭제).
 *
 * ★ 순서 주의
 *   파일 경로가 {action_id}/... 라서 액션이 먼저 있어야 합니다.
 *   Creation 화면에서는 "저장(DRAFT)" 을 먼저 해서 액션 id 를 받은 뒤
 *   이 컴포넌트를 보여주세요.
 *
 * 업로드 전에 브라우저에서 가로 1200px · WebP 로 줄입니다.
 * 5MB 사진이 200~300KB 가 되어 저장 용량을 아낍니다.
 *
 *   <ImageUploader
 *     bucket="action-images"
 *     actionId={actionId}
 *     max={3}
 *     urls={urls}
 *     onChange={setUrls}
 *     thumbnailIndex={thumbIdx}
 *     onThumbnailChange={setThumbIdx}
 *   />
 */
'use client';

import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { uploadImages, deleteImage, type UploadBucket } from '@/lib/upload';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils/cn';

interface ImageUploaderProps {
  bucket: UploadBucket;
  actionId: string;
  max: number;
  urls: string[];
  onChange: (urls: string[]) => void;
  /** 대표 이미지를 고르게 할 때만 넘기세요 (Creation) */
  thumbnailIndex?: number;
  onThumbnailChange?: (index: number) => void;
  className?: string;
}

export function ImageUploader({
  bucket,
  actionId,
  max,
  urls,
  onChange,
  thumbnailIndex,
  onThumbnailChange,
  className,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const canAdd = urls.length < max;
  const showThumbnailPicker = onThumbnailChange !== undefined;

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setBusy(true);
    const room = max - urls.length;
    const { urls: added, errors } = await uploadImages(
      createClient(),
      bucket,
      actionId,
      files,
      room,
    );

    if (added.length > 0) onChange([...urls, ...added]);
    errors.forEach((msg) => toast(msg, 'error'));

    setBusy(false);
    // 같은 파일을 다시 고를 수 있도록 초기화
    if (inputRef.current) inputRef.current.value = '';
  }

  async function handleRemove(index: number) {
    const target = urls[index];
    const next = urls.filter((_, i) => i !== index);
    onChange(next);

    // 대표 이미지가 밀리지 않도록 보정
    if (showThumbnailPicker && thumbnailIndex !== undefined) {
      if (index === thumbnailIndex) onThumbnailChange!(0);
      else if (index < thumbnailIndex) onThumbnailChange!(thumbnailIndex - 1);
    }

    // Storage 에서도 지운다. 실패해도 화면은 이미 반영됐으므로 조용히 넘어간다.
    void deleteImage(createClient(), bucket, target);
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-wrap gap-2">
        {urls.map((url, i) => (
          <div
            key={url}
            className={cn(
              'relative h-24 w-24 overflow-hidden rounded-lg border-2',
              showThumbnailPicker && i === thumbnailIndex
                ? 'border-neutral-900'
                : 'border-neutral-200',
            )}
          >
            {/* next/image 를 쓰지 않는 이유: Supabase 도메인 설정 없이도 동작하게 하려고 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />

            {showThumbnailPicker && (
              <button
                type="button"
                onClick={() => onThumbnailChange!(i)}
                className={cn(
                  'absolute bottom-1 left-1 rounded px-1.5 py-0.5 text-[10px] font-bold',
                  i === thumbnailIndex
                    ? 'bg-neutral-900 text-white'
                    : 'bg-white/85 text-neutral-600',
                )}
              >
                {i === thumbnailIndex ? '대표' : '대표로'}
              </button>
            )}

            <button
              type="button"
              onClick={() => handleRemove(i)}
              aria-label="사진 삭제"
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white"
            >
              ×
            </button>
          </div>
        ))}

        {canAdd && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 text-neutral-400 disabled:opacity-50"
          >
            {busy ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent" />
            ) : (
              <>
                <span className="text-xl">＋</span>
                <span className="text-[11px]">사진</span>
              </>
            )}
          </button>
        )}
      </div>

      <p className="text-[11px] text-neutral-400">
        {urls.length} / {max}장 · JPG · PNG · WebP · 한 장당 5MB 이하
        {showThumbnailPicker && ' · 첫 번째가 대표 이미지예요'}
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={max > 1}
        onChange={handleFiles}
        className="hidden"
      />
    </div>
  );
}
