/**
 * 액션 만들기 / 수정하기.
 *
 * ★ 저장 순서에 이유가 있습니다.
 *   이미지 파일 경로가 {action_id}/... 라서 액션이 먼저 있어야 합니다.
 *   그래서 "저장" 을 한 번 눌러 DRAFT 를 만든 뒤에 사진 칸이 열립니다.
 *
 * ★ 공개 흐름
 *   [공개하기] → 코드 검사 + AI 검수 → 결과를 보여줌 → Owner 가 [최종 공개]
 *   AI 가 PASS 해도 자동으로 공개되지 않습니다. 사람이 마지막에 결정합니다.
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { saveActionItems, publishAction, type ActionItemInput } from '@/lib/mutations';
import { ItemEditor } from '@/components/action/ItemEditor';
import { ImageUploader } from '@/components/ui/ImageUploader';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { CATEGORIES, UPLOAD, type Category } from '@/lib/constants';
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

export interface ActionFormInitial {
  id: string | null;
  title: string;
  description: string;
  category: Category;
  imageUrls: string[];
  thumbnailIndex: number;
  address: string;
  notice: string;
  recruitEndAt: string | null;
  activityStartAt: string | null;
  activityEndAt: string | null;
  items: ActionItemInput[];
}

const input =
  'h-12 rounded-xl border border-neutral-300 px-4 text-[15px] outline-none focus:border-neutral-900';
const label = 'text-[13px] font-medium text-neutral-700';

export function ActionForm({ initial }: { initial: ActionFormInitial }) {
  const router = useRouter();
  const toast = useToast();

  const [actionId, setActionId] = useState(initial.id);
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [category, setCategory] = useState<Category>(initial.category);
  const [imageUrls, setImageUrls] = useState(initial.imageUrls);
  const [thumbnailIndex, setThumbnailIndex] = useState(initial.thumbnailIndex);
  const [address, setAddress] = useState(initial.address);
  const [notice, setNotice] = useState(initial.notice);
  const [recruitEnd, setRecruitEnd] = useState(toLocalInput(initial.recruitEndAt));
  const [activityStart, setActivityStart] = useState(
    toLocalInput(initial.activityStartAt),
  );
  const [activityEnd, setActivityEnd] = useState(toLocalInput(initial.activityEndAt));
  const [items, setItems] = useState<ActionItemInput[]>(initial.items);

  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<ReviewResult | null>(null);

  /**
   * DRAFT 저장. 처음이면 만들고, 있으면 수정합니다.
   * 성공하면 액션 id 를 돌려줍니다.
   */
  async function saveDraft(): Promise<string | null> {
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
      return null;
    }

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      category,
      image_urls: imageUrls,
      thumbnail_index: Math.min(thumbnailIndex, Math.max(imageUrls.length - 1, 0)),
      address: address.trim() || null,
      notice: notice.trim() || null,
      recruit_end_at: toISO(recruitEnd),
      activity_start_at: toISO(activityStart),
      activity_end_at: toISO(activityEnd),
    };

    let id = actionId;

    if (id) {
      const { error } = await supabase.from('actions').update(payload).eq('id', id);
      if (error) {
        toast('저장에 실패했어요.', 'error');
        return null;
      }
    } else {
      const { data, error } = await supabase
        .from('actions')
        .insert({ ...payload, owner_id: user.id, status: 'DRAFT' })
        .select('id')
        .single();
      if (error || !data) {
        toast('저장에 실패했어요.', 'error');
        return null;
      }
      id = data.id;
      setActionId(id);
      // 주소에 id 를 남겨 두면 새로고침해도 이어서 작성할 수 있습니다
      window.history.replaceState(null, '', `/action/create?id=${id}`);
    }

    // 모집 항목은 전용 함수로 저장합니다.
    // 여러 행을 한 번에 넣을 때 DB 기본값이 적용되지 않는 문제를 이 함수가 막습니다.
    if (items.length > 0) {
      const res = await saveActionItems(supabase, id, items);
      if (!res.ok) {
        toast(res.message, 'error');
        return null;
      }
    }

    return id;
  }

  async function handleSave() {
    if (busy) return;
    setBusy(true);
    const id = await saveDraft();
    setBusy(false);
    if (id) toast('저장했어요. 이어서 작성할 수 있어요.', 'success');
  }

  /** 1차: 저장 + 검수 요청 */
  async function handleReview() {
    if (busy) return;
    setBusy(true);
    setReview(null);

    const id = await saveDraft();
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
        setReview(data);
      }
    } catch {
      toast('검수 요청에 실패했어요. 잠시 후 다시 시도해주세요.', 'error');
    }
    setBusy(false);
  }

  /** 2차: Owner 가 최종 공개 */
  async function handlePublish() {
    if (busy || !actionId) return;
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

  return (
    <div className="flex flex-col gap-6 px-5 pb-32 pt-4">
      {/* 제목 */}
      <label className="flex flex-col gap-1.5">
        <span className={label}>제목</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 우리 동네 보호소를 함께 도와요"
          className={input}
        />
      </label>

      {/* 카테고리 */}
      <div className="flex flex-col gap-2">
        <span className={label}>카테고리</span>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-full border px-3.5 py-2 text-[13px] font-medium ${
                category === c
                  ? 'border-neutral-900 bg-neutral-900 text-white'
                  : 'border-neutral-300 bg-white text-neutral-600'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* 소개 */}
      <label className="flex flex-col gap-1.5">
        <span className={label}>소개</span>
        <textarea
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
      <div className="flex flex-col gap-2">
        <span className={label}>대표 이미지</span>
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
            제목을 적고 아래 <b>저장</b>을 먼저 눌러주세요.
            <br />
            그 다음에 사진을 올릴 수 있어요.
          </p>
        )}
      </div>

      {/* 모집 항목 */}
      <div className="flex flex-col gap-2">
        <span className={label}>무엇이 필요한가요?</span>
        <ItemEditor items={items} onChange={setItems} />
      </div>

      {/* 일정 */}
      <div className="flex flex-col gap-3">
        <span className={label}>일정</span>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] text-neutral-500">모집 마감</span>
          <input
            type="datetime-local"
            value={recruitEnd}
            onChange={(e) => setRecruitEnd(e.target.value)}
            className={input}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] text-neutral-500">활동 시작</span>
          <input
            type="datetime-local"
            value={activityStart}
            onChange={(e) => setActivityStart(e.target.value)}
            className={input}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] text-neutral-500">활동 종료</span>
          <input
            type="datetime-local"
            value={activityEnd}
            onChange={(e) => setActivityEnd(e.target.value)}
            className={input}
          />
        </label>

        <p className="text-[11px] text-neutral-400">
          모집 마감은 활동 시작보다 앞서야 해요. 활동 종료 시각이 지나면 자동으로
          &ldquo;결과 작성 필요&rdquo; 상태가 됩니다.
        </p>
      </div>

      {/* 장소 */}
      <label className="flex flex-col gap-1.5">
        <span className={label}>장소</span>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="예: 서울특별시 성동구 ○○로 12"
          className={input}
        />
      </label>

      {/* 안내사항 */}
      <label className="flex flex-col gap-1.5">
        <span className={label}>안내사항</span>
        <textarea
          value={notice}
          onChange={(e) => setNotice(e.target.value)}
          rows={3}
          placeholder="예: 편한 옷차림으로 와주세요. 물은 준비되어 있습니다."
          className="rounded-xl border border-neutral-300 p-4 text-[15px] leading-relaxed outline-none focus:border-neutral-900"
        />
      </label>

      {/* AI 검수 결과 */}
      {review && <ReviewPanel review={review} onPublish={handlePublish} busy={busy} />}

      {/* 하단 고정 버튼 */}
      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-app gap-2 border-t border-neutral-200 bg-white p-4">
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={handleSave}
          loading={busy}
        >
          저장
        </Button>
        <Button
          type="button"
          size="lg"
          fullWidth
          onClick={handleReview}
          loading={busy}
        >
          공개하기
        </Button>
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
  const blocked = review.decision === 'BLOCK';

  const tone = blocked
    ? 'border-red-200 bg-red-50'
    : review.decision === 'REVISE'
      ? 'border-amber-200 bg-amber-50'
      : 'border-emerald-200 bg-emerald-50';

  const heading = blocked
    ? '공개하기 전에 고쳐야 할 것이 있어요'
    : review.decision === 'REVISE'
      ? '이대로도 공개할 수 있지만, 이런 점을 보완하면 좋아요'
      : '확인했어요. 공개할 준비가 됐어요';

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

      {!blocked && (
        <Button type="button" onClick={onPublish} loading={busy} fullWidth>
          최종 공개하기
        </Button>
      )}
      {blocked && (
        <p className="text-[12px] text-red-700">
          위 내용을 고치고 다시 &ldquo;공개하기&rdquo;를 눌러주세요.
        </p>
      )}
    </div>
  );
}
