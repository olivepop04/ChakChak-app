/**
 * 결과 작성 (Owner 전용).
 *
 * 집계 숫자는 자동으로 계산된 값이라 수정할 수 없습니다.
 * 호스트가 채우는 건 추가 내용 · 사진 · 호스트의 한마디 세 가지입니다.
 *
 * ★ 임시저장은 사진 없이도 가능하고, 공개할 때 completeAction 이 사진 최소 1장을 검사합니다.
 * ★ "결과 공개하기" 를 누르면 completeAction 이 상태를 COMPLETED 로 바꾸고
 *   참여자 전원에게 알림을 보냅니다. 알림은 따로 만들 필요가 없습니다.
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { saveActionResult, completeAction } from '@/lib/mutations';
import { ImageUploader } from '@/components/ui/ImageUploader';
import { Button } from '@/components/ui/Button';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { useToast } from '@/components/ui/Toast';
import { describeResult, describeResultCount, describeResultRatio } from '@/lib/utils/quota';
import { cn } from '@/lib/utils/cn';
import { UPLOAD } from '@/lib/constants';
import type { ActionItemWithProgress } from '@/lib/types/view';

export function ResultWriteForm({
  actionId,
  items,
  initial,
}: {
  actionId: string;
  items: ActionItemWithProgress[];
  initial: { content: string; imageUrls: string[]; ownerVoice: string } | null;
}) {
  const router = useRouter();
  const toast = useToast();

  const [content, setContent] = useState(initial?.content ?? '');
  const [imageUrls, setImageUrls] = useState<string[]>(initial?.imageUrls ?? []);
  const [ownerVoice, setOwnerVoice] = useState(initial?.ownerVoice ?? '');
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    if (busy) return;

    setBusy(true);
    const supabase = createClient();
    const saved = await saveActionResult(supabase, actionId, {
      content,
      imageUrls,
      ownerVoice,
    });

    if (!saved.ok) {
      toast(saved.message, 'error');
      setBusy(false);
      return;
    }

    toast('결과를 임시저장했어요.', 'success');
    setBusy(false);
  }

  async function handlePublish() {
    if (busy) return;

    if (imageUrls.length < UPLOAD.RESULT_IMAGE_MIN) {
      toast('결과 사진을 최소 1장 올려주세요.', 'error');
      return;
    }

    setBusy(true);
    const supabase = createClient();

    // 결과를 먼저 저장하고, 그 다음에 상태를 바꿉니다.
    // completeAction 이 결과 사진 최소 1장을 최종 검사하므로 순서가 중요합니다.
    const saved = await saveActionResult(supabase, actionId, {
      content,
      imageUrls,
      ownerVoice,
    });

    if (!saved.ok) {
      toast(saved.message, 'error');
      setBusy(false);
      return;
    }

    const res = await completeAction(supabase, actionId);
    if (!res.ok) {
      toast(res.message, 'error');
      setBusy(false);
      return;
    }

    toast('결과를 공개했어요. 참여자에게 알림이 갔어요.', 'success');
    router.push(`/action/${actionId}/result`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6 px-6 pb-[calc(9rem+var(--nav-h)+env(safe-area-inset-bottom))] pt-5">
      {/* 자동 집계 — 수정 불가 */}
      <section className="flex flex-col gap-3">
        <div>
          <SectionTitle>자동 집계</SectionTitle>
          <p className="mt-0.5 text-caption text-neutral-500">
            참여 기록으로 자동 계산되어 수정할 수 없어요. 실제 활동 내용이 다를 경우 아래 입력칸에 적어주세요.
          </p>
        </div>

        <div className="flex flex-col gap-3 rounded-xl bg-neutral-50 p-4">
          {items.length === 0 ? (
            <p className="text-label text-neutral-400">모집 항목이 없어요.</p>
          ) : (
            items.map((item) => {
              const { ratio, isMet } = describeResultRatio(item, item.currentCount);
              return (
                <div key={item.id} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-neutral-900">
                      {item.name}
                    </span>
                    <span className="text-body font-bold tabular-nums text-neutral-900">
                      {describeResultCount(item, item.currentCount)}
                    </span>
                  </div>

                  {/* 게이지(그래프) */}
                  <div
                    className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200"
                    role="progressbar"
                    aria-valuenow={Math.round(ratio * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-300',
                        isMet ? 'bg-brand' : 'bg-neutral-400',
                      )}
                      style={{ width: `${Math.round(ratio * 100)}%` }}
                    />
                  </div>

                  <p
                    className={cn(
                      'text-label font-medium',
                      isMet ? 'text-brand' : 'text-neutral-500',
                    )}
                  >
                    {describeResult(item, item.currentCount)}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* 결과 내용 */}
      <label className="flex flex-col gap-1.5">
        <FieldLabel>이렇게 마무리했어요</FieldLabel>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={6}
          placeholder="어떤 활동을 했는지, 어떤 변화가 있었는지 적어주세요."
          className="rounded-xl border border-neutral-300 p-4 text-body leading-relaxed outline-none focus:border-neutral-900"
        />
      </label>

      {/* 결과 사진 */}
      <div className="flex flex-col gap-2">
        <FieldLabel required>결과 사진</FieldLabel>
        <ImageUploader
          bucket="result-images"
          actionId={actionId}
          max={UPLOAD.RESULT_IMAGE_MAX}
          urls={imageUrls}
          onChange={setImageUrls}
        />
        <p className="text-caption text-neutral-400">
          최소 {UPLOAD.RESULT_IMAGE_MIN}장, 최대 {UPLOAD.RESULT_IMAGE_MAX}장이에요.
        </p>
      </div>

      {/* 호스트의 한마디 */}
      <label className="flex flex-col gap-1.5">
        <FieldLabel>호스트의 한마디</FieldLabel>
        <textarea
          value={ownerVoice}
          onChange={(e) => setOwnerVoice(e.target.value)}
          rows={4}
          placeholder="함께해준 크루들에게 남기고 싶은 말을 적어주세요."
          className="rounded-xl border border-neutral-300 p-4 text-body leading-relaxed outline-none focus:border-neutral-900"
        />
      </label>

      {/* 탭이 보이는 화면이라 탭 높이(--nav-h)만큼 띄웁니다 (2026-09-18) */}
      <div className="fixed inset-x-0 bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom))] z-30 mx-auto max-w-app border-t border-neutral-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={handleSave}
            loading={busy}
            className="shrink-0 min-w-[76px] whitespace-nowrap flex-row"
          >
            저장
          </Button>
          <Button
            type="button"
            size="lg"
            fullWidth
            onClick={handlePublish}
            loading={busy}
            className="shrink flex-1 min-w-0 whitespace-nowrap flex-row"
          >
            결과 공개하기
          </Button>
        </div>
        <p className="mt-2 text-center text-caption text-neutral-400">
          공개하면 참여한 크루들에게 알림이 가고, 크루들도 소감을 남길 수 있게 돼요.
        </p>
      </div>
    </div>
  );
}
