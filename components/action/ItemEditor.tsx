/**
 * 모집 항목 편집기 (Creation 화면에서 사용).
 *
 * 팀 합의(D1) — 모집 방식은 딱 두 가지입니다.
 *
 *   정해진 인원  → target_type='RANGE'   최소 [3]명 ~ 최대 [5]명
 *   최소 인원만  → target_type='MINIMUM' 최소 [10]명 (상한 없음)
 *
 * "정확히 3명" 은 별도 종류가 아니라 최소=최대=3 입니다.
 * 사용자에게는 입력한 값에 따라 "정확히 3명" 으로 보여줍니다.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { UsersRound, Package } from 'lucide-react';
import {
  PERSON_UNIT,
  GENDER_REQUIREMENTS,
  GENDER_REQUIREMENT_LABEL,
  type GenderRequirement,
} from '@/lib/constants';
import type { ActionItemInput } from '@/lib/mutations';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

/** 입력값이 화면에 어떻게 보일지 미리 알려준다 */
function preview(item: ActionItemInput): string {
  const unit = item.type === 'PERSON' ? PERSON_UNIT : item.unit || '개';
  if (item.targetType === 'MINIMUM') return `최소 ${item.minRequired}${unit}`;
  if (item.maxAllowed === item.minRequired)
    return `정확히 ${item.minRequired}${unit}`;
  return `${item.minRequired}~${item.maxAllowed}${unit}`;
}

const emptyPerson = (): ActionItemInput => ({
  type: 'PERSON',
  name: '',
  targetType: 'MINIMUM',
  minRequired: 1,
  maxAllowed: null,
  unit: PERSON_UNIT,
  genderRequirement: 'ANY',
  conditionName: '',
  conditionDesc: '',
});

const emptyGoods = (): ActionItemInput => ({
  type: 'GOODS',
  name: '',
  targetType: 'MINIMUM',
  minRequired: 1,
  maxAllowed: null,
  unit: '개',
  genderRequirement: 'ANY',
});

const quantityInput =
  'h-8 w-10 appearance-none rounded-lg border border-hairline text-center text-sm outline-none focus:border-hairline-focus [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none';

function DeferredNumberInput({
  value,
  min,
  onCommit,
  className,
}: {
  value: number;
  min: number;
  onCommit: (value: number) => void;
  className?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(String(value));
  }, [value]);

  function commit() {
    focused.current = false;

    const parsed = Number(draft);
    const normalized = Number.isFinite(parsed) ? Math.max(min, Math.trunc(parsed)) : min;

    setDraft(String(normalized));
    onCommit(normalized);
  }

  return (
    <input
      type="number"
      min={min}
      value={draft}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      className={className}
    />
  );
}

export function ItemEditor({
  items,
  onChange,
}: {
  items: ActionItemInput[];
  onChange: (items: ActionItemInput[]) => void;
}) {
  function update(index: number, patch: Partial<ActionItemInput>) {
    onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  /** 모집 방식을 바꿀 때 max 를 함께 맞춰준다 (DB CHECK 위반 방지) */
  function setTargetType(index: number, targetType: 'RANGE' | 'MINIMUM') {
    const it = items[index];
    update(index, {
      targetType,
      maxAllowed: targetType === 'MINIMUM' ? null : (it.maxAllowed ?? it.minRequired),
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => (
        <div
          key={i}
          className="flex flex-col gap-3 rounded-xl bg-[#F5F5F7] p-4"
        >
          {/* 종류 + 삭제 */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand bg-brand-soft px-3 py-1.5 text-label font-semibold text-brand">
              {item.type === 'PERSON' ? (
                <UsersRound className="h-3.5 w-3.5" />
              ) : (
                <Package className="h-3.5 w-3.5" />
              )}
              {item.type === 'PERSON' ? '인원' : '물품'}
            </span>

            <span className="ml-auto text-label font-bold text-hairline-focus">
              {preview(item)}
            </span>

            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="항목 삭제"
              className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100"
            >
              ×
            </button>
          </div>

          {/* 이름 */}
          <Input
            value={item.name}
            onChange={(e) => update(i, { name: e.target.value })}
            placeholder={
              item.type === 'PERSON' ? '예: 요리 담당, 운반 지원' : '예: 분유, 기저귀'
            }
          />

          {/* 모집 방식 */}
          <div className="flex flex-col gap-2">
            <span className="text-label font-medium text-neutral-700">
              {item.type === 'PERSON' ? '몇 명이 필요한가요?' : '얼마나 필요한가요?'}
            </span>

            <label className="flex items-center gap-2 text-label text-neutral-700">
              <input
                type="radio"
                checked={item.targetType === 'RANGE'}
                onChange={() => setTargetType(i, 'RANGE')}
                className="accent-neutral-900"
              />
              {item.type === 'PERSON' ? '정해진 인원이 필요해요' : '정해진 수량이 필요해요'}
            </label>

            {item.targetType === 'RANGE' && (
              <div className="flex items-center gap-2 pl-6">
                <DeferredNumberInput
                  min={1}
                  value={item.minRequired}
                  onCommit={(minRequired) =>
                    update(i, {
                      minRequired,
                      maxAllowed: Math.max(minRequired, item.maxAllowed ?? minRequired),
                    })
                  }
                  className={quantityInput}
                />
                <span className="text-label text-neutral-500">~</span>
                <DeferredNumberInput
                  min={item.minRequired}
                  value={item.maxAllowed ?? item.minRequired}
                  onCommit={(maxAllowed) => update(i, { maxAllowed })}
                  className={quantityInput}
                />
                <span className="text-label text-neutral-500">
                  {item.type === 'PERSON' ? PERSON_UNIT : item.unit || '개'}
                </span>
              </div>
            )}

            <label className="flex items-center gap-2 text-label text-neutral-700">
              <input
                type="radio"
                checked={item.targetType === 'MINIMUM'}
                onChange={() => setTargetType(i, 'MINIMUM')}
                className="accent-neutral-900"
              />
              {item.type === 'PERSON'
                ? '최소 인원만 정할게요 (계속 모집)'
                : '최소 수량만 정할게요 (계속 모집)'}
            </label>

            {item.targetType === 'MINIMUM' && (
              <div className="flex items-center gap-2 pl-6">
                <span className="text-label text-neutral-500">최소</span>
                <DeferredNumberInput
                  min={1}
                  value={item.minRequired}
                  onCommit={(minRequired) => update(i, { minRequired })}
                  className={quantityInput}
                />
                <span className="text-label text-neutral-500">
                  {item.type === 'PERSON' ? PERSON_UNIT : item.unit || '개'}
                </span>
              </div>
            )}
          </div>

          {/* 물품: 단위 */}
          {item.type === 'GOODS' && (
            <div className="flex flex-col gap-1.5">
              <span className="text-label font-medium text-neutral-700">단위</span>
              <Input
                type="text"
                value={item.unit ?? ''}
                onChange={(e) => update(i, { unit: e.target.value })}
                placeholder="개"
                className="w-28"
              />
            </div>
          )}

          {/* 사람: 성별 제한 + 조건 */}
          {item.type === 'PERSON' && (
            <>
              <div className="flex flex-col gap-1.5">
                <span className="text-label font-medium text-neutral-700">
                  성별 조건
                </span>
                <div className="flex gap-1.5">
                  {GENDER_REQUIREMENTS.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => update(i, { genderRequirement: g })}
                      className={`rounded-full border px-3 py-1.5 text-label ${
                        (item.genderRequirement ?? 'ANY') === g
                          ? 'border-hairline-focus bg-white font-semibold text-hairline-focus'
                          : 'border-neutral-300 bg-white text-neutral-600'
                      }`}
                    >
                      {GENDER_REQUIREMENT_LABEL[g as GenderRequirement]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-label font-medium text-neutral-700">
                  참여 조건 <span className="text-caption font-normal text-neutral-400">(선택)</span>
                </span>
                <Input
                  value={item.conditionName ?? ''}
                  onChange={(e) => update(i, { conditionName: e.target.value })}
                  placeholder="예: 조리사 자격증 보유"
                />
              </div>
            </>
          )}
        </div>
      ))}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onChange([...items, emptyPerson()])}
        >
          ＋ 인원
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onChange([...items, emptyGoods()])}
        >
          ＋ 물품
        </Button>
      </div>

      {items.length === 0 && (
        <p className="text-caption text-neutral-400">
          함께할 사람이나 필요한 물품을 하나 이상 추가해주세요.
        </p>
      )}
    </div>
  );
}
