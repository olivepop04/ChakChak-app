/**
 * 가입 (3단계).
 *
 *   1단계  이메일 · 비밀번호 · 자기소개(선택) · 약관 동의 2개
 *   2단계  이름 · 닉네임 · 성별
 *   3단계  관심 카테고리 · 참여 가능 시간 · 재능 · 활동 지역 (전부 선택)
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
import { Input } from '@/components/ui/Input';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { ChipGroup, toggleInArray } from '@/components/ui/Chip';
import { RegionPicker } from '@/components/ui/RegionPicker';
import { TimePreferenceEditor } from '@/app/my/_components/TimePreferenceEditor';
import { TalentPreferenceEditor } from '@/app/my/_components/TalentPreferenceEditor';
import {
  getSignupCompletionPath,
  safeNextPath,
  withNext,
} from '@/app/(auth)/auth-navigation';
import { isNicknameTaken, updateProfile } from '@/lib/mutations';
import { getBioValidationError } from '@/lib/utils/profile-validation';
import { getSignupProfileSaveError } from '@/lib/utils/signup-completion';
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

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get('next'));
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  /** 계정을 이미 만들었는가. 취향 저장만 실패했을 때 다시 누를 수 있게 합니다 */
  const [accountCreated, setAccountCreated] = useState(false);

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

  // 폼 입력 변경 시 실시간 임시 저장.
  //
  // 비밀번호는 담지 않습니다 (2026-09-24). sessionStorage 는 같은 출처의
  // 스크립트와 확장 프로그램이 그대로 읽습니다. 단계 복원 편의보다 잃는 것이
  // 큽니다. 복원해서 3단계로 바로 들어오면 비밀번호가 비어 있으므로,
  // handleSignUp 이 한 번 더 확인하고 1단계로 돌려보냅니다.
  useEffect(() => {
    if (!isRestored || typeof window === 'undefined') return;
    try {
      const draft = {
        step,
        email,
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
  async function nextFromStep1() {
    if (busy) return;
    setError('');
    if (!email.includes('@')) return setError('이메일 형식을 확인해주세요.');
    if (password.length < 6) return setError('비밀번호는 6자 이상이어야 해요.');
    const bioError = getBioValidationError(bio);
    if (bioError) return setError(bioError);
    if (!agreeTerms || !agreePrivacy)
      return setError('필수 약관에 모두 동의해주세요.');

    setBusy(true);
    try {
      const response = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        taken?: boolean;
        error?: string;
      };

      if (!response.ok) {
        setError(
          result.error ??
            '일시적인 오류로 이메일 중복 확인을 완료하지 못했어요. 잠시 후 다시 시도해주세요.',
        );
        return;
      }
      if (result.taken) {
        setError('이미 가입된 이메일이에요. 로그인해주세요.');
        return;
      }

      setStep(2);
    } finally {
      setBusy(false);
    }
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
    // 3단계는 전부 선택 항목입니다 (2026-09-28 조장님 요청). 어느 칸에도
    // 「[필수]」 표시가 없는데 시간만 검사해서 막고 있었습니다.
    // 시간은 「상관없음 / 상관없음」 으로 시작하고, 비워도 updateProfile 이
    // time_prefs 에 빈 배열을 넣고 available_times 도 빈 배열로 둡니다.
    // 추천에서는 시간 15점이 안 붙을 뿐 오류가 나지 않습니다.
    // 임시저장에 비밀번호를 담지 않으므로, 단계를 복원해 들어오면 여기서
    // 비밀번호가 비어 있습니다. 막지 않으면 빈 값으로 가입 요청이 나갑니다.
    // 6자 기준은 1단계 검증과 같습니다.
    if (password.length < 6) {
      setError('보안을 위해 비밀번호는 저장하지 않아요. 1단계에서 다시 입력해주세요.');
      setStep(1);
      return;
    }
    setBusy(true);
    const supabase = createClient();

    // 계정은 한 번만 만듭니다.
    //
    // 아래 취향 저장이 실패하면 화면에 머무는데, 그때 버튼을 다시 누르면
    // signUp 이 "이미 가입된 이메일" 로 막혀서 빠져나갈 길이 없어집니다.
    // 계정이 이미 만들어졌으면 이 단계를 건너뛰고 취향 저장만 다시 합니다.
    if (!accountCreated) {
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
            : '일시적인 오류로 회원가입을 완료하지 못했어요. 잠시 후 다시 시도해주세요.',
        );
        return;
      }

      setAccountCreated(true);
    }

    // 트리거가 만들지 못하는 취향 정보는 여기서 채웁니다
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      // 공용 함수로 저장합니다. timePrefs 를 넘기면 옛 available_times 도
      // 함께 채워져서, 나중에 F38 화면이 생겨도 이 회원의 설정이 보입니다.
      const result = await updateProfile(supabase, user.id, {
        bio,
        categories,
        regions,
        timePrefs,
        skills,
      });
      const profileSaveError = getSignupProfileSaveError(result);
      if (profileSaveError) {
        setBusy(false);
        setError(profileSaveError);
        return;
      }
    } else {
      // getUser() 가 사용자를 못 돌려주는 경우입니다 (가입 직후 세션이 없을 때).
      // 지금은 Confirm email 이 꺼져 있어 바로 세션이 생기지만, 그 설정을 켜면
      // 상시 이 경로를 탑니다.
      //
      // 그냥 지나가면 자기소개·관심 분야·지역·참여 시간·재능이 하나도 저장되지
      // 않은 채 완료 화면으로 넘어갑니다. 오류가 안 나서 본인도 나중에야 압니다.
      // 저장 실패와 똑같이 화면에 세워 둡니다. 임시저장도 남겨서 다시 들어오면
      // 고른 값이 그대로 복원됩니다.
      setBusy(false);
      setError(
        '계정은 만들어졌지만 취향 정보를 저장하지 못했어요. 로그인한 뒤 프로필에서 설정해주세요.',
      );
      return;
    }

    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(DRAFT_KEY);
    }

    router.push(getSignupCompletionPath(next));
    router.refresh();
  }

  // 이 화면에는 하단 탭이 보입니다 (BottomNav.tsx 의 HIDDEN 에 /signup 은 없습니다).
  // 버튼 줄이 mt-auto 로 화면 맨 아래에 붙는데 pb-10 은 40px 뿐이라 탭(62px) 아래로 들어갔습니다.
  // 글자 200% 에서 탭이 107px 이 되므로, 탭을 피하는 값인 pb-28(112px) 로 잡습니다.
  return (
    <main className="flex min-h-dvh flex-col px-6 pb-28 pt-8">
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
          <h1 className="text-2xl font-bold leading-snug tracking-tight text-neutral-900">
            착한 일을 착착,
            <br />
            쉽고 즐겁게!
          </h1>
          <p className="mt-2 text-label text-neutral-500">
            이메일로 간단히 시작할 수 있어요.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <FieldLabel>이메일</FieldLabel>
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <FieldLabel>비밀번호</FieldLabel>
              <Input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <span className="text-caption text-neutral-400">6자 이상</span>
            </label>

            <label className="flex flex-col gap-1.5">
              <FieldLabel>
                자기소개 <span className="font-normal text-neutral-400">(선택)</span>
              </FieldLabel>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={LIMITS.BIO_MAX}
                rows={3}
                placeholder="어떤 활동에 관심이 있는지, 어떤 변화를 만들고 싶은지 등 자유롭게 적어보세요."
                className="rounded-xl border border-neutral-300 p-4 text-body leading-relaxed outline-none focus:border-neutral-900"
              />
              <span className="text-right text-caption text-neutral-400">
                {bio.length}/{LIMITS.BIO_MAX}
              </span>
            </label>

            <div className="mt-2 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <label className="flex min-w-0 items-center gap-2.5 text-label text-neutral-700">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="h-4 w-4 shrink-0 accent-neutral-900"
                  />
                  <span className="shrink-0 font-semibold text-neutral-500">[필수]</span>
                  <span>이용약관에 동의합니다.</span>
                </label>
                <Link
                  href="/terms?from=signup"
                  aria-label="이용약관 내용 보기"
                  className="shrink-0 text-label font-semibold text-neutral-500 underline underline-offset-4 hover:text-neutral-900"
                >
                  내용 보기
                </Link>
              </div>
              <div className="flex items-center justify-between gap-3">
                <label className="flex min-w-0 items-center gap-2.5 text-label text-neutral-700">
                  <input
                    type="checkbox"
                    checked={agreePrivacy}
                    onChange={(e) => setAgreePrivacy(e.target.checked)}
                    className="h-4 w-4 shrink-0 accent-neutral-900"
                  />
                  <span className="shrink-0 font-semibold text-neutral-500">[필수]</span>
                  <span>개인정보 처리방침에 동의합니다.</span>
                </label>
                <Link
                  href="/privacy?from=signup"
                  aria-label="개인정보 처리방침 내용 보기"
                  className="shrink-0 text-label font-semibold text-neutral-500 underline underline-offset-4 hover:text-neutral-900"
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
          <h1 className="text-2xl font-bold leading-snug tracking-tight text-neutral-900">
            먼저, 당신을
            <br />
            조금만 알려주세요.
          </h1>
          <p className="mt-2 text-label leading-relaxed text-neutral-500">
            액션에 참여하고 다른 사람들과 연결되기 위해
            <br />꼭 필요한 정보만 받을게요.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <FieldLabel>이름</FieldLabel>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <span className="text-caption text-neutral-400">
                안전한 활동 참여를 위해 실명 사용을 권장해요.
              </span>
            </label>

            <label className="flex flex-col gap-1.5">
              <FieldLabel>닉네임</FieldLabel>
              <Input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
              <span className="text-caption text-neutral-400">
                다른 사람에게는 닉네임이 먼저 보여요.
              </span>
            </label>

            <div className="flex flex-col gap-1.5">
              <FieldLabel>성별</FieldLabel>
              <div className="flex gap-2">
                {GENDERS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={`flex min-h-11 flex-1 items-center justify-center rounded-xl border py-3 text-body font-medium ${
                      gender === g
                        ? 'border-neutral-900 bg-neutral-900 text-white'
                        : 'border-neutral-300 bg-white text-neutral-600'
                    }`}
                  >
                    {GENDER_LABEL[g]}
                  </button>
                ))}
              </div>
              <span className="text-caption text-neutral-400">
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
          <h1 className="text-2xl font-bold leading-snug tracking-tight text-neutral-900">
            어떻게
            <br />
            활동하고 싶으세요?
          </h1>
          <p className="mt-2 text-label leading-relaxed text-neutral-500">
            알려주신 정보를 바탕으로 딱 맞는 액션을 찾아드려요.
            <br />
            나중에 프로필에서 언제든 바꿀 수 있으니 편하게 선택해 보세요.
          </p>

          <div className="mt-8 flex flex-col gap-6">
            <div className="flex flex-col gap-2.5">
              <FieldLabel>
                관심 카테고리{' '}
                <span className="font-normal text-neutral-400">(선택)</span>
              </FieldLabel>
              <ChipGroup
                options={CATEGORY_OPTIONS}
                selected={categories as (typeof CATEGORY_OPTIONS)[number][]}
                onToggle={toggleCategory}
              />
            </div>

            <div className="flex flex-col gap-2.5">
              <FieldLabel>
                보통 언제 참여할 수 있나요?{' '}
                <span className="font-normal text-neutral-400">(선택)</span>
              </FieldLabel>
              <TimePreferenceEditor value={timePrefs} onChange={setTimePrefs} />
            </div>

            <div className="flex flex-col gap-2.5">
              <FieldLabel>
                나눌 수 있는 재능이 있으신가요?{' '}
                <span className="font-normal text-neutral-400">(선택)</span>
              </FieldLabel>
              <TalentPreferenceEditor value={skills} onChange={setSkills} />
            </div>

            <div className="flex flex-col gap-2.5">
              <FieldLabel>
                어느 지역이 편하세요?{' '}
                <span className="font-normal text-neutral-400">(선택)</span>
              </FieldLabel>
              <RegionPicker value={regions} onChange={setRegions} />
            </div>
          </div>
        </>
      )}

      {error && (
        <p className="mt-4 rounded-xl bg-danger-soft px-3 py-2 text-label text-danger">
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
          <Button
            type="button"
            size="lg"
            fullWidth
            loading={busy}
            onClick={nextFromStep1}
          >
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
        <p className="mt-5 text-center text-label text-neutral-500">
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
