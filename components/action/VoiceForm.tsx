/**
 * 소감 입력 폼.
 *
 * 10~1000자. 저장하면 참여 상태가 ACTUALLY_PARTICIPATED 로 바뀌고
 * MY 의 "참여 액션 수" 에 반영됩니다.
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { submitCrewVoice } from '@/lib/mutations';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { LIMITS } from '@/lib/constants';

export function VoiceForm({
  actionId,
  actionTitle,
}: {
  actionId: string;
  actionTitle: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);

  const length = content.trim().length;
  const tooShort = length > 0 && length < LIMITS.CREW_VOICE_MIN;
  const canSubmit = length >= LIMITS.CREW_VOICE_MIN;

  async function handleSubmit() {
    if (busy || !canSubmit) return;
    setBusy(true);

    const res = await submitCrewVoice(createClient(), actionId, content);
    if (!res.ok) {
      toast(res.message, 'error');
      setBusy(false);
      return;
    }

    toast('소감을 남겼어요. 참여가 완료되었어요!', 'success');
    router.push(`/action/${actionId}/result`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5 px-5 pb-[calc(8rem+var(--nav-h)+env(safe-area-inset-bottom))] pt-6">
      <div>
        <h1 className="text-xl font-bold leading-snug tracking-tight text-neutral-900">
          함께한 소감을
          <br />
          남겨주세요.
        </h1>
        <p className="mt-2 line-clamp-2 text-label text-neutral-500">
          「{actionTitle}」
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <textarea
          autoFocus
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={9}
          maxLength={LIMITS.CREW_VOICE_MAX}
          placeholder="어떤 점이 좋았는지, 어떤 마음이 들었는지 자유롭게 적어주세요."
          className="rounded-xl border border-neutral-300 p-4 text-body leading-relaxed outline-none focus:border-neutral-900"
        />
        <div className="flex items-center justify-between">
          <span className="text-caption text-red-600">
            {tooShort ? `${LIMITS.CREW_VOICE_MIN}자 이상 적어주세요.` : ''}
          </span>
          <span className="text-caption tabular-nums text-neutral-400">
            {length} / {LIMITS.CREW_VOICE_MAX}
          </span>
        </div>
      </div>

      <p className="rounded-xl bg-neutral-50 px-4 py-3 text-caption leading-relaxed text-neutral-500">
        소감을 남기면 이 액션이 <b className="font-semibold text-neutral-700">참여 완료</b>로
        바뀌고, 내 프로필의 참여 횟수에 반영돼요. 남긴 소감은 결과 화면에 공개됩니다.
      </p>

      {/* 탭이 보이는 화면이라 탭 높이(--nav-h)만큼 띄웁니다 (2026-09-18) */}
      <div className="fixed inset-x-0 bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom))] z-30 mx-auto max-w-app border-t border-neutral-200 bg-white p-4">
        <Button
          type="button"
          size="lg"
          fullWidth
          loading={busy}
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          소감 남기기
        </Button>
      </div>
    </div>
  );
}
