/**
 * 이미지 업로드.
 *
 * ★ supabase.storage 를 직접 부르지 말고 이 함수를 쓰세요.
 *
 * 왜 리사이즈를 하는가
 *   Supabase 무료 플랜의 파일 저장 한도는 1GB 입니다.
 *   휴대폰 사진은 한 장에 3~5MB 라서, 액션 50개에 8장씩 올리면 2GB 가 되어 한도를 넘습니다.
 *   가로 1200px · WebP 로 줄이면 같은 사진이 200~300KB 가 되고, 모바일에서는 차이가 보이지 않습니다.
 *
 * 브라우저에서만 동작합니다 ('use client' 컴포넌트에서 호출).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';
import { UPLOAD } from '@/lib/constants';

type DB = SupabaseClient<Database>;

export type UploadBucket = 'action-images' | 'result-images';

export type UploadResult =
  | { ok: true; url: string }
  | { ok: false; message: string };

/** 리사이즈 기준. 필요하면 여기만 고치면 됩니다. */
const RESIZE = {
  /** 가로 최대 픽셀. 이보다 작으면 원본 크기 유지 */
  maxWidth: 1200,
  /** 세로 최대 픽셀 */
  maxHeight: 1200,
  /** 0~1. 0.82 면 눈으로 차이를 못 느끼면서 용량이 크게 줍니다 */
  quality: 0.82,
} as const;

/**
 * 파일 검사. 업로드 전에 먼저 부르면 사용자에게 빨리 알려줄 수 있습니다.
 */
export function validateImage(file: File): { ok: boolean; message?: string } {
  if (!UPLOAD.ALLOWED_MIME.includes(file.type as never)) {
    return { ok: false, message: 'JPG · PNG · WebP 파일만 올릴 수 있어요.' };
  }
  // 원본은 넉넉히 받고, 5MB 한도는 줄인 뒤에 봅니다 (uploadImage). 폰 사진이 흔히 5MB 를 넘습니다.
  if (file.size > UPLOAD.MAX_ORIGINAL_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return { ok: false, message: `사진이 너무 커요. (${mb}MB / 최대 25MB)` };
  }
  return { ok: true };
}

/**
 * 브라우저에서 이미지를 줄이고 WebP 로 바꿉니다.
 * 실패하면 원본을 그대로 돌려줍니다 (업로드 자체를 막지는 않습니다).
 */
export async function resizeImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);

    // 비율을 유지하면서 한도 안으로 줄인다
    const scale = Math.min(
      RESIZE.maxWidth / bitmap.width,
      RESIZE.maxHeight / bitmap.height,
      1, // 원본이 이미 작으면 키우지 않는다
    );
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', RESIZE.quality),
    );

    // 변환에 실패했거나 오히려 커졌으면 원본을 쓴다
    if (!blob || blob.size >= file.size) return file;
    return blob;
  } catch {
    return file;
  }
}

/**
 * 이미지 한 장 업로드.
 *
 * 순서: 검사 → 리사이즈 → Storage 업로드 → 성공한 URL만 반환
 * 업로드가 실패했는데 URL 부터 DB에 저장하면 깨진 이미지 주소가 남습니다.
 *
 * @param actionId 액션 id. 파일 경로의 첫 조각이 되고, Storage 정책이 이걸로 Owner 를 확인합니다.
 */
export async function uploadImage(
  supabase: DB,
  bucket: UploadBucket,
  actionId: string,
  file: File,
): Promise<UploadResult> {
  const check = validateImage(file);
  if (!check.ok) return { ok: false, message: check.message! };

  const blob = await resizeImage(file);
  // 줄였는데도 크면(줄이기에 실패해 원본 그대로인 경우 등) 여기서 막습니다
  if (blob.size > UPLOAD.MAX_BYTES) {
    const mb = (blob.size / 1024 / 1024).toFixed(1);
    return {
      ok: false,
      message: `사진을 줄였는데도 너무 커요. (${mb}MB / 최대 5MB) 다른 사진을 골라주세요.`,
    };
  }
  const ext = blob.type === 'image/webp' ? 'webp' : file.name.split('.').pop() || 'jpg';
  const path = `${actionId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    contentType: blob.type,
    cacheControl: '31536000', // 1년. 같은 경로에 덮어쓰지 않으므로 길게 잡아도 안전
    upsert: false,
  });

  if (error) {
    // Storage 정책에 막힌 경우가 대부분입니다 (본인 액션이 아님)
    const msg = error.message.includes('policy')
      ? '이 액션에 사진을 올릴 권한이 없어요.'
      : '사진 업로드에 실패했어요. 잠시 후 다시 시도해주세요.';
    return { ok: false, message: msg };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(path);

  return { ok: true, url: publicUrl };
}

/**
 * 여러 장을 한 번에. 하나라도 실패하면 실패한 것만 알려주고,
 * 성공한 URL 은 그대로 돌려줍니다 (전부 버리지 않습니다).
 */
export async function uploadImages(
  supabase: DB,
  bucket: UploadBucket,
  actionId: string,
  files: File[],
  max: number,
): Promise<{ urls: string[]; errors: string[] }> {
  const urls: string[] = [];
  const errors: string[] = [];

  for (const file of files.slice(0, max)) {
    const res = await uploadImage(supabase, bucket, actionId, file);
    res.ok ? urls.push(res.url) : errors.push(`${file.name}: ${res.message}`);
  }

  if (files.length > max) {
    errors.push(`최대 ${max}장까지만 올릴 수 있어요.`);
  }

  return { urls, errors };
}

/**
 * 업로드한 이미지 삭제.
 * public URL 에서 경로를 되짚어 냅니다.
 */
export async function deleteImage(
  supabase: DB,
  bucket: UploadBucket,
  publicUrl: string,
): Promise<{ ok: boolean }> {
  const marker = `/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return { ok: false };

  const path = publicUrl.slice(idx + marker.length);
  const { error } = await supabase.storage.from(bucket).remove([path]);
  return { ok: !error };
}
