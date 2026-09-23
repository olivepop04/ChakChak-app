/** 공개한 액션의 소개·안내사항만 수정하는 폼. */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { updateActionText } from '@/lib/mutations';
import { Button } from '@/components/ui/Button';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { useToast } from '@/components/ui/Toast';

export function ActionTextEditForm({
  actionId,
  initialDescription,
  initialNotice,
}: {
  actionId: string;
  initialDescription: string;
  initialNotice: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [description, setDescription] = useState(initialDescription);
  const [notice, setNotice] = useState(initialNotice);
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    if (busy) return;
    setBusy(true);

    const res = await updateActionText(createClient(), actionId, {
      description,
      notice,
    });

    if (!res.ok) {
      toast(res.message, 'error');
      setBusy(false);
      return;
    }

    toast('수정했어요.', 'success');
    router.push(`/action/${actionId}`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6 px-6 pb-24 pt-6">
      <label className="flex flex-col gap-1.5">
        <FieldLabel>소개</FieldLabel>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={9}
          placeholder="어떤 활동인지, 참여하면 무엇을 하게 되는지 적어주세요."
          className="rounded-xl border border-neutral-300 p-4 text-body leading-relaxed outline-none focus:border-neutral-900"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <FieldLabel>안내사항</FieldLabel>
        <textarea
          value={notice}
          onChange={(event) => setNotice(event.target.value)}
          rows={6}
          placeholder="예: 편한 옷차림으로 와주세요. 물은 준비되어 있습니다."
          className="rounded-xl border border-neutral-300 p-4 text-body leading-relaxed outline-none focus:border-neutral-900"
        />
      </label>

      <div className="pt-2">
        <Button
          type="button"
          size="lg"
          fullWidth
          loading={busy}
          onClick={handleSave}
        >
          수정 내용 저장하기
        </Button>
      </div>
    </div>
  );
}
