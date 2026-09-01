/**
 * 참여 신청 폼.
 *
 * ★ 화면에서 본 숫자를 믿고 신청을 허용하면 안 됩니다.
 *   동시에 두 사람이 마지막 한 자리를 신청하면 둘 다 "1명 더 함께할 수 있어요" 로 보입니다.
 *   그래서 최종 판단은 서버(join_action)가 항목 행을 잠그고 순서대로 합니다.
 *
 *   여기 disabled 는 "미리 알려주기" 용입니다.
 *   서버가 거절하면 그 메시지를 그대로 보여주고 숫자를 새로 불러옵니다.
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { joinAction, type JoinItemInput } from '@/lib/mutations';
import { QuotaProgress } from '@/components/action/QuotaProgress';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { meetsGender } from '@/lib/utils/quota';
import { PERSON_UNIT, type Gender } from '@/lib/constants';
import type { ActionItemWithProgress } from '@/lib/types/view';

interface Selection {
  checked: boolean;
  quantity: number;
}

export function JoinForm({
  actionId,
  items,
  myGender,
}: {
  actionId: string;
  items: ActionItemWithProgress[];
  myGender: Gender | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [selection, setSelection] = useState<Record<string, Selection>>(() =>
    Object.fromEntries(items.map((i) => [i.id, { checked: false, quantity: 1 }])),
  );

  function toggle(itemId: string) {
    setSelection((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], checked: !prev[itemId].checked },
    }));
  }

  function setQuantity(itemId: string, quantity: number) {
    setSelection((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], quantity: Math.max(1, quantity) },
    }));
  }

  const chosen = items.filter((i) => selection[i.id]?.checked);

  async function handleSubmit() {
    if (busy) return;
    setError('');

    if (chosen.length === 0) {
      setError('참여할 항목을 하나 이상 선택해주세요.');
      return;
    }

    setBusy(true);

    const payload: JoinItemInput[] = chosen.map((i) => ({
      actionItemId: i.id,
      // 사람 항목은 항상 1명입니다
      quantity: i.type === 'PERSON' ? 1 : selection[i.id].quantity,
    }));

    const res = await joinAction(createClient(), actionId, payload);

    if (!res.ok) {
      setError(res.message);
      setBusy(false);
      // 다른 사람이 먼저 채웠을 수 있으므로 최신 숫자를 다시 불러옵니다
      router.refresh();
      return;
    }

    router.push(`/action/${actionId}/welcome`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6 px-5 pb-40 pt-4">
      <div>
        <h2 className="text-[17px] font-bold text-neutral-900">
          내가 할 수 있는 일
        </h2>
        <p className="mt-1 text-[13px] text-neutral-500">
          여러 항목을 함께 선택할 수 있어요.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {items.map((item) => {
          const genderOk = meetsGender(item, myGender);
          const disabled = item.isFull || !genderOk;
          const sel = selection[item.id];

          return (
            <div
              key={item.id}
              className={`rounded-xl border p-4 transition-colors ${
                sel?.checked
                  ? 'border-neutral-900 bg-neutral-50'
                  : 'border-neutral-200'
              } ${disabled ? 'opacity-50' : ''}`}
            >
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={sel?.checked ?? false}
                  disabled={disabled}
                  onChange={() => toggle(item.id)}
                  className="mt-1 h-5 w-5 shrink-0 accent-neutral-900"
                />
                <div className="min-w-0 flex-1">
                  <QuotaProgress
                    item={item}
                    current={item.currentCount}
                    detailed
                    conditionName={item.conditionName}
                  />
                </div>
              </label>

              {!genderOk && (
                <p className="mt-2 pl-8 text-[12px] font-medium text-red-600">
                  성별 조건이 맞지 않아 참여할 수 없어요.
                </p>
              )}

              {/* 물품만 수량 입력. 사람은 항상 1명입니다. */}
              {item.type === 'GOODS' && sel?.checked && (
                <div className="mt-3 flex items-center gap-2 pl-8">
                  <button
                    type="button"
                    onClick={() => setQuantity(item.id, sel.quantity - 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-300 text-lg"
                    aria-label="수량 줄이기"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={sel.quantity}
                    onChange={(e) => setQuantity(item.id, Number(e.target.value) || 1)}
                    className="h-9 w-20 rounded-lg border border-neutral-300 px-3 text-center text-sm outline-none focus:border-neutral-900"
                  />
                  <span className="text-sm text-neutral-600">{item.unit}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(item.id, sel.quantity + 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-300 text-lg"
                    aria-label="수량 늘리기"
                  >
                    ＋
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 나의 참여 요약 */}
      {chosen.length > 0 && (
        <section className="flex flex-col gap-2 rounded-xl bg-neutral-900 p-4 text-white">
          <h3 className="text-[13px] font-semibold text-white/70">나의 참여</h3>
          <ul className="flex flex-col gap-1">
            {chosen.map((i) => (
              <li key={i.id} className="text-sm font-medium">
                {i.type === 'PERSON'
                  ? `🙋 ${i.name} 1${PERSON_UNIT}`
                  : `📦 ${i.name} ${selection[i.id].quantity}${i.unit}`}
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2.5 text-[13px] text-red-600">
          {error}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-app border-t border-neutral-200 bg-white p-4">
        <Button
          type="button"
          size="lg"
          fullWidth
          loading={busy}
          disabled={chosen.length === 0}
          onClick={handleSubmit}
        >
          참여 확정하기
        </Button>
      </div>
    </div>
  );
}
