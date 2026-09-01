# 개발 A — 가입 · 프로필 · Discover 추천

> **이 문서 하나만 AI에게 줘도 됩니다.** 필요한 제약이 아래에 다 들어 있습니다.
> 팀 공통 작업 규칙(브랜치·PR)은 [00-공통규칙.md](./00-공통규칙.md)에 있습니다.

```bash
git checkout feature/개발A-auth
```

---

## 지금 상태

**전부 동작합니다.** 만드는 일이 아니라 **써보고 다듬는 일**입니다.

| 화면 | 주소 | 파일 | 상태 |
|---|---|---|---|
| 로그인 | `/login` | `app/(auth)/login/page.tsx` | 동작함 |
| 가입 3단계 | `/signup` | `app/(auth)/signup/page.tsx` | 동작함 |
| 마이페이지 | `/my` | `app/my/page.tsx` | 동작함 |
| 프로필 수정 | `/my/edit` | `app/my/edit/page.tsx` | 동작함 |
| 저장한 액션 | `/my/saved` | `app/my/saved/page.tsx` | 동작함 |
| 타인 프로필 | `/user/[id]` | `app/user/[id]/page.tsx` | 동작함 |
| 팔로워·팔로잉 | `/user/[id]/followers` `/following` | 같은 폴더 | 동작함 |
| **Discover 추천** | `/discover` | `app/discover/page.tsx` + `app/api/ai/discover/route.ts` | 동작함 |

같이 맡는 파일: `lib/constants/regions.ts` (지역 목록) · `lib/utils/scoring.ts` (추천 점수) · `components/action/DiscoverChat.tsx` (Discover 대화 UI)

---

## 프로필 저장은 준비된 함수로 (2026-09-01 추가)

가입 3단계와 프로필 수정이 지금은 `profiles` 를 직접 고치고 있습니다.
**아래 함수로 바꿔주세요.** 닉네임 중복·길이 검사가 안에 들어 있습니다.

```tsx
const res = await updateProfile(supabase, userId, {
  nickname, bio, categories, regions,
  timePrefs: [
    { day: '평일', slots: ['오전'] },
    { day: '주말', slots: ['저녁', '밤'] },
  ],
});
if (!res.ok) { toast(res.message, 'error'); return; }
```

> **왜 직접 고치면 안 되나** — `timePrefs` 를 넘기면 이 함수가 **예전 `available_times` 컬럼도 함께**
> 채웁니다. 추천 점수(`scoring.ts`)가 아직 옛 컬럼을 보고 있어서, 한쪽만 채우면
> **추천이 조용히 어긋납니다.** 나중에 `scoring.ts` 를 `time_prefs` 로 옮기면 그때 이 변환을 지웁니다.

알림 설정(F25)은 이렇게 저장합니다. **끈 것만** 넘기면 됩니다.

```tsx
await updateNotifySettings(supabase, userId, ['SCHEDULE', 'VOICE_REQUEST']);
```

껐다고 표시한 알림은 **DB 트리거가 아예 만들지 않습니다.** 화면에서 거를 필요가 없습니다.

**현재 값을 보여줄 때**는 `getProfile()` 이 그대로 줍니다. 직접 조회하지 마세요.

```tsx
const me = await getProfile(supabase, userId, userId);
me.timePrefs;   // [{ day: '평일', slots: ['오전'] }]  — 체크박스 초기값
me.notifyOff;   // ['SCHEDULE']                        — 스위치 초기값
```

> ⚠️ **관심 카테고리에 "전체"를 넣을 때 주의**(F15)
> 추천 점수(`scoring.ts`)는 `내 관심 카테고리에 이 액션의 카테고리가 있는가` 로 비교합니다.
> "전체" 를 그대로 저장하면 어떤 액션과도 안 맞아서 **관심 분야 30점이 항상 0점**이 됩니다.
> 에러가 안 나서 알아채기 어렵습니다.
>
> 두 방법 중 하나로 하세요.
> - 화면에서 "전체" 를 누르면 **8개를 전부 선택**한 것으로 저장 (권장 — 점수 계산을 안 건드림)
> - 또는 `scoring.ts` 에서 `categories` 가 비었거나 "전체" 를 포함하면 30점을 주도록 고치기

---

## 알아둬야 할 규칙 3개

### ① 가입은 3단계 마지막에 한 번만 계정을 만듭니다

1단계에서 바로 `signUp` 을 부르면 **중간에 그만둔 사람의 빈 계정이 쌓입니다.**

그리고 **`profiles` 에 직접 insert 하지 않습니다.** `signUp` 의 `options.data` 에 넣은 값을 DB 트리거가 읽어서 자동으로 만듭니다. RLS 때문에 클라이언트에서는 insert 가 막혀 있습니다.

```tsx
await supabase.auth.signUp({
  email, password,
  options: { data: { name, nickname, gender } },   // ← 트리거가 이걸 읽습니다
});
```

### ② 타인 프로필의 공개 범위

| 보여줌 | 숨김 |
|---|---|
| 닉네임(주 표기) · 자기소개 · 통계 4종 | 이메일 |
| 만든 액션 (공개된 것만) | **참여 예정 액션** |
| 참여한 액션 (**완료된 것만**) | 저장 목록 · 알림 |

**참여 예정을 노출하면 "이 사람이 언제 어디에 갈지"가 공개됩니다.** `getParticipatedActions()` 가 이미 완료된 것만 돌려주니, 직접 쿼리를 짜면 그 필터를 빠뜨리게 됩니다.

### ③ Discover는 자유 대화가 아닙니다

**지금은** 정해진 질문 3개(참여 방식 · 분야 · 이동 범위)에 선택지로 답합니다.

> ⚠️ 이 부분은 **F36 에서 바뀝니다** — AI 가 대화를 이끄는 방식으로. 아래 "이번 개편에서 할 일" 을 보세요.
> 다만 **후보 선정을 코드가 한다는 원칙은 그대로 유지**합니다. 자유 대화로 바뀌어도 AI 에게 순위를 맡기지 않습니다.

**순위는 AI가 아니라 코드가 정합니다.**

```
관심 카테고리 30 · 지역 25 · 요일 20 · 참여 방식 15 · 팔로우한 사람 10  = 100
```

AI가 하는 일은 두 가지뿐입니다 — ① 답변을 검색 필터 JSON으로 바꾸기 ② 추천 이유를 문장으로 쓰기. **LLM이 SQL을 만들지 않습니다.**

> AI 추천 이유가 `✦ 관심 분야(동물) · 가까운 지역 조건에 맞아요.` 처럼 딱딱하면 AI 호출이 실패하고 기본 문구가 나온 것입니다. `✦ 주말에 가까운 곳에서 동물 봉사해요!` 처럼 나오면 정상입니다.

---

## 첫 작업 제안

### ① 가입을 실제로 해보기 (1시간)

배포 주소에서 진짜 가입해보세요. 3단계를 왔다 갔다 하면서 어색한 곳을 찾습니다.

- 뒤로 갔다 오면 입력이 남아 있나
- 닉네임 중복일 때 안내가 충분한가
- 지역 선택이 불편하지 않나

> 이메일은 `@example.com` 을 쓰면 Supabase가 가짜 도메인으로 막습니다. 다른 걸 쓰세요.

### ② 지역 데이터 늘리기 (반나절)

`lib/constants/regions.ts` — 지금은 광역시와 경기도만 전체가 들어 있고, 나머지 도는 주요 시·군만 있습니다. 시연에 필요한 지역이 빠져 있으면 추가하세요.

### ③ 추천 점수 조정 (반나절)

`lib/utils/scoring.ts` — 실제로 Discover를 여러 번 돌려보고 추천이 납득되는지 봅니다. 안 맞으면 배점을 조정하세요.

---

## 쓸 수 있는 함수

```tsx
// 읽기
import { getProfile, getParticipatedActions, getFollowers, getFollowing, searchUsers }
  from '@/lib/queries/profiles';
import { getSavedActions, getPublicActionsByOwner, getRecommendCandidates }
  from '@/lib/queries/actions';

// 쓰기
import { toggleFollow, toggleSave, toggleLike } from '@/lib/mutations';

// 프로필 · 알림 설정 (민호가 만들어 둠 — 직접 update 하지 마세요)
import { updateProfile, isNicknameTaken, updateNotifySettings }
  from '@/lib/mutations';

// 참여 가능 시간 2단계
import { TIME_DAYS, TIME_SLOTS, describeTimePref, type TimePref }
  from '@/lib/constants';

// 점수
import { rankActions, fallbackReason } from '@/lib/utils/scoring';
```

---

## 완료 기준

- [ ] `npm run build` 통과
- [ ] 실제로 가입해서 `profiles` 에 행이 생기는 걸 확인했다
- [ ] 카테고리·시간·지역이 저장된다
- [ ] 로그인 후 원래 가려던 화면으로 돌아간다 (`/my` 에 로그아웃 상태로 접근 → 로그인 → `/my`)
- [ ] MY 참여 수가 **소감 쓴 것만** 센다
- [ ] 남의 프로필에서 **참여 예정 액션이 안 보인다**
- [ ] 팔로우가 즉시 반영되고 숫자가 바뀐다
- [ ] Discover 추천에 **내가 만든 것 · 이미 참여한 것 · 마감된 것이 없다**
- [ ] 추천 이유가 실제 액션 조건과 맞다
- [ ] AI 호출이 실패해도 카드는 나온다

---

---

## 이번 개편에서 할 일 (2026-09-01 합의)

> 전체 합의는 [06-개편-합의.md](./06-개편-합의.md). Discover가 이번 개편에서 **제일 큰 작업**입니다.
>
> **✅ 민호의 준비 작업(문구 교체 · DB 변경 · 공용 함수)은 전부 끝났습니다. 바로 시작하시면 됩니다.**
> `git pull origin dev` 로 최신을 받고 시작해주세요.

### 지금 바로 할 수 있는 것

**F04 — 가입 1단계에 자기소개 칸 (1시간)**
자기소개 입력칸을 1단계에 추가합니다. **선택 입력**이라 비워도 가입됩니다. 약관 동의는 이미 있으니 그대로.
파일: `app/(auth)/signup/page.tsx`

**F15 — 관심 카테고리에 "전체" (30분)**
가입 3단계와 프로필 수정의 관심 카테고리에 "전체" 선택지를 추가합니다.

**F18 — MY 숫자를 누르면 Activity로 (30분)**
"호스트한 액션 N개 · 참여한 액션 N개" 숫자를 누르면 Activity 페이지로 이동하게 링크를 겁니다.
파일: `app/my/page.tsx`

**F23 — 저장한 액션 접기 (1시간)**
`/my/saved` 목록을 최신 2개 + "+ 더보기"로.

**F25 — 알림 설정 화면 (1시간)**
MY 화면에 알림을 켜고 끄는 스위치를 답니다. **함수와 데이터는 준비돼 있습니다.**

```tsx
const me = await getProfile(supabase, userId, userId);
me.notifyOff;   // ['SCHEDULE'] — 꺼둔 것 목록

await updateNotifySettings(supabase, userId, ['SCHEDULE', 'VOICE_REQUEST']);
```

알림은 **8종**입니다. `NOTIFICATION_TYPES` 를 목록으로 쓰고,
이름은 `NOTIFICATION_TEMPLATE[type].title` 을 쓰면 됩니다.
껐다고 표시한 알림은 **DB 트리거가 아예 만들지 않으니** 화면에서 거를 필요가 없습니다.

**F28 — 비회원 유도 문구 (1시간)**
로그인 안 한 사람이 찜·추천을 누르면 바로 로그인 화면으로 던지지 말고,
**"로그인하고 나에게 맞는 활동을 추천받아 보세요"** 안내를 먼저 보여줍니다.

### 이제 해도 됩니다 (DB 변경 완료됨)

**F38 — 참여 가능 시간 2단계 (반나절)**
가입·프로필 수정에서: ① 평일/주말/상관없음 중 하나 → ② 오전/오후/저녁/밤/상관없음 복수 선택.
"+선호시간 추가"로 조합을 여러 개 넣고, 선택한 결과를 "평일 오전, 주말 저녁&밤"처럼 보여줍니다.
추천 점수 계산(`lib/utils/scoring.ts`)도 새 구조에 맞춰 고칩니다.

### 제일 큰 것 — F36 Discover 고도화 (이틀, 따로 잡기)

지금은 정해진 질문 3개 → 점수 → AI는 이유만 씁니다. 이걸 **AI가 대화를 이끄는 방식**으로 바꿉니다.

지켜야 할 규칙 6개:
1. **프로필에 있는 건 묻지 않는다** — 카테고리·지역·시간은 가입 때 이미 받았습니다
2. 신규 회원에게는 **성향 질문 2~3개만** (기분·몸/머리·일회성/꾸준함)
3. 활동 이력이 있으면 **AI가 먼저 말을 겁니다** — "동물 쪽 활동을 많이 하셨네요. 비슷한 걸 찾으세요, 새로운 걸 해보고 싶으세요?"
4. **최대 3번 주고받고 반드시 후보를 보여준다** — 안 그러면 시연 중 AI가 질문만 계속하는 사고가 납니다
5. **후보 선정은 코드가** (`getRecommendCandidates` + `scoring.ts`) — AI는 조건 뽑기와 이유 쓰기만
6. 후보가 0개면 **조건을 하나씩 풀면서** "지역을 넓혀봤어요"라고 알려줍니다

**대화 내용은 어디에 두나** — 최대 3번이라 **화면 상태(useState)로 충분합니다.**
새 테이블을 만들지 마세요. 새로고침하면 처음부터 다시 하는 게 오히려 자연스럽습니다.
지난 활동 요약은 **매번 서버에서 새로 계산**하면 됩니다 (`getParticipatedActions`).

**AI 호출은 `app/api/ai/discover/route.ts` 에서만** 하세요. `lib/openai.ts` 를
클라이언트 컴포넌트에서 import 하면 `server-only` 때문에 빌드가 실패합니다.

⚠️ **지금 버전을 지우지 마세요.** 발표에서 "이렇게 개선했다"를 나란히 보여줄 증거입니다.
프롬프트를 고치면 `promptVersion` 을 반드시 올리세요.

---

# AI에게 시킬 때

**아래를 그대로 복사해서 앞에 붙이고, 원하는 작업을 이어서 쓰세요.**

```
## 프로젝트

착착(CHAK CHAK) — 봉사·나눔 활동(=액션)을 만들고 참여하고 결과를 나누는 모바일 웹.
Next.js 15 (App Router) · TypeScript · Tailwind CSS · Supabase · OpenAI gpt-4o-mini

## 내 담당

가입·로그인·프로필·Discover 추천.
app/(auth)/ · app/my/ · app/user/ · app/discover/ · app/api/ai/discover/
lib/constants/regions.ts · lib/utils/scoring.ts · components/action/DiscoverChat.tsx

화면은 이미 다 동작한다. 나는 써보고 어색한 곳을 고친다.

## 반드시 지킬 것

1. params 와 searchParams 는 Promise 다. 반드시 await 한다.
   const { id } = await params;

2. 프로필 저장은 updateProfile() 을, 알림 설정은 updateNotifySettings() 를 쓴다.
   profiles 테이블을 직접 update 하지 않는다.
   참여 가능 시간은 2단계다 — timePrefs: [{ day: '평일', slots: ['오전'] }]
   상수는 TIME_DAYS · TIME_SLOTS, 표시는 describeTimePref() 를 쓴다.

3. 데이터 읽기는 lib/queries/ 의 함수, 쓰기는 lib/mutations.ts 의 함수만 쓴다.
   화면에서 supabase.from(...) 이나 supabase.rpc(...) 를 직접 호출하지 않는다.
   필요한 함수가 없으면 새로 만들지 말고 "없다"고 알려준다.
   (단, profiles 테이블의 단순 조회·수정은 예외로 직접 해도 된다)

4. 쓰기 함수는 { ok: true, data } 또는 { ok: false, message } 를 돌려준다.
   message 는 그대로 사용자에게 보여주면 되는 한국어다. try/catch 를 쓰지 않는다.

5. 화면 문구는 lib/constants/index.ts 에서 가져온다. 문자열을 직접 적지 않는다.
   CATEGORIES(8종) · AVAILABLE_TIMES(6종) · GENDER_LABEL · LIMITS · UPLOAD

6. 회원가입은 3단계 마지막에 한 번만 supabase.auth.signUp 을 부른다.
   profiles 에 직접 insert 하지 않는다. signUp 의 options.data 에
   { name, nickname, gender } 를 넣으면 DB 트리거가 profiles 를 만든다.
   나머지 값(categories, available_times, regions)은 가입 직후 update 로 채운다.

7. 타인 프로필에는 "참여 예정" 액션을 절대 노출하지 않는다.
   getParticipatedActions() 가 완료된 것만 돌려주므로 그 함수를 쓴다.
   실명(name)보다 닉네임을 주 표기로 쓴다.

8. Discover 는 AI 가 대화를 이끈다 (2026-09-01 개편 · F36).
   프로필에 이미 있는 것(카테고리·지역·시간)은 다시 묻지 않는다.
   신규 회원에게는 성향 질문 2~3개만, 활동 이력이 있으면 지난 활동을 요약해
   AI 가 먼저 말을 건다.
   최대 3번 주고받고 반드시 후보를 보여준다. 무한히 질문하지 않는다.
   후보가 0개면 조건을 하나씩 풀면서 "지역을 넓혀봤어요" 라고 알려준다.

   ★ 후보 선정과 점수는 코드(getRecommendCandidates + scoring.ts)가 한다.
     AI 에게 순위를 맡기지 않는다. AI 가 고르면 마감된 액션을 추천하거나
     없는 액션을 지어낼 수 있고, 같은 조건에서 매번 답이 달라져 검증할 수 없다.
     AI 는 대화로 조건을 뽑는 일과 이유 문장을 쓰는 일만 한다.
   AI 호출이 실패해도 추천 카드는 나와야 한다.
   프롬프트를 고치면 promptVersion 을 반드시 올린다. 예전 버전 로그는 지우지 않는다.

9. 날짜 표시는 lib/utils/date.ts 를 쓴다.
   formatDate · formatDateShort · formatTime · formatActivityPeriod · formatRelative

10. 이미 있는 공통 컴포넌트를 쓴다. 비슷한 것을 새로 만들지 않는다.
   Button Badge Chip ChipGroup EmptyState Toast Avatar ActionCard
   RegionPicker UserList LogoutButton ProfileEditForm
   ToggleButtons(LikeButton SaveButton FollowButton) Header BottomNav

11. lib/ 과 components/ui/ 는 다섯 명이 함께 쓰는 공유 구역이다.
    lib/constants/regions.ts 와 lib/utils/scoring.ts 는 내 담당이라 고쳐도 된다.
    그 밖의 lib/ 파일은 수정하지 말고 "수정이 필요하다"고 알려준다.

12. 서버 컴포넌트가 기본이다. 'use client' 는 훅·이벤트가 필요할 때만 쓴다.

13. 목록 화면에는 빈 상태(EmptyState)를 반드시 넣는다. 다음 행동 버튼을 함께 준다.

14. 사용자에게 보이는 문구와 코드 주석은 한국어로 쓴다.
    로그인 후에는 router.refresh() 를 부른다. 안 부르면 화면이 로그아웃 상태로 보인다.

15. 새 파일·새 쿼리·새 상수를 만들기 전에, 이미 있는 것을 먼저 찾아 쓴다.

## 오늘 할 일

(여기에 원하는 작업을 적으세요. 예시)
app/(auth)/signup/page.tsx 에서 2단계로 갔다가 1단계로 돌아오면
입력한 값이 그대로 남아 있는지 확인하고, 안 남아 있으면 고쳐줘.
```
