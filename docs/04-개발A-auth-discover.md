# 개발 A — 가입 · 로그인 · 프로필 · Discover

> 먼저 [00-공통-개발규칙.md](./00-공통-개발규칙.md)를 읽어주세요.

## 맡는 것

| 시기 | 내용 |
|---|---|
| 1주차 | 가입 3단계 + 로그인 |
| 2주차 | 시·군·구 데이터 + MY + 프로필 수정 |
| 3주차 | 타인 프로필 + 팔로워/팔로잉 + 저장 목록 |
| 4~5주차 | Discover (AI 추천 Agent #3) |

**왜 이 조합인가:** 추천 AI는 사용자의 관심 카테고리·지역·시간을 씁니다. **그 값을 저장하는 가입 화면을 만든 사람이 추천도 맡는 게** 가장 덜 헤맵니다. 그리고 가입은 다른 사람들이 테스트하려면 제일 먼저 필요합니다.

---

## 1주차 — 가입 3단계

**주소:** `/signup`
**파일:** `app/(auth)/signup/page.tsx`
**목업:** `09.good_signup_v02.html`

> `(auth)`처럼 괄호가 붙은 폴더는 **주소에 안 들어갑니다.** `/signup`으로 열립니다.

### 3단계 구성

```
1단계  이메일 · 비밀번호 · 약관 동의 2개(필수)      → [다음]
2단계  이름 · 닉네임 · 성별(필수)                  → [다음]
3단계  관심 카테고리 · 참여 가능 시간 · 활동 지역   → [GOOD 시작하기]
```

단계 이동은 `useState`로 관리하세요. 주소를 바꿀 필요 없습니다.

```tsx
'use client';
const [step, setStep] = useState(1);
const [form, setForm] = useState({
  email: '', password: '', termsAgreed: false, privacyAgreed: false,
  name: '', nickname: '', gender: '' as 'MALE' | 'FEMALE' | '',
  categories: [] as string[], availableTimes: [] as string[], regions: [] as string[],
});
```

### 계정 만들기 — 3단계 마지막에 한 번만

**중요:** 1단계에서 바로 `signUp`을 부르면 안 됩니다. 중간에 그만두면 프로필 없는 계정이 남습니다.

```tsx
const supabase = createClient();

const { error } = await supabase.auth.signUp({
  email: form.email,
  password: form.password,
  options: {
    data: {                      // ★ 이 값들이 profiles 행을 만듭니다
      name: form.name,
      nickname: form.nickname,
      gender: form.gender,
    },
  },
});
if (error) { setError('가입에 실패했어요. 이메일을 확인해주세요.'); return; }
```

`options.data`에 넣은 값은 DB 트리거(`handle_new_user`)가 읽어서 `profiles` 행을 자동으로 만듭니다. **`profiles`에 직접 insert하지 마세요.** RLS가 막습니다.

### 나머지 프로필 값 저장

트리거는 이름·닉네임·성별만 넣습니다. 카테고리·시간·지역은 가입 직후 업데이트하세요.

```tsx
const { data: { user } } = await supabase.auth.getUser();
await supabase.from('profiles').update({
  categories: form.categories,
  available_times: form.availableTimes,
  regions: form.regions,
}).eq('id', user!.id);

router.push('/');
```

### 선택지는 상수에서

```tsx
import { CATEGORIES, AVAILABLE_TIMES, GENDER_LABEL } from '@/lib/constants';

{CATEGORIES.map((c) => (
  <Chip key={c} selected={form.categories.includes(c)} onClick={() => toggle(c)}>
    {c}
  </Chip>
))}
```

**문자열을 직접 적지 마세요.** DB에 CHECK 제약이 걸려 있어서 오타가 나면 저장이 실패합니다.

### 닉네임 중복 확인

`nickname`은 UNIQUE입니다. 미리 확인해주는 게 친절합니다.

```tsx
const { data } = await supabase.from('profiles').select('id').eq('nickname', nickname).maybeSingle();
if (data) setError('이미 사용 중인 닉네임이에요.');
```

### 검증 규칙

| 항목 | 규칙 |
|---|---|
| 이메일 | 형식 확인 |
| 비밀번호 | 6자 이상 (Supabase 기본값) |
| 약관 2개 | 둘 다 체크해야 다음 |
| 이름 | 비어 있으면 안 됨 |
| 닉네임 | 2~20자, 중복 불가 |
| 성별 | 필수 (항목별 성별 제한 검증에 씁니다) |

### 완료 기준

- [ ] 3단계가 순서대로 넘어가고 뒤로도 갈 수 있다
- [ ] 약관 미체크 시 다음으로 안 넘어간다
- [ ] 가입 후 `profiles` 테이블에 행이 생긴다 (Supabase Table Editor로 확인)
- [ ] 카테고리·시간·지역이 저장된다
- [ ] 닉네임 중복 시 안내가 뜬다
- [ ] 가입 후 Home으로 이동한다

---

## 1주차 — 로그인

**주소:** `/login`
**파일:** `app/(auth)/login/page.tsx`

```tsx
const { error } = await supabase.auth.signInWithPassword({
  email, password,
});
if (error) { setError('이메일 또는 비밀번호가 맞지 않아요.'); return; }

// 원래 가려던 곳으로 돌려보낸다
const next = searchParams.get('next') ?? '/';
router.push(next);
router.refresh();   // ★ 서버 컴포넌트가 로그인 상태를 다시 읽게 한다
```

> middleware가 보호 페이지 접근 시 `/login?next=/my` 형태로 보냅니다. `next`를 꼭 처리해주세요.

**`router.refresh()`를 빠뜨리면** 로그인은 됐는데 화면이 여전히 로그아웃 상태로 보입니다. 자주 나는 실수입니다.

### 완료 기준

- [ ] 로그인 후 Home으로 가고, 로그인 상태가 화면에 반영된다
- [ ] `/my`에 로그아웃 상태로 접근하면 로그인으로 튕기고, 로그인하면 `/my`로 돌아온다
- [ ] 틀린 비밀번호에 한국어 안내가 뜬다

---

## 2주차 — 시·군·구 데이터

**파일:** `lib/constants/regions.ts` (새로 만들기)

가입·프로필 수정의 지역 선택에 필요합니다. **아무도 안 맡으면 마지막까지 안 만들어지는 항목**이라 일찍 해두세요.

### 형태

```ts
export const REGIONS: Record<string, string[]> = {
  '서울특별시': ['강남구', '강동구', '강북구', /* ... */],
  '부산광역시': ['강서구', '금정구', /* ... */],
  // ...
};

/** 저장 형식: '서울특별시 강남구' */
export function formatRegion(sido: string, sigungu: string) {
  return `${sido} ${sigungu}`;
}
```

`profiles.regions`는 `TEXT[]`라 `['서울특별시 강남구', '부산광역시 해운대구']` 형태로 저장합니다.

### 선택 UI (목업 기준)

```
전국 전체  ○
서울특별시  ›   → 누르면 시·군·구 목록
경기도      ›
...
```

- 여러 곳 선택 가능 (집·직장·고향)
- **시·군·구까지만** 받습니다. 상세 주소는 받지 않습니다.
- "전국 전체"를 고르면 `['전국']` 하나만 저장

> 행정구역 목록은 검색해서 JSON으로 구하면 됩니다. **MVP 시연 지역(서울·경기·부산 정도)만 추린 축약본으로 시작해도 됩니다.** 완벽하게 만들다가 시간을 다 쓰지 마세요.

---

## 2주차 — MY · 프로필 수정

**주소:** `/my`, `/my/edit`, `/my/saved`
**목업:** `10.good_my_v06.html`

### MY 화면

```tsx
import { getProfile } from '@/lib/queries/profiles';
import { getSavedActions } from '@/lib/queries/actions';

const profile = await getProfile(supabase, user.id, user.id);
const saved = await getSavedActions(supabase, user.id);
```

```
(아바타) 이름
         @닉네임          [프로필 수정]

  7        3        4        6
참여    리드한   팔로워   팔로잉

── 내가 저장한 액션 (3) ──
  [카드] [카드]
  [저장한 액션 모두 보기 ›]   → /my/saved

── 계정 설정 ──
  알림 설정  ›
  비밀번호 변경  ›
  로그아웃  ›
```

**참여 수는 `participatedCount`를 쓰세요.** 소감까지 쓴 것(`ACTUALLY_PARTICIPATED`)만 세는 값입니다. 직접 세지 마세요.

팔로워/팔로잉 숫자를 누르면 `/user/{id}/followers`, `/user/{id}/following`으로 이동합니다.

### 프로필 수정 — `/my/edit`

| 항목 | 수정 가능? |
|---|---|
| 이름 | ❌ 수정 불가 (표시만) |
| 성별 | ❌ 수정 불가 (표시만) |
| 닉네임 | ✅ |
| 자기소개 | ✅ |
| 관심 카테고리 | ✅ |
| 참여 가능 시간 | ✅ |
| 활동 지역 | ✅ |

```tsx
await supabase.from('profiles').update({
  nickname, bio, categories, available_times: availableTimes, regions,
}).eq('id', user.id);
router.refresh();
```

RLS가 본인 행만 수정하도록 막고 있으니 `.eq('id', user.id)`를 빠뜨려도 안전하지만, 습관적으로 넣어주세요.

### 로그아웃

```tsx
await supabase.auth.signOut();
router.push('/');
router.refresh();
```

### 완료 기준

- [ ] 통계 4개가 실제 숫자로 나온다
- [ ] 참여 수가 소감 쓴 것만 센다 (소감 안 쓴 액션은 안 세짐)
- [ ] 프로필 수정 후 화면에 반영된다
- [ ] 이름·성별이 수정 불가로 표시된다
- [ ] 저장한 액션이 없을 때 빈 상태가 나온다
- [ ] 로그아웃하면 Home으로 가고 로그아웃 상태가 된다

---

## 3주차 — 타인 프로필 · 팔로우

**주소:** `/user/[id]`, `/user/[id]/followers`, `/user/[id]/following`

### 공개 범위 — 팀 합의 사항입니다

| 보여줌 | 안 보여줌 |
|---|---|
| 아바타 · **닉네임(주 표기)** · 자기소개 | 이메일 · 전화번호 |
| 통계 4종 | 저장 목록 · 알림 목록 |
| 만든 액션 (공개된 것만) | 참여 **예정** 액션 |
| 참여한 액션 (**완료된 것만**) | DRAFT 액션 |

**참여 예정을 노출하면 "이 사람이 언제 어디에 갈 예정인지"가 공개됩니다.** 그래서 완료된 것만 보여줍니다.

```tsx
import { getProfile, getParticipatedActions } from '@/lib/queries/profiles';
import { getPublicActionsByOwner } from '@/lib/queries/actions';

const profile = await getProfile(supabase, targetId, viewerId);
const created = await getPublicActionsByOwner(supabase, targetId, viewerId);
const joined  = await getParticipatedActions(supabase, targetId, viewerId);  // 완료된 것만
```

두 함수 모두 **비공개 항목을 이미 걸러냅니다.** 직접 쿼리를 짜면 그 필터를 빠뜨리게 됩니다.

### 팔로우 버튼

`FollowButton`은 디자이너가 만든 `LikeButton`과 같은 구조입니다.

```tsx
import { toggleFollow } from '@/lib/mutations';
const res = await toggleFollow(supabase, targetUserId, currentlyFollowing);
```

자기 자신은 팔로우할 수 없습니다 (서버가 거절). 본인 프로필이면 버튼 대신 `프로필 수정`을 보여주세요 (`profile.isMe`로 확인).

### 팔로워/팔로잉 목록

```tsx
import { getFollowers, getFollowing } from '@/lib/queries/profiles';
```

각 항목: 아바타 · 닉네임 · `8개 참여 · 2개 리드` · `프로필 보기` 버튼

### 완료 기준

- [ ] 남의 프로필에서 참여 **예정** 액션이 안 보인다
- [ ] 팔로우/언팔로우가 즉시 반영되고 숫자가 바뀐다
- [ ] 본인 프로필에는 팔로우 버튼 대신 수정 버튼이 나온다
- [ ] 팔로워/팔로잉 목록에서 프로필로 이동된다

---

## 4~5주차 — Discover (AI 추천)

**주소:** `/discover`
**파일:** `app/discover/page.tsx`, `app/api/ai/discover/route.ts`
**목업:** `06.good_discover_ai_chat_v01.html`

### 설계 원칙 — 이게 핵심입니다

> **AI는 자유대화가 아니라 정해진 질문 3개로 탐색합니다.**
> **검색과 필터는 일반 코드가 하고, AI는 의도 해석과 추천 이유 설명만 합니다.**
> **LLM이 SQL을 만들지 않습니다.**

### 흐름

```
1. 질문 3개를 순서대로 (선택지 버튼)
     ① 어떤 방식으로 함께하고 싶어요?  시간을 내서 / 물건으로 / 직접 행동으로 / 내 재능으로
     ② 어떤 분야를 찾아볼까요?         카테고리 8종
     ③ 이동할 수 있는 범위는?          우리 동네 / 서울 전체 / 지역 상관없음

2. 답변을 API로 보냄
3. (서버) LLM이 "허용된 필터 JSON"만 생성
4. (서버) 코드가 JSON을 검증하고 DB 검색
5. (서버) 코드가 추천 점수 계산 → 상위 3개
6. (서버) LLM이 추천 이유를 자연어로 작성
7. 카드 3개 + 이유 표시
```

### 3단계 — 필터 JSON 생성

```ts
import { callStructuredAI, DiscoverFilterSchema } from '@/lib/openai';

const filter = await callStructuredAI({
  agent: 'DISCOVER',
  promptVersion: 'discover-v1',
  system: `사용자의 선택을 검색 필터로 바꾸세요. JSON만 답하세요.
categories 는 반드시 아래 8개 중에서만 고르세요:
동물, 환경, 지역사회, 아동·청소년, 노인, 장애, 교육, 기타

형식: {"categories":[],"participation_modes":[],"regions":[],"available_days":[]}`,
  user: JSON.stringify(answers),
  schema: DiscoverFilterSchema,
  userId: user.id,
});
```

`DiscoverFilterSchema`가 형식을 검증합니다. 이상한 값이 오면 자동으로 1회 재시도하고, 그래도 실패하면 안전한 오류를 던집니다.

### 4단계 — DB 검색

```ts
import { getRecommendCandidates } from '@/lib/queries/actions';

const candidates = await getRecommendCandidates(supabase, user.id, {
  categories: filter.categories.filter(c => CATEGORIES.includes(c as Category)) as Category[],
});
```

이 함수가 **추천에서 무조건 제외해야 하는 것들을 이미 걸러냅니다.**

- ACTIVE가 아닌 액션
- 모집 마감이 지난 액션
- 본인이 만든 액션
- 이미 참여한 액션

### 5단계 — 점수 계산 (코드가 함)

`lib/utils/scoring.ts`를 새로 만드세요.

| 조건 | 점수 |
|---|---|
| 관심 카테고리 일치 | 30 |
| 활동 가능 지역 일치 | 25 |
| 참여 가능 요일 일치 | 20 |
| 참여 방식 일치 | 15 |
| 팔로우한 사람이 만든 액션 | 10 |
| **합계** | **100** |

요일은 `activity_start_at`에서 계산합니다.

```ts
const day = new Date(action.activityStartAt!).getDay();  // 0=일, 6=토
const isWeekend = day === 0 || day === 6;
if (isWeekend && profile.availableTimes.includes('주말')) score += 20;
```

**거리(km)는 계산하지 않습니다.** 좌표가 없습니다. 지역명 문자열 매칭까지만 합니다.

### 6단계 — 추천 이유

```ts
const reasons = await callStructuredAI({
  agent: 'DISCOVER',
  promptVersion: 'discover-reason-v1',
  temperature: 0.4,      // 설명은 조금 자유롭게
  system: `추천 이유를 친근한 한국어 한 문장으로 쓰세요.
반드시 주어진 액션 정보에 있는 내용만 쓰세요. 지어내지 마세요.
형식: {"reasons":[{"actionId":"...","reason":"..."}]}`,
  user: JSON.stringify({ profile: userTraits, actions: top3 }),
  schema: ReasonSchema,
});
```

> **추천 이유가 실제 액션 조건과 맞는지 꼭 확인하세요.** "이번 주말"이라고 했는데 평일이면 발표에서 지적당합니다.

### AI가 실패하면

```tsx
if (aiFailed) {
  // 점수 상위 3개는 그대로 보여주고, 이유만 기본 문구로
  reason = `${action.category} 분야의 액션이에요.`;
}
```

**AI가 죽어도 추천 카드는 나와야 합니다.** 발표 중 API가 실패할 수 있습니다.

### 완료 기준

- [ ] 질문 3개가 순서대로 나오고 선택지를 누르면 진행된다
- [ ] 추천 카드 3개가 나온다
- [ ] **추천된 액션이 전부 ACTIVE이고, 내가 만든 것/이미 참여한 것이 없다**
- [ ] 추천 이유가 실제 액션 조건과 맞다
- [ ] AI 호출이 실패해도 카드는 나온다
- [ ] "다시 찾기"로 처음부터 다시 할 수 있다
- [ ] `ai_runs` 테이블에 로그가 쌓인다
