'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { ChipGroup, toggleInArray } from '@/components/ui/Chip';
import { RegionPicker } from '@/components/ui/RegionPicker';
import { useToast } from '@/components/ui/Toast';
import { TimePreferenceEditor } from '@/app/my/_components/TimePreferenceEditor';
import { TalentPreferenceEditor } from '@/app/my/_components/TalentPreferenceEditor';
import {
  CATEGORIES,
  GENDER_LABEL,
  LIMITS,
  NOTIFICATION_TYPES,
  type Gender,
  type TimePref,
  type NotificationType,
} from '@/lib/constants';
import { NOTIFICATION_TEMPLATE } from '@/lib/queries/notifications';
import { updateNotifySettings, updateProfile } from '@/lib/mutations';
import { getBioValidationError } from '@/lib/utils/profile-validation';

const CATEGORY_OPTIONS = ['전체', ...CATEGORIES] as const;

interface Initial {
  name: string;
  nickname: string;
  gender: Gender;
  bio: string;
  skills: string[] | null;
  categories: string[];
  /** @deprecated timePrefs 로 옮기는 중입니다. 추천 점수가 아직 이 값을 씁니다 */
  availableTimes: string[];
  /** 참여 가능 시간 2단계 (F38). [{ day: '평일', slots: ['오전'] }] */
  timePrefs: TimePref[];
  /** 사용자가 끈 알림 종류. 빈 배열이면 전부 받습니다 (F25) */
  notifyOff: NotificationType[];
  regions: string[];
}

const label = 'text-[13px] font-medium text-neutral-700';
const locked =
  'flex min-h-11 items-center justify-between rounded-xl bg-neutral-100 px-4 py-3 text-[15px] text-neutral-500';

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
  const [skills, setSkills] = useState<string[] | null>(initial.skills);
  const [categories, setCategories] = useState(initial.categories);
  const [timePrefs, setTimePrefs] = useState<TimePref[]>(
    initial.timePrefs.length > 0
      ? initial.timePrefs
      : [{ day: '상관없음', slots: ['상관없음'] }],
  );
  const [notifyOff, setNotifyOff] = useState<NotificationType[]>(
    initial.notifyOff,
  );
  const [regions, setRegions] = useState(initial.regions);
  const [busy, setBusy] = useState(false);

  function toggleCategory(value: (typeof CATEGORY_OPTIONS)[number]) {
    if (value === '전체') {
      setCategories((current) => (current.includes('전체') ? [] : ['전체']));
      return;
    }
    setCategories((current) =>
      toggleInArray(
        current.filter((category) => category !== '전체'),
        value,
      ),
    );
  }

  function toggleNotification(type: NotificationType) {
    setNotifyOff((current) =>
      current.includes(type)
        ? current.filter((item) => item !== type)
        : [...current, type],
    );
  }

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

    if (
      timePrefs.length === 0 ||
      timePrefs.some((preference) => preference.slots.length === 0)
    ) {
      toast('참여 가능한 요일과 시간대를 하나 이상 선택해주세요.', 'error');
      return;
    }

    const bioError = getBioValidationError(bio);
    if (bioError) {
      toast(bioError, 'error');
      return;
    }

    setBusy(true);
    const supabase = createClient();

    // 저장은 공용 함수로 합니다. 닉네임 중복·길이 검사가 이 안에 들어 있고,
    // timePrefs 를 넘기면 옛 available_times 도 함께 채워집니다.
    // (추천 점수가 아직 옛 컬럼을 봐서, 한쪽만 채우면 추천이 조용히 어긋납니다)
    const res = await updateProfile(supabase, userId, {
      nickname: nick,
      bio,
      skills,
      categories,
      regions,
      timePrefs,
    });

    if (!res.ok) {
      toast(res.message, 'error');
      setBusy(false);
      return;
    }

    const notifyResult = await updateNotifySettings(
      supabase,
      userId,
      notifyOff,
    );
    if (!notifyResult.ok) {
      toast(notifyResult.message, 'error');
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
          className="min-h-11 rounded-xl border border-neutral-300 px-4 py-3 text-[15px] outline-none focus:border-neutral-900"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={label}>자기소개</span>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={LIMITS.BIO_MAX}
          rows={3}
          placeholder="어떤 활동에 관심이 있는지 짧게 적어보세요."
          className="rounded-xl border border-neutral-300 p-4 text-[15px] leading-relaxed outline-none focus:border-neutral-900"
        />
        <span className="text-right text-[11px] text-neutral-400">
          {bio.length}/{LIMITS.BIO_MAX}
        </span>
      </label>

      <div className="flex flex-col gap-2.5">
        <span className={label}>나눌 수 있는 재능</span>
        <TalentPreferenceEditor value={skills} onChange={setSkills} />
      </div>

      <div className="flex flex-col gap-2.5">
        <span className={label}>관심 카테고리</span>
        <ChipGroup
          options={CATEGORY_OPTIONS}
          selected={categories as (typeof CATEGORY_OPTIONS)[number][]}
          onToggle={toggleCategory}
        />
      </div>

      <div className="flex flex-col gap-2.5">
        <span className={label}>보통 언제 참여할 수 있나요?</span>
        <TimePreferenceEditor value={timePrefs} onChange={setTimePrefs} />
      </div>

      <div className="flex flex-col gap-2.5">
        <span className={label}>활동 가능 지역</span>
        <RegionPicker value={regions} onChange={setRegions} />
      </div>

      <section id="notification-settings" className="flex flex-col gap-3 pt-2">
        <div>
          <h2 className="text-[15px] font-bold text-neutral-900">알림 설정</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-neutral-500">
            끈 알림은 새로 만들어지지 않습니다. 이미 받은 알림은 그대로 남아요.
          </p>
        </div>

        <div className="divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-200">
          {NOTIFICATION_TYPES.map((type) => {
            const enabled = !notifyOff.includes(type);
            const template = NOTIFICATION_TEMPLATE[type];
            return (
              <div
                key={type}
                className="flex items-center justify-between gap-4 bg-white px-4 py-3.5"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-neutral-800">
                    <span className="mr-2" aria-hidden="true">
                      {template.icon}
                    </span>
                    {template.title}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  aria-label={`${template.title} 알림 ${enabled ? '끄기' : '켜기'}`}
                  onClick={() => toggleNotification(type)}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                    enabled ? 'bg-neutral-900' : 'bg-neutral-300'
                  }`}
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                      enabled ? 'left-6' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-app border-t border-neutral-200 bg-white p-4">
        <Button size="lg" fullWidth loading={busy} onClick={handleSave}>
          저장
        </Button>
      </div>
    </div>
  );
}
