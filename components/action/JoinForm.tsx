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
import { Check, Minus, Plus, UsersRound, Package } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { joinAction, type JoinItemInput } from '@/lib/mutations';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils/cn';
import { meetsGender, getQuotaState } from '@/lib/utils/quota';
import { PERSON_UNIT, GENDER_REQUIREMENT_LABEL, type Gender } from '@/lib/constants';
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

  /**
   * 스테퍼 가운데 숫자를 직접 칠 때 (8/31 결정 「수량도 직접 타이핑 가능」).
   * 목표가 큰 물품(연탄 1000장 등)을 +만으로 올리기 어려워서 되살렸다 (2026-09-28).
   * 숫자만 받고, 지우는 중에는 빈칸(0)을 허용 — 칸을 벗어날 때 1 미만이면 1로 맞춘다.
   */
  function typeQuantity(itemId: string, raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    setSelection((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], quantity: digits === '' ? 0 : Number(digits) },
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
      quantity: i.type === 'PERSON' ? 1 : Math.max(1, selection[i.id].quantity),
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
    <div className="flex flex-col gap-6 px-6 pb-[calc(10rem+var(--nav-h)+env(safe-area-inset-bottom))] pt-4">
      <div>
        <h2 className="text-subtitle font-bold text-neutral-900">
          내가 할 수 있는 일
        </h2>
        <p className="mt-1 text-label text-neutral-500">
          여러 항목을 함께 선택할 수 있어요.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {items.map((item) => {
          const genderOk = meetsGender(item, myGender);
          const disabled = item.isFull || !genderOk;
          const sel = selection[item.id];
          const state = getQuotaState(item, item.currentCount);
          const genderReq = item.gender_requirement ?? 'ANY';
          const ItemIcon = item.type === 'PERSON' ? UsersRound : Package;

          return (
            <div
              key={item.id}
              className={cn(
                'rounded-xl border bg-white p-4 transition-colors',
                sel?.checked ? 'border-[1.5px] border-brand' : 'border-neutral-200',
                disabled && 'opacity-50',
              )}
            >
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={sel?.checked ?? false}
                  disabled={disabled}
                  onChange={() => toggle(item.id)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    'mt-1 flex h-5 w-5 flex-none items-center justify-center rounded',
                    sel?.checked ? 'bg-brand' : 'border-[1.5px] border-neutral-300 bg-white',
                  )}
                >
                  {sel?.checked && <Check className="h-3.5 w-3.5 stroke-[3] text-white" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-2">
                    {/* 상단: 아이콘 + 항목명 + 최종 모집 수 (한 row) */}
                    <div className="flex items-center gap-2">
                      {/* 원 안의 아이콘 (테두리 없음) */}
                      <div
                        className={cn(
                          'flex h-9 w-9 flex-none items-center justify-center rounded-full',
                          state.isMinMet ? 'bg-brand-soft' : 'bg-neutral-100',
                        )}
                      >
                        <ItemIcon
                          className={cn(
                            'h-[18px] w-[18px]',
                            state.isMinMet ? 'text-brand' : 'text-neutral-500',
                          )}
                          aria-hidden="true"
                        />
                      </div>

                      <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="text-body font-semibold text-neutral-900">{item.name}</span>
                        {genderReq !== 'ANY' && (
                          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-caption font-medium text-neutral-600">
                            {GENDER_REQUIREMENT_LABEL[genderReq]}
                          </span>
                        )}
                        {item.conditionName && (
                          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-caption font-medium text-neutral-600">
                            {item.conditionName}
                          </span>
                        )}
                      </div>

                      {/* 최종 모집 수만 표시 (목표 수 미표시) */}
                      <span
                        className={cn(
                          'shrink-0 text-body font-bold tabular-nums',
                          state.isMinMet ? 'text-brand' : 'text-neutral-900',
                        )}
                      >
                        {item.currentCount}{item.unit}
                      </span>
                    </div>

                    {/* 프로그레스바 게이지 (아이콘 앞까지 옴) + 안내 문구(막대와 4px) */}
                    <div className="flex flex-col gap-1">
                      <div
                        className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200"
                        role="progressbar"
                        aria-valuenow={Math.round(state.ratio * 100)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${item.name} 모집 현황`}
                      >
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-300',
                            state.isMinMet ? 'bg-brand' : 'bg-neutral-400',
                          )}
                          style={{ width: `${Math.max(state.ratio * 100, 2)}%` }}
                        />
                      </div>
                      <p
                        className={cn(
                          'text-caption font-medium',
                          state.isMinMet ? 'text-brand' : 'text-neutral-500',
                        )}
                      >
                        {state.hint}
                      </p>
                    </div>
                  </div>
                </div>
              </label>

              {!genderOk && (
                <p className="mt-2 pl-8 text-label font-medium text-red-600">
                  성별 조건이 맞지 않아 참여할 수 없어요.
                </p>
              )}

              {/* 물품만 수량 입력. 사람은 항상 1명입니다. */}
              {item.type === 'GOODS' && sel?.checked && (
                <div className="mt-3 flex items-center gap-2 pl-8">
                  {/* 스테퍼 28px(2026-09-28 한 단계 축소: 32→28, 아이콘 16→14) · 가운데 숫자는 직접 입력 가능 */}
                  <div className="flex h-7 items-center rounded-full border-[1.5px] border-hairline-focus">
                    <button
                      type="button"
                      onClick={() => setQuantity(item.id, sel.quantity - 1)}
                      className="flex h-7 w-7 flex-none items-center justify-center rounded-full"
                      aria-label="수량 줄이기"
                    >
                      <Minus className="h-3.5 w-3.5 text-hairline-focus" />
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      value={sel.quantity === 0 ? '' : String(sel.quantity)}
                      onChange={(e) => typeQuantity(item.id, e.target.value)}
                      onFocus={(e) => e.target.select()}
                      onBlur={() => {
                        if (sel.quantity < 1) setQuantity(item.id, 1);
                      }}
                      aria-label={`${item.name} 수량`}
                      className="h-6 w-9 rounded-lg bg-transparent p-0 text-center text-label font-semibold tabular-nums text-hairline-focus outline-none focus:bg-neutral-100"
                    />
                    <button
                      type="button"
                      onClick={() => setQuantity(item.id, sel.quantity + 1)}
                      className="flex h-7 w-7 flex-none items-center justify-center rounded-full"
                      aria-label="수량 늘리기"
                    >
                      <Plus className="h-3.5 w-3.5 text-hairline-focus" />
                    </button>
                  </div>
                  <span className="text-label text-neutral-600">{item.unit}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 나의 참여 요약 */}
      {chosen.length > 0 && (
        <section className="flex flex-col gap-2 rounded-xl bg-brand-soft p-4">
          <h3 className="text-subtitle font-bold text-brand">나의 참여</h3>
          <ul className="flex flex-col gap-1">
            {chosen.map((i) => {
              const Icon = i.type === 'PERSON' ? UsersRound : Package;
              return (
                <li
                  key={i.id}
                  className="flex items-center gap-2 text-body font-semibold text-neutral-900"
                >
                  <Icon className="h-4 w-4 flex-none text-brand" aria-hidden="true" />
                  {i.type === 'PERSON'
                    ? `${i.name} 1${PERSON_UNIT}`
                    : `${i.name} ${Math.max(1, selection[i.id].quantity)}${i.unit}`}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2.5 text-label text-red-600">
          {error}
        </p>
      )}

      {/* 탭이 보이는 화면이라 탭 높이(--nav-h)만큼 띄웁니다 (2026-09-18) */}
      <div className="fixed inset-x-0 bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom))] z-30 mx-auto max-w-app bg-white px-6 py-4">
        {/* 못 누를 때는 흐린 그린이 아니라 회색 한 가지 (Day14 통일안) */}
        <Button
          type="button"
          size="lg"
          fullWidth
          loading={busy}
          disabled={chosen.length === 0}
          onClick={handleSubmit}
          className="disabled:bg-neutral-200 disabled:text-neutral-400 disabled:opacity-100"
        >
          참여 확정하기
        </Button>
      </div>
    </div>
  );
}
