/**
 * 가입 (3단계).
 *
 *   1단계  이메일 · 비밀번호 · 약관 동의 2개
 *   2단계  이름 · 닉네임 · 성별
 *   3단계  관심 카테고리 · 참여 가능 시간 · 활동 지역
 *
 * ★ 계정은 3단계 마지막에 한 번만 만듭니다.
 *   1단계에서 바로 signUp 을 부르면, 중간에 그만둔 사람의 계정이 남습니다.
 *
 * ★ profiles 행은 직접 insert 하지 않습니다.
 *   signUp 의 options.data 에 넣은 값을 DB 트리거(handle_new_user)가 읽어서 만듭니다.
 *   RLS 때문에 클라이언트에서 profiles 에 insert 할 수 없습니다.
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { ChipGroup, toggleInArray } from '@/components/ui/Chip';
import { RegionPicker } from '@/components/ui/RegionPicker';
import { updateProfile } from '@/lib/mutations';
import {
  CATEGORIES,
  AVAILABLE_TIMES,
  GENDER_LABEL,
  GENDERS,
  LIMITS,
  type Gender,
  toTimePrefs,
} from '@/lib/constants';

const inputClass =
  'h-12 rounded-xl border border-neutral-300 px-4 text-[15px] outline-none focus:border-neutral-900';

export default function SignUpPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // 1단계
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);

  // 2단계
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');

  // 3단계
  const [categories, setCategories] = useState<string[]>([]);
  const [times, setTimes] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);

  // ── 1단계 검증 ────────────────────────────────────────────
  function nextFromStep1() {
    setError('');
    if (!email.includes('@')) return setError('이메일 형식을 확인해주세요.');
    if (password.length < 6) return setError('비밀번호는 6자 이상이어야 해요.');
    if (!agreeTerms || !agreePrivacy)
      return setError('필수 약관에 모두 동의해주세요.');
    setStep(2);
  }

  // ── 2단계 검증 (닉네임 중복까지) ───────────────────────────
  async function nextFromStep2() {
    setError('');
    if (!name.trim()) return setError('이름을 입력해주세요.');

    const nick = nickname.trim();
    if (nick.length < LIMITS.NICKNAME_MIN || nick.length > LIMITS.NICKNAME_MAX)
      return setError(
        `닉네임은 ${LIMITS.NICKNAME_MIN}~${LIMITS.NICKNAME_MAX}자로 입력해주세요.`,
      );
    if (!gender) return setError('성별을 선택해주세요.');

    setBusy(true);
    const { data: taken } = await createClient()
      .from('profiles')
      .select('id')
      .eq('nickname', nick)
      .maybeSingle();
    setBusy(false);

    if (taken) return setError('이미 사용 중인 닉네임이에요.');
    setStep(3);
  }

  // ── 3단계: 계정 생성 ──────────────────────────────────────
  async function handleSignUp() {
    setError('');
    setBusy(true);
    const supabase = createClient();

    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        // 이 값들을 DB 트리거가 읽어서 profiles 행을 만듭니다
        data: { name: name.trim(), nickname: nickname.trim(), gender },
      },
    });

    if (signUpError) {
      setBusy(false);
      setError(
        signUpError.message.includes('already')
          ? '이미 가입된 이메일이에요.'
          : '가입에 실패했어요. 잠시 후 다시 시도해주세요.',
      );
      return;
    }

    // 트리거가 만들지 못하는 취향 정보는 여기서 채웁니다
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      // 공용 함수로 저장합니다. timePrefs 를 넘기면 옛 available_times 도
      // 함께 채워져서, 나중에 F38 화면이 생겨도 이 회원의 설정이 보입니다.
      await updateProfile(supabase, user.id, {
        categories,
        regions,
        timePrefs: toTimePrefs(times),
      });
    }

    router.push('/');
    router.refresh();
  }

  return (
    <main className="flex min-h-dvh flex-col px-6 pb-10 pt-14">
      {/* 진행 표시 */}
      <div className="mb-8 flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <span
            key={s}
            className={`h-1 flex-1 rounded-full ${
              s <= step ? 'bg-neutral-900' : 'bg-neutral-200'
            }`}
          />
        ))}
      </div>

      {/* ── 1단계 ── */}
      {step === 1 && (
        <>
          <h1 className="text-[22px] font-bold leading-snug tracking-tight text-neutral-900">
            좋은 일을 찾고,
            <br />
            함께하고, 다시 나누는 곳
          </h1>
          <p className="mt-2 text-[13px] text-neutral-500">
            이메일로 간단히 시작할 수 있어요.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-neutral-700">이메일</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-neutral-700">
                비밀번호
              </span>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
              <span className="text-[11px] text-neutral-400">6자 이상</span>
            </label>

            <div className="mt-2 flex flex-col gap-2">
              <label className="flex items-center gap-2.5 text-[13px] text-neutral-700">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="h-4 w-4 accent-neutral-900"
                />
                <span className="font-semibold text-neutral-500">[필수]</span>
                이용약관에 동의합니다.
              </label>
              <label className="flex items-center gap-2.5 text-[13px] text-neutral-700">
                <input
                  type="checkbox"
                  checked={agreePrivacy}
                  onChange={(e) => setAgreePrivacy(e.target.checked)}
                  className="h-4 w-4 accent-neutral-900"
                />
                <span className="font-semibold text-neutral-500">[필수]</span>
                개인정보 처리방침에 동의합니다.
              </label>
            </div>
          </div>
        </>
      )}

      {/* ── 2단계 ── */}
      {step === 2 && (
        <>
          <h1 className="text-[22px] font-bold leading-snug tracking-tight text-neutral-900">
            먼저, 당신을
            <br />
            조금만 알려주세요.
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-neutral-500">
            액션에 참여하고 다른 사람들과 연결되기 위해
            <br />꼭 필요한 정보만 받을게요.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-neutral-700">이름</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-neutral-700">닉네임</span>
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className={inputClass}
              />
              <span className="text-[11px] text-neutral-400">
                다른 사람에게는 닉네임이 먼저 보여요.
              </span>
            </label>

            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-neutral-700">성별</span>
              <div className="flex gap-2">
                {GENDERS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={`h-12 flex-1 rounded-xl border text-[15px] font-medium ${
                      gender === g
                        ? 'border-neutral-900 bg-neutral-900 text-white'
                        : 'border-neutral-300 bg-white text-neutral-600'
                    }`}
                  >
                    {GENDER_LABEL[g]}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-neutral-400">
                성별 조건이 있는 액션(예: 남성 어르신 목욕 봉사)을 안내하는 데
                쓰입니다. 가입 후에는 바꿀 수 없어요.
              </span>
            </div>
          </div>
        </>
      )}

      {/* ── 3단계 ── */}
      {step === 3 && (
        <>
          <h1 className="text-[22px] font-bold leading-snug tracking-tight text-neutral-900">
            어떤 액션을
            <br />
            찾고 있나요?
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-neutral-500">
            나중에 프로필에서 언제든 바꿀 수 있어요.
          </p>

          <div className="mt-8 flex flex-col gap-6">
            <div className="flex flex-col gap-2.5">
              <span className="text-[13px] font-medium text-neutral-700">
                관심 카테고리
              </span>
              <ChipGroup
                options={CATEGORIES}
                selected={categories as (typeof CATEGORIES)[number][]}
                onToggle={(v) => setCategories(toggleInArray(categories, v))}
              />
            </div>

            <div className="flex flex-col gap-2.5">
              <span className="text-[13px] font-medium text-neutral-700">
                보통 언제 참여할 수 있나요?
              </span>
              <ChipGroup
                options={AVAILABLE_TIMES}
                selected={times as (typeof AVAILABLE_TIMES)[number][]}
                onToggle={(v) => setTimes(toggleInArray(times, v))}
              />
            </div>

            <div className="flex flex-col gap-2.5">
              <span className="text-[13px] font-medium text-neutral-700">
                활동 가능 지역
              </span>
              <RegionPicker value={regions} onChange={setRegions} />
            </div>
          </div>
        </>
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-600">
          {error}
        </p>
      )}

      {/* 하단 버튼 */}
      <div className="mt-auto flex gap-2 pt-8">
        {step > 1 && (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => {
              setError('');
              setStep(step - 1);
            }}
          >
            이전
          </Button>
        )}

        {step === 1 && (
          <Button type="button" size="lg" fullWidth onClick={nextFromStep1}>
            다음
          </Button>
        )}
        {step === 2 && (
          <Button
            type="button"
            size="lg"
            fullWidth
            loading={busy}
            onClick={nextFromStep2}
          >
            다음
          </Button>
        )}
        {step === 3 && (
          <Button
            type="button"
            size="lg"
            fullWidth
            loading={busy}
            onClick={handleSignUp}
          >
            착착 시작하기
          </Button>
        )}
      </div>

      {step === 1 && (
        <p className="mt-5 text-center text-[13px] text-neutral-500">
          이미 계정이 있나요?{' '}
          <Link href="/login" className="font-semibold text-neutral-900 underline">
            로그인
          </Link>
        </p>
      )}
    </main>
  );
}
