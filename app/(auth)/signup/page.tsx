/**
 * 가입 (3단계).
 *
 *   1단계  이메일 · 비밀번호 · 자기소개(선택) · 약관 동의 2개
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

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { ChipGroup, toggleInArray } from '@/components/ui/Chip';
import { RegionPicker } from '@/components/ui/RegionPicker';
import { TimePreferenceEditor } from '@/app/my/_components/TimePreferenceEditor';
import { TalentPreferenceEditor } from '@/app/my/_components/TalentPreferenceEditor';
import { safeNextPath, withNext } from '@/app/(auth)/auth-navigation';
import { isNicknameTaken, updateProfile } from '@/lib/mutations';
import {
  CATEGORIES,
  GENDER_LABEL,
  GENDERS,
  LIMITS,
  type TimePref,
  type Gender,
} from '@/lib/constants';

const CATEGORY_OPTIONS = ['전체', ...CATEGORIES] as const;
const DRAFT_KEY = 'chak_signup_draft';

const inputClass =
  'h-12 rounded-xl border border-neutral-300 px-4 text-[15px] outline-none focus:border-neutral-900';

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get('next'));
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // 1단계
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [bio, setBio] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);

  // 2단계
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');

  // 3단계
  const [categories, setCategories] = useState<string[]>([]);
  const [timePrefs, setTimePrefs] = useState<TimePref[]>([
    { day: '상관없음', slots: ['상관없음'] },
  ]);
  const [regions, setRegions] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[] | null>(null);

  const [isRestored, setIsRestored] = useState(false);

  // 마운트 시 임시 저장된 폼 데이터 복원
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedData =
        sessionStorage.getItem(DRAFT_KEY) ||
        sessionStorage.getItem('signup_draft_data');
      if (savedData) {
        const parsed = JSON.parse(savedData);
        if (typeof parsed.step === 'number') setStep(parsed.step);
        if (typeof parsed.email === 'string') setEmail(parsed.email);
        if (typeof parsed.password === 'string') setPassword(parsed.password);
        if (typeof parsed.bio === 'string') setBio(parsed.bio);
        if (typeof parsed.agreeTerms === 'boolean') setAgreeTerms(parsed.agreeTerms);
        if (typeof parsed.agreePrivacy === 'boolean') setAgreePrivacy(parsed.agreePrivacy);
        if (typeof parsed.name === 'string') setName(parsed.name);
        if (typeof parsed.nickname === 'string') setNickname(parsed.nickname);
        if (typeof parsed.gender === 'string') setGender(parsed.gender as Gender | '');
        if (Array.isArray(parsed.categories)) setCategories(parsed.categories);
        if (Array.isArray(parsed.timePrefs)) setTimePrefs(parsed.timePrefs);
        if (Array.isArray(parsed.regions)) setRegions(parsed.regions);
        if (Array.isArray(parsed.skills) || parsed.skills === null) setSkills(parsed.skills);
      }
    } catch {
      // 복원 중 파싱 오류는 무시
    } finally {
      setIsRestored(true);
    }
  }, []);

  // 폼 입력 변경 시 실시간 임시 저장 (이메일 및 비밀번호 포함 모든 필드)
  useEffect(() => {
    if (!isRestored || typeof window === 'undefined') return;
    try {
      const draft = {
        step,
        email,
        password,
        bio,
        agreeTerms,
        agreePrivacy,
        name,
        nickname,
        gender,
        categories,
        timePrefs,
        regions,
        skills,
      };
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // 저장 중 오류는 무시
    }
  }, [
    isRestored,
    step,
    email,
    password,
    bio,
    agreeTerms,
    agreePrivacy,
    name,
    nickname,
    gender,
    categories,
    timePrefs,
    regions,
    skills,
  ]);

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
    const taken = await isNicknameTaken(createClient(), nick);
    setBusy(false);

    if (taken) return setError('이미 사용 중인 닉네임이에요.');
    setStep(3);
  }

  // ── 3단계: 계정 생성 ──────────────────────────────────────
  async function handleSignUp() {
    setError('');
    if (
      timePrefs.length === 0 ||
      timePrefs.some((preference) => preference.slots.length === 0)
    ) {
      setError('참여 가능한 요일과 시간대를 하나 이상 선택해주세요.');
      return;
    }
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
        bio,
        categories,
        regions,
        timePrefs,
        skills,
      });
    }

    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(DRAFT_KEY);
    }

    router.push(next);
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

            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-neutral-700">
                자기소개 <span className="font-normal text-neutral-400">(선택)</span>
              </span>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                placeholder="어떤 활동에 관심이 있는지 짧게 알려주세요."
                className="rounded-xl border border-neutral-300 p-4 text-[15px] leading-relaxed outline-none focus:border-neutral-900"
              />
            </label>

            <div className="mt-2 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <label className="flex min-w-0 items-center gap-2.5 text-[13px] text-neutral-700">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="h-4 w-4 shrink-0 accent-neutral-900"
                  />
                  <span className="font-semibold text-neutral-500">[필수]</span>
                  <span>이용약관에 동의합니다.</span>
                </label>
                <Link
                  href="/terms?from=signup"
                  aria-label="이용약관 내용 보기"
                  className="shrink-0 text-[12px] font-semibold text-neutral-500 underline underline-offset-4 hover:text-neutral-900"
                >
                  내용 보기
                </Link>
              </div>
              <div className="flex items-center justify-between gap-3">
                <label className="flex min-w-0 items-center gap-2.5 text-[13px] text-neutral-700">
                  <input
                    type="checkbox"
                    checked={agreePrivacy}
                    onChange={(e) => setAgreePrivacy(e.target.checked)}
                    className="h-4 w-4 shrink-0 accent-neutral-900"
                  />
                  <span className="font-semibold text-neutral-500">[필수]</span>
                  <span>개인정보 처리방침에 동의합니다.</span>
                </label>
                <Link
                  href="/privacy?from=signup"
                  aria-label="개인정보 처리방침 내용 보기"
                  className="shrink-0 text-[12px] font-semibold text-neutral-500 underline underline-offset-4 hover:text-neutral-900"
                >
                  내용 보기
                </Link>
              </div>
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
              <span className="text-[11px] text-neutral-400">
                안전한 활동 참여를 위해 실명 사용을 권장해요.
              </span>
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
                options={CATEGORY_OPTIONS}
                selected={categories as (typeof CATEGORY_OPTIONS)[number][]}
                onToggle={toggleCategory}
              />
            </div>

            <div className="flex flex-col gap-2.5">
              <span className="text-[13px] font-medium text-neutral-700">
                보통 언제 참여할 수 있나요?
              </span>
              <TimePreferenceEditor value={timePrefs} onChange={setTimePrefs} />
            </div>

            <div className="flex flex-col gap-2.5">
              <span className="text-[13px] font-medium text-neutral-700">
                나눌 수 있는 재능이 있으신가요?{' '}
                <span className="font-normal text-neutral-400">(선택)</span>
              </span>
              <TalentPreferenceEditor value={skills} onChange={setSkills} />
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
          <Link
            href={withNext('/login', next)}
            className="font-semibold text-neutral-900 underline"
          >
            로그인
          </Link>
        </p>
      )}
    </main>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-neutral-400">불러오는 중…</div>}>
      <SignUpForm />
    </Suspense>
  );
}
