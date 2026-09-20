/**
 * 액션 만들기 / 수정하기.
 *
 * ★ 저장 순서에 이유가 있습니다.
 *   이미지 파일 경로가 {action_id}/... 라서 액션이 먼저 있어야 합니다.
 *   제목 입력이 잠시 멈추면 DRAFT 를 자동으로 만들고 사진 칸을 엽니다.
 *
 * ★ 공개 흐름
 *   [액션 생성하기] → 코드 검사 + AI 검수 → 결과를 보여줌 → 호스트가 [액션 공개하기]
 *   AI 가 PASS 해도 자동으로 공개되지 않습니다. 사람이 마지막에 결정합니다.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  saveActionDraft,
  saveActionItems,
  publishAction,
  type ActionItemInput,
} from '@/lib/mutations';
import { AddressSearch } from '@/components/action/AddressSearch';
import { ItemEditor } from '@/components/action/ItemEditor';
import { ImageUploader } from '@/components/ui/ImageUploader';
import { Button } from '@/components/ui/Button';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { useToast } from '@/components/ui/Toast';
import { CATEGORIES, UPLOAD, type Category } from '@/lib/constants';
import { getPlaceErrors } from '@/lib/utils/place-validation';
import type { ReviewResult } from '@/lib/openai';

/** ISO 문자열 → datetime-local 입력값 (2026-08-30T14:00) */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local 입력값 → ISO */
function toISO(local: string): string | null {
  return local ? new Date(local).toISOString() : null;
}

/** 종료 시각은 유지하고 날짜만 활동 시작일에 맞춥니다. */
function moveToSameDate(value: string, activityStart: string): string {
  const [startDate, startTime] = activityStart.split('T');
  const [, time] = value.split('T');
  if (!startDate) return value;
  return time ? `${startDate}T${time}` : startTime ? activityStart : value;
}

function scrollAndFocus(target: HTMLElement | null) {
  if (!target) return;
  const focusTarget = target.matches('input, textarea, button')
    ? target
    : target.querySelector<HTMLElement>('input, textarea, button');
  focusTarget?.focus({ preventScroll: true });
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

import { X } from 'lucide-react';

export interface ActionFormInitial {
  id: string | null;
  title: string;
  description: string;
  category: Category;
  categories: Category[];
  imageUrls: string[];
  thumbnailIndex: number;
  address: string;
  /** 장소 이름. 호스트가 직접 입력. 예) 신라목욕탕 (F32) */
  placeName: string;
  notice: string;
  recruitEndAt: string | null;
  activityStartAt: string | null;
  activityEndAt: string | null;
  items: ActionItemInput[];
}

const input =
  'min-h-11 rounded-xl border border-neutral-300 px-4 py-3 text-[15px] outline-none focus:border-neutral-900';
const RECRUIT_END_ERROR =
  '모집 마감은 활동 시작보다 앞서야 해요. 마감일을 활동 시작일 이전으로 바꿔주세요.';
const ACTIVITY_END_ERROR =
  '활동 종료는 활동 시작보다 뒤여야 해요. 종료 시각을 다시 확인해주세요.';
const AUTOSAVE_DELAY = 800;

export function ActionForm({ initial }: { initial: ActionFormInitial }) {
  const router = useRouter();
  const toast = useToast();
  const initialActivityStart = toLocalInput(initial.activityStartAt);
  const initialActivityEnd = toLocalInput(initial.activityEndAt);

  const [actionId, setActionId] = useState(initial.id);
  const actionIdRef = useRef(initial.id);
  const draftCreationRef = useRef<Promise<string | null> | null>(null);
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [categories, setCategories] = useState<Category[]>(
    initial.categories.length > 0 ? initial.categories : [initial.category],
  );
  const category = categories[0];
  const [imageUrls, setImageUrls] = useState(initial.imageUrls);
  const [thumbnailIndex, setThumbnailIndex] = useState(initial.thumbnailIndex);
  // F32 — 입력칸은 개발 B 가 만듭니다. 배선은 되어 있으니 setPlaceName 만 연결하면 됩니다.
  const [placeName, setPlaceName] = useState(initial.placeName);
  const [placeError, setPlaceError] = useState('');
  const [address, setAddress] = useState(initial.address);
  const [notice, setNotice] = useState(initial.notice);
  const [recruitEnd, setRecruitEnd] = useState(toLocalInput(initial.recruitEndAt));
  const [activityStart, setActivityStart] = useState(initialActivityStart);
  const [activityEnd, setActivityEnd] = useState(initialActivityEnd);
  const [isSameDay, setIsSameDay] = useState(
    initial.id === null ||
      (!initialActivityStart && !initialActivityEnd) ||
      (!!initialActivityStart &&
        !!initialActivityEnd &&
        initialActivityStart.split('T')[0] === initialActivityEnd.split('T')[0]),
  );
  const [items, setItems] = useState<ActionItemInput[]>(initial.items);
  const [dateError, setDateError] = useState<{
    field: 'recruitEnd' | 'activityEnd';
    message: string;
  } | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const imageSectionRef = useRef<HTMLDivElement>(null);
  const itemsSectionRef = useRef<HTMLDivElement>(null);
  const recruitEndRef = useRef<HTMLInputElement>(null);
  const activityStartRef = useRef<HTMLInputElement>(null);
  const activityEndRef = useRef<HTMLInputElement>(null);
  const placeSectionRef = useRef<HTMLDivElement>(null);
  const placeNameRef = useRef<HTMLInputElement>(null);
  const pendingReviewTargetRef = useRef<HTMLElement | null>(null);

  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<ReviewResult | null>(null);

  const ensureDraft = useCallback(
    async (draftTitle: string): Promise<string | null> => {
      if (actionIdRef.current) return actionIdRef.current;
      if (draftCreationRef.current) return draftCreationRef.current;

      const creation = (async () => {
        const saved = await saveActionDraft(
          createClient(),
          { title: draftTitle, category, categories },
          null,
        );
        if (!saved.ok) {
          toast(saved.message, 'error');
          return null;
        }

        actionIdRef.current = saved.data;
        setActionId(saved.data);
        window.history.replaceState(null, '', `/action/create?id=${saved.data}`);
        return saved.data;
      })();

      draftCreationRef.current = creation;
      try {
        return await creation;
      } finally {
        if (draftCreationRef.current === creation) draftCreationRef.current = null;
      }
    },
    [categories, category, toast],
  );

  useEffect(() => {
    if (actionIdRef.current || !title.trim()) return;

    const timer = window.setTimeout(() => {
      void ensureDraft(title);
    }, AUTOSAVE_DELAY);

    return () => window.clearTimeout(timer);
  }, [ensureDraft, title]);

  /**
   * DRAFT 저장. 처음이면 만들고, 있으면 수정합니다.
   * 성공하면 액션 id 를 돌려줍니다.
   */
  async function saveDraft({ requireItems = false } = {}): Promise<string | null> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast('로그인이 필요합니다.', 'error');
      return null;
    }
    if (!title.trim()) {
      toast('제목을 입력해주세요.', 'error');
      scrollAndFocus(titleRef.current);
      return null;
    }

    const currentActionId = actionIdRef.current ?? (await ensureDraft(title));
    if (!currentActionId) return null;

    // 저장은 공용 함수로 합니다. 날짜 앞뒤 검사(F14)가 이 안에 들어 있어서
    // 화면에서 같은 검사를 또 만들 필요가 없습니다. 메시지는 그대로 보여주면 됩니다.
    const saved = await saveActionDraft(
      supabase,
      {
        title,
        description,
        category,
        categories,
        imageUrls,
        thumbnailIndex,
        address,
        placeName,
        notice,
        recruitEndAt: toISO(recruitEnd),
        activityStartAt: toISO(activityStart),
        activityEndAt: toISO(activityEnd),
      },
      currentActionId,
    );

    if (!saved.ok) {
      if (saved.message === RECRUIT_END_ERROR || saved.message === ACTIVITY_END_ERROR) {
        const field = saved.message === RECRUIT_END_ERROR ? 'recruitEnd' : 'activityEnd';
        const target = field === 'recruitEnd' ? recruitEndRef.current : activityEndRef.current;

        setDateError({ field, message: saved.message });
        target?.focus({ preventScroll: true });
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        toast(saved.message, 'error');
      }
      return null;
    }

    const id = saved.data;

    // 모집 항목은 전용 함수로 저장합니다.
    // 여러 행을 한 번에 넣을 때 DB 기본값이 적용되지 않는 문제를 이 함수가 막습니다.
    const res = await saveActionItems(supabase, id, items, {
      requireAtLeastOne: requireItems,
    });
    if (!res.ok) {
      toast(res.message, 'error');
      scrollAndFocus(itemsSectionRef.current);
      return null;
    }

    return id;
  }

  function findReviewErrorTarget(messages: string[]): HTMLElement | null {
    for (const message of messages) {
      if (message.includes('제목')) return titleRef.current;
      if (message.includes('모집 마감일과 활동 일시')) {
        if (!recruitEnd) return recruitEndRef.current;
        if (!activityStart) return activityStartRef.current;
        return activityEndRef.current;
      }
      if (message.includes('활동 종료') || message.includes('이미 지났')) {
        return activityEndRef.current;
      }
      if (message.includes('모집 마감')) return recruitEndRef.current;
      if (message.includes('대표 이미지')) return imageSectionRef.current;
      if (message.includes('모집 항목') || message.includes('함께할 사람'))
        return itemsSectionRef.current;
      if (message.includes('본문')) return descriptionRef.current;
    }
    return null;
  }

  function closeReview() {
    setReview(null);
    const target = pendingReviewTargetRef.current;
    pendingReviewTargetRef.current = null;
    if (target) window.requestAnimationFrame(() => scrollAndFocus(target));
  }

  async function handleSave() {
    if (busy) return;
    setBusy(true);
    const id = await saveDraft();
    setBusy(false);
    if (id) toast('저장했어요. 이어서 작성할 수 있어요.', 'success');
  }

  function validatePlace(): boolean {
    const errors = getPlaceErrors({ address, placeName });
    if (errors.length === 0) {
      setPlaceError('');
      return true;
    }

    const message = errors[0];
    setPlaceError(message);
    setReview(null);
    pendingReviewTargetRef.current = null;
    const target = message.includes('주소') ? placeSectionRef.current : placeNameRef.current;
    window.requestAnimationFrame(() => scrollAndFocus(target));
    return false;
  }

  /** 1차: 저장 + 검수 요청 */
  async function handleReview() {
    if (busy) return;
    if (!validatePlace()) return;
    setBusy(true);
    setReview(null);
    pendingReviewTargetRef.current = null;

    const id = await saveDraft({ requireItems: true });
    if (!id) {
      setBusy(false);
      return;
    }

    try {
      const res = await fetch('/api/ai/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId: id }),
      });
      const data = (await res.json()) as ReviewResult & { error?: string };
      if (data.error) {
        toast(data.error, 'error');
      } else {
        // REVISE 는 hard_errors 가 비어 있고 warnings 에만 내용이 있습니다
        const target = findReviewErrorTarget([...data.hard_errors, ...data.warnings]);
        pendingReviewTargetRef.current = target;
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setReview(data);
      }
    } catch {
      toast('검수 요청에 실패했어요. 잠시 후 다시 시도해주세요.', 'error');
    }
    setBusy(false);
  }

  /**
   * 2차: 호스트가 최종 공개.
   *
   * BLOCK 만 막습니다. REVISE 는 "이대로는 참여자가 움직이기 어렵다" 는
   * 알림이지 공개 금지가 아닙니다 — 보고 나서 공개할지는 호스트가 정합니다
   * (2026-09-09 Review AI 개선). AI 가 실패했을 때도 REVISE 로 오는데,
   * 예전에는 그 경우 공개 자체가 막혀 있었습니다.
   */
  async function handlePublish() {
    if (busy) return;
    if (!review || review.decision === 'BLOCK') {
      toast('내용을 수정한 뒤 다시 "액션 생성하기"를 눌러주세요.', 'error');
      return;
    }
    if (!validatePlace()) return;
    if (!actionId) return;
    setBusy(true);

    const supabase = createClient();
    const res = await publishAction(supabase, actionId);
    if (!res.ok) {
      toast(res.message, 'error');
      setBusy(false);
      return;
    }

    // 색인 생성. 실패해도 공개는 유지되므로 결과를 기다리지 않습니다.
    void fetch('/api/ai/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionId }),
    });

    toast('액션을 공개했어요!', 'success');
    router.push(`/action/${actionId}`);
    router.refresh();
  }

  function handleCategoryClick(targetCategory: Category) {
    const isSelected = categories.includes(targetCategory);

    if (!isSelected) {
      if (categories.length >= 3) {
        toast('카테고리는 최대 3개까지 선택할 수 있어요.', 'error');
        return;
      }
      setCategories([...categories, targetCategory]);
    } else {
      if (categories[0] !== targetCategory) {
        setCategories([
          targetCategory,
          ...categories.filter((c) => c !== targetCategory),
        ]);
        toast(`'${targetCategory}'(이)가 대표 카테고리로 지정되었습니다.`, 'default');
      }
    }
  }

  function handleCategoryDeselect(targetCategory: Category) {
    if (categories.length === 1 && categories[0] === targetCategory) {
      toast('카테고리를 하나 이상 선택해주세요.', 'error');
      return;
    }
    setCategories(categories.filter((c) => c !== targetCategory));
  }

  const isPlaceNameError = placeError.includes('장소 이름');

  return (
    <div className="flex flex-col gap-6 px-5 pb-[calc(8rem+var(--nav-h))] pt-4">
      {/* 제목 */}
      <label className="flex flex-col gap-1.5">
        <FieldLabel>제목</FieldLabel>
        <input
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 우리 동네 보호소를 함께 도와요"
          className={input}
        />
      </label>

      {/* 카테고리 */}
      <div className="flex flex-col gap-2">
        <FieldLabel>카테고리</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const isSelected = categories.includes(c);
            const isPrimary = isSelected && categories[0] === c;

            return (
              <div
                key={c}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                onClick={() => handleCategoryClick(c)}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return;

                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCategoryClick(c);
                  }
                }}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 ${
                  isSelected
                    ? 'border-neutral-900 bg-neutral-900 text-white shadow-xs'
                    : 'border-neutral-300 bg-white text-neutral-600 hover:border-neutral-400'
                }`}
              >
                {isPrimary && (
                  <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-neutral-900">
                    대표
                  </span>
                )}
                <span>{c}</span>
                {isSelected && (
                  <button
                    type="button"
                    aria-label={`${c} 카테고리 해제`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCategoryDeselect(c);
                    }}
                    className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-neutral-300 hover:bg-neutral-800 hover:text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          * 최대 3개까지 선택 가능하며, 선택된 태그를 눌러 대표를 변경하거나 ✕를 눌러 해제할 수 있습니다.
        </p>
      </div>

      {/* 소개 */}
      <label className="flex flex-col gap-1.5">
        <FieldLabel>소개</FieldLabel>
        <textarea
          ref={descriptionRef}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          placeholder="어떤 활동인지, 참여하면 무엇을 하게 되는지 적어주세요."
          className="rounded-xl border border-neutral-300 p-4 text-[15px] leading-relaxed outline-none focus:border-neutral-900"
        />
        <span className="text-[11px] text-neutral-400">
          전화번호·이메일 같은 개인정보는 적지 마세요. 공개된 화면에 그대로 보입니다.
        </span>
      </label>

      {/* 이미지 — 액션이 저장된 뒤에 열립니다 */}
      <div ref={imageSectionRef} className="flex flex-col gap-2">
        <FieldLabel>대표 이미지</FieldLabel>
        {actionId ? (
          <ImageUploader
            bucket="action-images"
            actionId={actionId}
            max={UPLOAD.ACTION_IMAGE_MAX}
            urls={imageUrls}
            onChange={setImageUrls}
            thumbnailIndex={thumbnailIndex}
            onThumbnailChange={setThumbnailIndex}
          />
        ) : (
          <p className="rounded-xl bg-neutral-50 px-4 py-5 text-center text-[13px] text-neutral-500">
            제목을 입력하면 잠시 후 사진을 올릴 수 있어요.
            <br />
            저장 버튼을 먼저 누르지 않아도 됩니다.
          </p>
        )}
      </div>

      {/* 모집 항목 */}
      <div ref={itemsSectionRef} className="flex flex-col gap-2">
        <FieldLabel>무엇이 필요한가요?</FieldLabel>
        <ItemEditor items={items} onChange={setItems} />
      </div>

      {/* 일정 */}
      <div className="flex flex-col gap-3">
        <FieldLabel>일정</FieldLabel>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] text-neutral-500">모집 마감일 :</span>
          <input
            ref={recruitEndRef}
            type="datetime-local"
            value={recruitEnd}
            onChange={(e) => {
              setRecruitEnd(e.target.value);
              if (dateError?.field === 'recruitEnd') setDateError(null);
            }}
            className={input}
          />
          {dateError?.field === 'recruitEnd' && (
            <span className="text-[12px] text-red-600" role="alert">
              {dateError.message}
            </span>
          )}
          {!dateError || dateError.field !== 'recruitEnd' ? (
            <span className="text-[11px] text-neutral-400">
              모집 마감은 활동 시작보다 앞서야 해요.
            </span>
          ) : null}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] text-neutral-500">활동 시작</span>
          <input
            ref={activityStartRef}
            type="datetime-local"
            value={activityStart}
            onChange={(e) => {
              const nextActivityStart = e.target.value;
              setActivityStart(nextActivityStart);
              if (isSameDay) {
                setActivityEnd((current) => moveToSameDate(current, nextActivityStart));
              }
              setDateError(null);
            }}
            className={input}
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="activity-end" className="text-[12px] text-neutral-500">
              활동 종료
            </label>
            <label className="flex items-center gap-1.5 text-[12px] text-neutral-600">
              <input
                type="checkbox"
                checked={isSameDay}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsSameDay(checked);
                  if (checked) {
                    setActivityEnd((current) => moveToSameDate(current, activityStart));
                    if (dateError?.field === 'activityEnd') setDateError(null);
                  }
                }}
                className="h-4 w-4 rounded border-neutral-300 accent-neutral-900"
              />
              시작일과 같음
            </label>
          </div>
          <input
            id="activity-end"
            ref={activityEndRef}
            type="datetime-local"
            value={activityEnd}
            onChange={(e) => {
              setActivityEnd(
                isSameDay ? moveToSameDate(e.target.value, activityStart) : e.target.value,
              );
              if (dateError?.field === 'activityEnd') setDateError(null);
            }}
            className={input}
          />
          {dateError?.field === 'activityEnd' && (
            <span className="text-[12px] text-red-600" role="alert">
              {dateError.message}
            </span>
          )}
        </div>
      </div>

      {/* 주소 · 장소명 */}
      <div ref={placeSectionRef} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <FieldLabel>주소</FieldLabel>
          <AddressSearch
            value={address}
            onChange={(value) => {
              setAddress(value);
              if (placeError) setPlaceError('');
            }}
            inputClassName={input}
          />
        </div>

        <label className="flex flex-col gap-1.5">
          <FieldLabel required>장소명</FieldLabel>
          <input
            ref={placeNameRef}
            value={placeName}
            onChange={(e) => {
              setPlaceName(e.target.value);
              if (placeError) setPlaceError('');
            }}
            placeholder="예) 신라목욕탕"
            aria-invalid={isPlaceNameError}
            aria-describedby={isPlaceNameError ? 'place-error' : undefined}
            className={input}
          />
        </label>
        {placeError && (
          <p id="place-error" className="text-[12px] text-red-600" role="alert">
            {placeError}
          </p>
        )}
      </div>

      {/* 안내사항 */}
      <label className="flex flex-col gap-1.5">
        <FieldLabel>안내사항</FieldLabel>
        <textarea
          value={notice}
          onChange={(e) => setNotice(e.target.value)}
          rows={3}
          placeholder="예: 편한 옷차림으로 와주세요. 물은 준비되어 있습니다."
          className="rounded-xl border border-neutral-300 p-4 text-[15px] leading-relaxed outline-none focus:border-neutral-900"
        />
      </label>

      {/* 하단 고정 버튼. 탭이 보이는 화면이라 탭 높이(--nav-h)만큼 띄웁니다 (2026-09-18) */}
      <div className="fixed inset-x-0 bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-app items-center gap-2 border-t border-neutral-200 bg-white p-4">
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
          onClick={handleReview}
          loading={busy}
          className="shrink flex-1 min-w-0 whitespace-nowrap flex-row"
        >
          액션 생성하기
        </Button>
      </div>

      {/* AI 검수 결과 팝업 */}
      {review && (
        <ReviewModal
          review={review}
          onPublish={handlePublish}
          onClose={closeReview}
          busy={busy}
        />
      )}
    </div>
  );
}

/** 이 화면에서만 쓰는 AI 검수 결과 팝업 */
function ReviewModal({
  review,
  onPublish,
  onClose,
  busy,
}: {
  review: ReviewResult;
  onPublish: () => void;
  onClose: () => void;
  busy: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-modal-title"
        className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4 shadow-xl"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="review-modal-title" className="text-[16px] font-bold text-neutral-900">
            AI 검수 결과
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="검수 결과 닫기"
            className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-neutral-500 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ×
          </button>
        </div>
        <ReviewPanel review={review} onPublish={onPublish} busy={busy} />
      </div>
    </div>
  );
}

/** 검수 결과 카드 */
function ReviewPanel({
  review,
  onPublish,
  busy,
}: {
  review: ReviewResult;
  onPublish: () => void;
  busy: boolean;
}) {
  // BLOCK 만 공개를 막습니다. REVISE 는 알려주고 호스트가 정합니다.
  const blocked = review.decision === 'BLOCK';
  const needsWork = review.decision === 'REVISE';
  const canPublish = !blocked;

  const tone = blocked
    ? 'border-red-200 bg-red-50'
    : needsWork
      ? 'border-amber-200 bg-amber-50'
      : 'border-emerald-200 bg-emerald-50';

  const heading = blocked
    ? '공개하기 전에 고쳐야 할 것이 있어요'
    : needsWork
      ? '조금만 더 적어주시면 참여가 훨씬 쉬워져요'
      : '공개할 준비가 되었어요.';

  return (
    <div className={`flex flex-col gap-3 rounded-xl border p-4 ${tone}`}>
      <div className="flex items-center gap-2">
        <span className="text-lg" aria-hidden="true">
          {blocked ? '⚠️' : review.decision === 'REVISE' ? '💡' : '✅'}
        </span>
        <p className="text-sm font-semibold text-neutral-900">{heading}</p>
      </div>

      {review.hard_errors.length > 0 && (
        <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px] text-red-700">
          {review.hard_errors.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      )}
      {review.warnings.length > 0 && (
        <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px] text-amber-800">
          {review.warnings.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      )}
      {review.suggestions.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-[12px] font-semibold text-neutral-600">이렇게 써보면 어때요?</p>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px] text-neutral-700">
            {review.suggestions.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}
      {review.questions.length > 0 && (
        <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px] text-neutral-600">
          {review.questions.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      )}

      {canPublish && (
        <Button type="button" onClick={onPublish} loading={busy} fullWidth>
          {needsWork ? '이대로 공개하기' : '액션 공개하기'}
        </Button>
      )}
      {needsWork && (
        <p className="text-[12px] text-amber-800">
          수정하려면 창을 닫고 내용을 고친 뒤 다시 &ldquo;액션 생성하기&rdquo;를 눌러주세요.
        </p>
      )}
      {blocked && (
        <p className="text-[12px] text-red-700">
          창을 닫고 내용을 수정한 뒤 다시 &ldquo;액션 생성하기&rdquo;를 눌러주세요.
        </p>
      )}
    </div>
  );
}
