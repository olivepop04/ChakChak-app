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

import { Fragment, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UsersRound, Package } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { saveActionResult, completeAction } from '@/lib/mutations';
import { ImageUploader } from '@/components/ui/ImageUploader';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { describeResultRatio } from '@/lib/utils/quota';
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
    <div className="flex flex-col gap-6 px-6 pb-[calc(8.5rem+var(--nav-h)+env(safe-area-inset-bottom))] pt-5">
      {/* 자동 집계 — 수정 불가 */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-subtitle font-bold text-neutral-900">자동 집계</h2>
          <p className="mt-1 text-label leading-relaxed text-neutral-500">
            참여 기록으로 자동 계산되어 수정할 수 없어요. 실제 활동 내용이 다를 경우 아래 입력칸에 적어주세요.
          </p>
        </div>

        {/* 결과 보기 "함께 모은 것"과 같은 형식 — 박스 테두리 없이 항목 사이 구분선 */}
        <div className="flex flex-col gap-5 p-4">
          {items.length === 0 ? (
            <p className="text-label text-neutral-400">모집 항목이 없어요.</p>
          ) : (
            items.map((item, idx) => {
              const { ratio, isMet } = describeResultRatio(item, item.currentCount);
              const Icon = item.type === 'PERSON' ? UsersRound : Package;
              const statusText = isMet
                ? '목표를 채웠어요'
                : item.type === 'GOODS'
                  ? `${item.currentCount}${item.unit} 모았어요`
                  : `${item.currentCount}${item.unit} 참여했어요`;

              return (
                <Fragment key={item.id}>
                {idx > 0 && <div className="h-px bg-neutral-200" />}
                <div className="flex flex-col gap-2">
                  {/* 상단: 아이콘 + 항목명 + 최종 모집 수 (한 row) */}
                  <div className="flex items-center gap-2">
                    {/* 원 안의 아이콘 (테두리 없음) */}
                    <div
                      className={cn(
                        'flex h-9 w-9 flex-none items-center justify-center rounded-full',
                        isMet ? 'bg-brand-soft' : 'bg-neutral-100',
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-[18px] w-[18px]',
                          isMet ? 'text-brand' : 'text-neutral-500',
                        )}
                        aria-hidden="true"
                      />
                    </div>

                    <span className="flex-1 truncate text-body font-semibold text-neutral-900">
                      {item.name}
                    </span>

                    {/* 최종 모집 수만 표시 (목표 수 미표시) */}
                    <span
                      className={cn(
                        'shrink-0 text-body font-bold tabular-nums',
                        isMet ? 'text-brand' : 'text-neutral-900',
                      )}
                    >
                      {item.currentCount}{item.unit}
                    </span>
                  </div>

                  {/* 프로그레스바 게이지 (아이콘 앞까지 옴) */}
                  <div
                    className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200"
                    role="progressbar"
                    aria-valuenow={Math.round(ratio * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${item.name} 모집 현황`}
                  >
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-300',
                        isMet ? 'bg-brand' : 'bg-neutral-400',
                      )}
                      style={{ width: `${Math.round(ratio * 100)}%` }}
                    />
                  </div>

                  {/* 상태 안내 문구 */}
                  <p
                    className={cn(
                      'text-caption font-medium',
                      isMet ? 'text-brand' : 'text-neutral-500',
                    )}
                  >
                    {statusText}
                  </p>
                </div>
                </Fragment>
              );
            })
          )}
        </div>
      </section>

      {/* 이렇게 마무리했어요 */}
      <label className="flex flex-col gap-2">
        <span className="text-subtitle font-bold text-neutral-500">이렇게 마무리했어요</span>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          placeholder="어떤 활동을 했는지, 어떤 변화가 있었는지 적어주세요."
          className="min-h-[120px] w-full resize-none rounded-xl border border-hairline p-4 text-body leading-relaxed text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-hairline-focus"
        />
      </label>

      {/* 결과 사진 */}
      <div className="flex flex-col gap-2">
        <span className="text-subtitle font-bold text-neutral-500">
          결과 사진 <span className="text-danger">*</span>
        </span>
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
      <label className="flex flex-col gap-2">
        <span className="text-subtitle font-bold text-neutral-500">호스트의 한마디</span>
        <textarea
          value={ownerVoice}
          onChange={(e) => setOwnerVoice(e.target.value)}
          rows={2}
          placeholder="함께해준 크루들에게 남기고 싶은 말을 적어주세요."
          className="min-h-[80px] w-full resize-none rounded-xl border border-hairline p-4 text-body leading-relaxed text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-hairline-focus"
        />
      </label>

      {/* 탭이 보이는 화면이라 탭 높이(--nav-h)만큼 띄웁니다 (2026-09-18) */}
      <div className="fixed inset-x-0 bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom))] z-30 mx-auto max-w-app bg-white px-6 py-4">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={handleSave}
            loading={busy}
            className="min-w-[76px] shrink-0 px-5"
          >
            저장
          </Button>
          <Button
            type="button"
            size="lg"
            fullWidth
            onClick={handlePublish}
            loading={busy}
            className="min-w-0 flex-1"
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
