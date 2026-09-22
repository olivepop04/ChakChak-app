'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import {
  SKILLS,
  SKILL_NONE,
} from '@/lib/constants';
import {
  buildStoredSkills,
  SKILL_OTHER_OPTION,
  splitStoredSkills,
} from '@/app/my/_components/skill-selection';

const OPTIONS = [
  ...SKILLS,
  SKILL_OTHER_OPTION,
  SKILL_NONE,
] as const;

export function TalentPreferenceEditor({
  value,
  onChange,
}: {
  value: string[] | null;
  onChange: (value: string[] | null) => void;
}) {
  const initial = splitStoredSkills(value, SKILLS);
  const [selected, setSelected] = useState<string[]>(initial.selected);
  const [other, setOther] = useState(initial.other);

  function commit(nextSelected: string[], nextOther = other) {
    setSelected(nextSelected);
    setOther(nextOther);
    onChange(buildStoredSkills(nextSelected, nextOther, SKILLS));
  }

  function toggle(option: string) {
    if (option === SKILL_NONE) {
      commit(selected.includes(option) ? [] : [option], '');
      return;
    }

    const withoutExclusive = selected.filter(
      (item) => item !== SKILL_NONE,
    );
    const next = withoutExclusive.includes(option)
      ? withoutExclusive.filter((item) => item !== option)
      : [...withoutExclusive, option];
    commit(next, next.includes(SKILL_OTHER_OPTION) ? other : '');
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((option) => {
          const active = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(option)}
              className={`rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors ${
                active
                  ? 'border-neutral-900 bg-neutral-900 text-white'
                  : 'border-neutral-300 bg-white text-neutral-600 hover:border-neutral-500'
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>

      {selected.includes(SKILL_OTHER_OPTION) && (
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-neutral-600">
            목록에 없는 재능
          </span>
          <Input
            value={other}
            maxLength={40}
            onChange={(event) => commit(selected, event.target.value)}
            placeholder="예: 수어 통역"
          />
          <span className="text-right text-[11px] text-neutral-400">
            {other.length} / 40
          </span>
        </label>
      )}

      <p className="text-[11px] leading-relaxed text-neutral-400">
        여러 개를 고를 수 있어요. 목록에 없다면 기타에 직접 입력하고,
        나중에 프로필에서 바꿀 수 있습니다.
      </p>
    </div>
  );
}
