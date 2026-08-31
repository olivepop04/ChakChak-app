'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { ChipGroup, toggleInArray } from '@/components/ui/Chip';
import { RegionPicker } from '@/components/ui/RegionPicker';
import { useToast } from '@/components/ui/Toast';
import {
  CATEGORIES,
  AVAILABLE_TIMES,
  GENDER_LABEL,
  LIMITS,
  type Gender,
} from '@/lib/constants';

interface Initial {
  name: string;
  nickname: string;
  gender: Gender;
  bio: string;
  categories: string[];
  availableTimes: string[];
  regions: string[];
}

const label = 'text-[13px] font-medium text-neutral-700';
const locked =
  'flex h-12 items-center justify-between rounded-xl bg-neutral-100 px-4 text-[15px] text-neutral-500';

export function ProfileEditForm({
  userId,
  initial,
}: {
  userId: string;
  initial: Initial;
}) {
  const router = useRouter();
  const toast = useToast();

  const [nickname, setNickname] = useState(initial.nickname);
  const [bio, setBio] = useState(initial.bio);
  const [categories, setCategories] = useState(initial.categories);
  const [times, setTimes] = useState(initial.availableTimes);
  const [regions, setRegions] = useState(initial.regions);
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    if (busy) return;

    const nick = nickname.trim();
    if (nick.length < LIMITS.NICKNAME_MIN || nick.length > LIMITS.NICKNAME_MAX) {
      toast(
        `닉네임은 ${LIMITS.NICKNAME_MIN}~${LIMITS.NICKNAME_MAX}자로 입력해주세요.`,
        'error',
      );
      return;
    }

    setBusy(true);
    const supabase = createClient();

    // 닉네임을 바꿨다면 중복 확인
    if (nick !== initial.nickname) {
      const { data: taken } = await supabase
        .from('profiles')
        .select('id')
        .eq('nickname', nick)
        .maybeSingle();
      if (taken) {
        toast('이미 사용 중인 닉네임이에요.', 'error');
        setBusy(false);
        return;
      }
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        nickname: nick,
        bio: bio.trim() || null,
        categories,
        available_times: times,
        regions,
      })
      .eq('id', userId);

    if (error) {
      toast('저장에 실패했어요.', 'error');
      setBusy(false);
      return;
    }

    toast('저장했어요.', 'success');
    router.push('/my');
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6 px-5 pb-28 pt-5">
      {/* 수정 불가 항목 */}
      <div className="flex flex-col gap-1.5">
        <span className={label}>이름</span>
        <div className={locked}>
          {initial.name}
          <span className="text-[11px]">🔒 수정 불가</span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={label}>성별</span>
        <div className={locked}>
          {GENDER_LABEL[initial.gender]}
          <span className="text-[11px]">🔒 수정 불가</span>
        </div>
        <span className="text-[11px] text-neutral-400">
          성별 조건이 있는 액션을 안내하는 데 쓰여서 변경할 수 없어요.
        </span>
      </div>

      {/* 수정 가능 항목 */}
      <label className="flex flex-col gap-1.5">
        <span className={label}>닉네임</span>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          className="h-12 rounded-xl border border-neutral-300 px-4 text-[15px] outline-none focus:border-neutral-900"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={label}>자기소개</span>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          placeholder="어떤 활동에 관심이 있는지 짧게 적어보세요."
          className="rounded-xl border border-neutral-300 p-4 text-[15px] leading-relaxed outline-none focus:border-neutral-900"
        />
      </label>

      <div className="flex flex-col gap-2.5">
        <span className={label}>관심 카테고리</span>
        <ChipGroup
          options={CATEGORIES}
          selected={categories as (typeof CATEGORIES)[number][]}
          onToggle={(v) => setCategories(toggleInArray(categories, v))}
        />
      </div>

      <div className="flex flex-col gap-2.5">
        <span className={label}>보통 언제 참여할 수 있나요?</span>
        <ChipGroup
          options={AVAILABLE_TIMES}
          selected={times as (typeof AVAILABLE_TIMES)[number][]}
          onToggle={(v) => setTimes(toggleInArray(times, v))}
        />
      </div>

      <div className="flex flex-col gap-2.5">
        <span className={label}>활동 가능 지역</span>
        <RegionPicker value={regions} onChange={setRegions} />
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-app border-t border-neutral-200 bg-white p-4">
        <Button size="lg" fullWidth loading={busy} onClick={handleSave}>
          저장
        </Button>
      </div>
    </div>
  );
}
