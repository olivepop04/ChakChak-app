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

같이 맡는 파일: `lib/constants/regions.ts` (지역 목록) · `lib/utils/scoring.ts` (추천 점수)

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

정해진 질문 3개(참여 방식 · 분야 · 이동 범위)에 선택지로 답합니다. 자유 입력을 받으면 무슨 답이 올지 몰라 검증할 수 없고 AI 비용도 통제가 안 됩니다.

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

# AI에게 시킬 때

**아래를 그대로 복사해서 앞에 붙이고, 원하는 작업을 이어서 쓰세요.**

```
## 프로젝트

GOOD — 봉사·나눔 활동(=액션)을 만들고 참여하고 결과를 나누는 모바일 웹.
Next.js 15 (App Router) · TypeScript · Tailwind CSS · Supabase · OpenAI gpt-4o-mini

## 내 담당

가입·로그인·프로필·Discover 추천.
app/(auth)/ · app/my/ · app/user/ · app/discover/ · app/api/ai/discover/
lib/constants/regions.ts · lib/utils/scoring.ts

화면은 이미 다 동작한다. 나는 써보고 어색한 곳을 고친다.

## 반드시 지킬 것

1. params 와 searchParams 는 Promise 다. 반드시 await 한다.
   const { id } = await params;

2. 데이터 읽기는 lib/queries/ 의 함수, 쓰기는 lib/mutations.ts 의 함수만 쓴다.
   화면에서 supabase.from(...) 이나 supabase.rpc(...) 를 직접 호출하지 않는다.
   필요한 함수가 없으면 새로 만들지 말고 "없다"고 알려준다.
   (단, profiles 테이블의 단순 조회·수정은 예외로 직접 해도 된다)

3. 쓰기 함수는 { ok: true, data } 또는 { ok: false, message } 를 돌려준다.
   message 는 그대로 사용자에게 보여주면 되는 한국어다. try/catch 를 쓰지 않는다.

4. 화면 문구는 lib/constants/index.ts 에서 가져온다. 문자열을 직접 적지 않는다.
   CATEGORIES(8종) · AVAILABLE_TIMES(6종) · GENDER_LABEL · LIMITS · UPLOAD

5. 회원가입은 3단계 마지막에 한 번만 supabase.auth.signUp 을 부른다.
   profiles 에 직접 insert 하지 않는다. signUp 의 options.data 에
   { name, nickname, gender } 를 넣으면 DB 트리거가 profiles 를 만든다.
   나머지 값(categories, available_times, regions)은 가입 직후 update 로 채운다.

6. 타인 프로필에는 "참여 예정" 액션을 절대 노출하지 않는다.
   getParticipatedActions() 가 완료된 것만 돌려주므로 그 함수를 쓴다.
   실명(name)보다 닉네임을 주 표기로 쓴다.

7. Discover 는 자유 대화가 아니라 정해진 질문 3개다.
   추천 순위는 코드(lib/utils/scoring.ts)가 계산한다. AI 에게 순위를 맡기지 않는다.
   AI 는 필터 JSON 생성과 추천 이유 문장 작성만 한다. LLM 이 SQL 을 만들지 않는다.
   AI 호출이 실패해도 추천 카드는 나와야 한다.

8. 날짜 표시는 lib/utils/date.ts 를 쓴다.
   formatDate · formatDateShort · formatTime · formatActivityPeriod · formatRelative

9. 이미 있는 공통 컴포넌트를 쓴다. 비슷한 것을 새로 만들지 않는다.
   Button Badge Chip ChipGroup EmptyState Toast Avatar ActionCard
   RegionPicker UserList LogoutButton ProfileEditForm
   ToggleButtons(LikeButton SaveButton FollowButton) Header BottomNav

10. lib/ 과 components/ui/ 는 다섯 명이 함께 쓰는 공유 구역이다.
    lib/constants/regions.ts 와 lib/utils/scoring.ts 는 내 담당이라 고쳐도 된다.
    그 밖의 lib/ 파일은 수정하지 말고 "수정이 필요하다"고 알려준다.

11. 서버 컴포넌트가 기본이다. 'use client' 는 훅·이벤트가 필요할 때만 쓴다.

12. 목록 화면에는 빈 상태(EmptyState)를 반드시 넣는다. 다음 행동 버튼을 함께 준다.

13. 사용자에게 보이는 문구와 코드 주석은 한국어로 쓴다.
    로그인 후에는 router.refresh() 를 부른다. 안 부르면 화면이 로그아웃 상태로 보인다.

14. 새 파일·새 쿼리·새 상수를 만들기 전에, 이미 있는 것을 먼저 찾아 쓴다.

## 오늘 할 일

(여기에 원하는 작업을 적으세요. 예시)
app/(auth)/signup/page.tsx 에서 2단계로 갔다가 1단계로 돌아오면
입력한 값이 그대로 남아 있는지 확인하고, 안 남아 있으면 고쳐줘.
```
