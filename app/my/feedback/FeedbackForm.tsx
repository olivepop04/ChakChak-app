'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { submitFeedback } from '@/lib/mutations';
import { Button } from '@/components/ui/Button';
import { ChipGroup } from '@/components/ui/Chip';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { useToast } from '@/components/ui/Toast';
import {
  FEEDBACK_BODY_MAX,
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_LABEL,
  getFeedbackValidationError,
  type FeedbackCategory,
} from '@/lib/utils/feedback';

const LABELS = FEEDBACK_CATEGORIES.map((c) => FEEDBACK_CATEGORY_LABEL[c]);

const PLACEHOLDER: Record<FeedbackCategory, string> = {
  INQUIRY: '궁금한 점을 적어주세요.',
  SUGGESTION: '이런 기능이 있으면 좋겠다, 여기가 불편했다 같은 의견을 자유롭게 적어주세요.',
  BUG: '어느 화면에서 무엇을 눌렀을 때 어떻게 됐는지 적어주시면 빨리 고칠 수 있어요.',
};

function categoryOf(label: string): FeedbackCategory | null {
  return FEEDBACK_CATEGORIES.find((c) => FEEDBACK_CATEGORY_LABEL[c] === label) ?? null;
}

export function FeedbackForm() {
  const router = useRouter();
  const toast = useToast();

  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    if (busy) return;
    setError('');

    const invalid = getFeedbackValidationError(category, body);
    if (invalid) {
      setError(invalid);
      return;
    }

    setBusy(true);
    const res = await submitFeedback(createClient(), category as FeedbackCategory, body);
    if (!res.ok) {
      setBusy(false);
      setError(res.message);
      return;
    }

    toast('보냈어요. 소중한 의견 고맙습니다.');
    // 이동 뒤에 refresh — 규칙상 push 다음에 둡니다 (CLAUDE.md 「쓰기」).
    router.push('/my');
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6 px-6 pt-4">
      <p className="text-label leading-relaxed text-neutral-500">
        보내주신 내용은 운영진만 읽어요. 하나하나 읽고 서비스에 반영할게요.
        <br />
        연락처 같은 개인정보는 적지 말아주세요.
      </p>

      <div className="flex flex-col gap-2.5">
        <FieldLabel>무엇을 보내시나요?</FieldLabel>
        <ChipGroup
          options={LABELS}
          selected={category ? [FEEDBACK_CATEGORY_LABEL[category]] : []}
          onToggle={(label) => {
            const next = categoryOf(label);
            setCategory((current) => (current === next ? null : next));
          }}
          tone="soft"
        />
      </div>

      <label className="flex flex-col gap-1.5">
        <FieldLabel>내용</FieldLabel>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={FEEDBACK_BODY_MAX}
          rows={8}
          placeholder={category ? PLACEHOLDER[category] : '먼저 위에서 종류를 골라주세요.'}
          className="rounded-xl border border-hairline px-4 py-3 text-body leading-relaxed outline-none transition-colors focus:border-hairline-focus"
        />
        <span className="text-right text-caption text-neutral-400">
          {body.length}/{FEEDBACK_BODY_MAX}
        </span>
      </label>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-label text-red-600" role="alert">
          {error}
        </p>
      )}

      <Button type="button" size="lg" fullWidth loading={busy} onClick={handleSubmit}>
        보내기
      </Button>
    </div>
  );
}
