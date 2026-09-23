/** 공개된 액션에 새로운 모집 항목만 추가하는 폼. */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { addActionItems, type ActionItemInput } from '@/lib/mutations';
import { ItemEditor } from '@/components/action/ItemEditor';
import { Button } from '@/components/ui/Button';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { useToast } from '@/components/ui/Toast';

export function AddActionItemsForm({ actionId }: { actionId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [newItems, setNewItems] = useState<ActionItemInput[]>([]);
  const [busy, setBusy] = useState(false);

  async function handleAdd() {
    if (busy || newItems.length === 0) return;
    setBusy(true);

    const res = await addActionItems(createClient(), actionId, newItems);
    if (!res.ok) {
      toast(res.message, 'error');
      setBusy(false);
      return;
    }

    setNewItems([]);
    toast('모집 항목을 추가했어요.', 'success');
    router.refresh();
    setBusy(false);
  }

  return (
    <section className="border-t border-neutral-100 px-6 pb-28 pt-6">
      <SectionTitle>모집 항목 추가</SectionTitle>
      <p className="mb-4 mt-1 text-caption leading-relaxed text-neutral-500">
        새로 필요한 인원이나 물품만 추가할 수 있어요.
      </p>

      <ItemEditor items={newItems} onChange={setNewItems} />

      <div className="mt-5">
        <Button
          type="button"
          size="lg"
          fullWidth
          loading={busy}
          disabled={newItems.length === 0}
          onClick={handleAdd}
        >
          모집 항목 추가하기
        </Button>
      </div>
    </section>
  );
}
