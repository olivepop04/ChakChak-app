# 착착(CHAK CHAK) MVP — 개발 규칙

이 파일은 Claude Code와 팀원 모두가 읽는 기준 문서입니다.
새로 합의한 내용이 생기면 여기에 먼저 적고 코드를 고칩니다.

---

## 용어

**서비스 전체에서 "액션(action)"으로 부릅니다.** 기존 문서의 "프로젝트"는 전부 액션입니다.

| 기존 문서 | 지금 |
|---|---|
| projects | `actions` |
| project_items | `action_items` |
| project_results | `action_results` |
| BEFORE_PROJECT | `BEFORE_ACTION` |
| AFTER_PROJECT | `AFTER_ACTION` |

---

## 자주 막히는 것 (읽고 시작하세요)

**1. `params`는 Promise입니다 (Next.js 15)**

```tsx
// 안 됨
export default function Page({ params }: { params: { id: string } }) {
  const id = params.id;
}

// 맞음
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
}
```

`searchParams`도 마찬가지입니다. 검색해서 나오는 예제 대부분이 구버전이라 여기서 한 번씩 막힙니다.

**2. `cookies()`도 await이 필요합니다** — `lib/supabase/server.ts`가 이미 처리해 뒀으니 그 함수만 쓰세요.

**3. 데이터가 빈 배열로만 나온다면 RLS입니다** — 에러가 안 나고 조용히 빈 결과가 옵니다. `supabase/02_rls.sql`에서 해당 테이블 정책을 확인하세요.

**자주 걸리는 것만 표로 적어둡니다.** 실제로 확인한 결과입니다.

| 무엇 | 비회원 | 로그인·미참여 | 참여한 크루 | 호스트 |
|---|---|---|---|---|
| 액션 내용 (ACTIVE 이상) | ✅ | ✅ | ✅ | ✅ |
| 참여 **수** (`crewCount`) | ✅ | ✅ | ✅ | ✅ |
| 참여자 **명단** | ❌ | ❌ | ✅ | ✅ |
| 각자 고른 **사람 항목** | ❌ | ❌ | ✅ | ✅ |
| 각자 고른 **물품 수량** | ❌ | ❌ | 본인 것만 | ✅ |
| 게시판 | ❌ | ❌ | ✅ | ✅ |

**"명단은 안 보여도 숫자는 보인다"** 를 기억하세요. 비회원에게 참여 현황을 보여줘야 하면
`crewCount` 를 쓰면 됩니다. 물품 수량을 크루끼리 숨긴 이유는 누가 얼마나 냈는지
서로 비교하게 되기 때문입니다 (`supabase/07_update.sql`).

**4. 데이터는 공용 함수로만** — 아래 5번 참고.

**5. 진행률은 뷰에서 읽으세요** — `action_item_progress`. 카드마다 합계 쿼리를 돌리면 피드에서 쿼리가 수십 번 나갑니다. (`lib/queries/`가 이미 그렇게 하고 있습니다)

**6. 뷰에서 온 값은 타입이 전부 `| null`입니다** — Postgres가 뷰의 NOT NULL 여부를 보장하지 못해서, 원본이 NOT NULL이어도 생성된 타입은 nullable이 됩니다. 실제로 비는 일은 없지만 타입 검사는 통과해야 하니 `?? 기본값`으로 받으세요. 이미 `lib/queries/`에서 처리했으니 화면에서는 신경 쓰지 않아도 됩니다.

**7. DB 타입 이름은 `lib/types/db.ts`에서 가져오세요** — `database.ts`는 자동 생성 파일이라 스키마를 바꿀 때마다 통째로 덮어써집니다. 손으로 아무것도 적지 마세요.

```ts
import type { ActionRow, ProfileRow } from '@/lib/types/db';
```

**8. 여러 행을 한 번에 insert할 때 DB 기본값이 안 먹습니다** — PostgREST가 컬럼 목록을 하나로 합쳐서, 어떤 행에만 없는 키를 "생략"이 아니라 **명시적 NULL**로 보냅니다. `DEFAULT`가 적용되지 않아 NOT NULL 위반이 납니다.

```ts
// ❌ 두 번째 행의 gender_requirement 가 NULL 로 전송되어 실패
await supabase.from('action_items').insert([
  { name: 'A', gender_requirement: 'MALE', ... },
  { name: 'B', ... },
]);
```

여러 행을 넣을 때는 **모든 컬럼을 빠짐없이 채우세요.** 모집 항목은 `saveActionItems()`가 이미 처리합니다.

**9. 공개된 액션에 `saveActionItems()` 를 부르면 안 됩니다** — 그 함수는 "전부 지우고 다시 넣기" 방식입니다.

`participation_items` 가 `ON DELETE CASCADE` 라, 항목을 지우면 **그 항목을 고른 크루들의 참여 기록이 함께 사라집니다.** 에러도 나지 않습니다.

```ts
// ❌ 공개된 액션에서 부르면 크루 전원의 항목 선택이 날아갑니다
await saveActionItems(supabase, actionId, items);

// ✅ 공개 뒤에는 추가만 합니다
await addActionItems(supabase, actionId, newItems);
```

DB 트리거(`supabase/10`)가 막아주지만, **애초에 맞는 함수를 쓰세요.**
DRAFT 는 무엇이든 가능하고, 공개된 뒤에는 수정·삭제가 거절됩니다.

**10. `profiles.skills` 는 `null` 과 빈 배열이 다릅니다**

```
null      아직 안 물어봤음  → AI 가 물어봐도 됨
[]        없다고 답함     → 다시 묻지 않음
['사진']  있음            → 다시 묻지 않음
```

`?? []` 로 받으면 이 구분이 사라져서, **재능이 없는 사람에게 AI 가 계속 재능을 묻습니다.**
재능은 자유 입력이 아니라 `lib/constants` 의 `SKILLS` 목록에서 고릅니다.

**11. 취소와 조기 종료는 다른 일입니다** — 상태도 카운팅도 다릅니다.

| 언제 | 무엇을 쓰나 | 결과 | 내가 만든 액션에 |
|---|---|---|---|
| 활동 시작 **전** | `cancelAction()` | `CANCELLED` | **안 셉니다** |
| 활동 **중** | `endActionEarly()` | `ENDED` | **셉니다** |
| 활동 종료 후 | 둘 다 안 됩니다 | — | 결과를 쓰는 길만 남습니다 |

"없던 일이 된 것"과 "하긴 했는데 일찍 끝난 것"을 나누기로 했습니다. 조기 종료는 예정 종료와 똑같이 흘러갑니다 — 크루는 `AFTER_ACTION`이 되고, 소감을 쓰면 참여 완료입니다.

조기 종료 사유는 **두 군데에 남습니다** (15).

| 어디 | 누가 볼 수 있나 | 쓸 곳 |
|---|---|---|
| `actions.early_end_reason` | **누구나** | 액션 상세 상단 안내 (취소 사유와 같은 자리) |
| 크루챗 공지 | **참여한 사람만** | 대화 흐름 속의 기록. 호스트도 못 지웁니다 |

처음엔 크루챗에만 남겼는데, 크루챗은 참여한 사람만 읽을 수 있어서
액션 상세 상단에 띄울 수가 없었습니다. 화면에서는 `action.earlyEndReason` 을 쓰세요.

**12. 액션은 카테고리를 여러 개 가집니다** — `category` 를 직접 쓰지 마세요.

```
categories  ['환경','교육']   ← 진짜 값. 1~3개
category    '환경'            ← DB 트리거가 첫 번째를 자동으로 넣습니다
```

`category` 는 **대표 하나를 보여줄 때만** 읽습니다. 쓸 때는 `categories` 만 주면 됩니다.

```ts
// ✅ 저장
await saveActionDraft(supabase, { ...입력, categories: ['환경', '교육'] });

// ✅ 거르기 — 하나라도 걸치면
q.overlaps('categories', [고른칩])

// ❌ 이렇게 하면 두 번째 카테고리로 만든 액션이 영영 안 나옵니다
q.eq('category', 고른칩)
```

DB 가 **1~3개 · 중복 금지 · 목록에 있는 값만** 을 막습니다. 공개한 뒤에는 못 바꿉니다.
거절되면 한국어 메시지가 그대로 오니 `res.message` 를 그대로 띄우면 됩니다.

> 화면 작업이 다 끝나면 `category` 컬럼을 지웁니다. 그때까지는 두 값이
> 트리거로 붙어 있어서, 아직 안 고친 화면도 안 깨집니다.

---

## 자주 쓰는 명령

```bash
npm run verify:db
```

스키마를 바꾼 뒤 돌리세요. 권한·정원·성별·생애주기·나가기·조기 종료·카테고리까지 100가지가 넘는 동작을 실제 계정으로 확인합니다. 로컬 전용이고, 테스트 계정을 만들었다가 끝나면 지웁니다.

```bash
npm run seed
```

시연용 액션 41개를 채웁니다. **여러 번 돌려도 안전합니다** — 기존 시드를 지우고 새로 넣습니다. `npm run seed:clean` 으로 지울 수 있고, 시드 계정(`@good.seed`)만 골라 지우므로 실제 사용자 데이터는 건드리지 않습니다.

**시드로 만든 액션·계정의 주소는 매번 같습니다** (2026-09-04). 전에는 `seed` 를 다시 돌리면 같은 액션인데 번호가 바뀌어서, 화면을 열어둔 채 돌리면 그 링크가 죽었습니다("페이지를 찾을 수 없습니다"). 지금은 제목에서 번호를 계산하므로 **열어둔 탭도 그대로 살아 있습니다.** 북마크·발표 대본에 링크를 적어둬도 됩니다.

단, `scripts/seed.mjs` 의 `ACTIONS` **목록 순서를 바꾸면 그 뒤 액션들의 번호가 전부 바뀝니다.** 추가할 때는 목록 끝에 붙이세요.

시드 계정으로 로그인한 상태에서 `seed` 를 다시 돌리면 **로그인만 풀립니다.** 계정을 지웠다 다시 만들기 때문이고, 버그가 아닙니다. 다시 로그인하면 됩니다 — 링크는 그대로 살아 있습니다.

---

## AI 프롬프트를 고칠 때

`lib/openai.ts` 의 `promptVersion` 을 **반드시 올리세요** (`trends-v1` → `trends-v2`).

`ai_runs` 테이블에 버전별 성공/실패가 쌓입니다. 발표의 "검증·개선" 항목은 여기서 뽑습니다 — 처음 프롬프트가 틀린 답을 낸 사례와, 고친 뒤 정확해진 사례를 나란히 보여줄 수 있습니다. **초기 버전 로그를 지우지 마세요.**

실제로 이렇게 잡은 게 두 건 있습니다.

- `discover-reason-v1` — 프롬프트에 "json" 이라는 낱말이 없어 OpenAI 가 400 을 돌려줬습니다. 화면에는 기본 문구가 나와서 겉보기엔 멀쩡했습니다.
- `trends-v1` → `v2` — 필드 이름이 모호해 AI 가 서로 다른 항목을 섞어 없는 비율을 만들어냈습니다.

---

## 데이터 다루는 법 (가장 중요)

> **읽기는 `lib/queries/`, 쓰기는 `lib/mutations.ts`.**
> 화면에서 `supabase.from(...)` 이나 `supabase.rpc(...)` 를 직접 쓰지 마세요.

각자 쿼리를 짜면 `LEFT` 제외를 빠뜨리거나 조인을 틀리게 해서 **같은 데이터가 화면마다 다르게 보입니다.**

### 읽기

| 함수 | 용도 |
|---|---|
| `getActionFeed` | Home 피드 (ACTIVE만) |
| `getActionDetail` | 액션 상세 (진행률·내 참여 상태 포함) |
| `getActionItems` | 항목별 진행 상황 |
| `getMyCreatedActions` | 내가 만든 액션 (DRAFT 포함) |
| `getMyJoinedActions` | 내가 참여한 액션 (LEFT 제외) |
| `getSavedActions` | 저장한 액션 |
| `getPublicActionsByOwner` | 남이 만든 공개 액션 |
| `getParticipatedActions` | 남이 참여한 **완료된** 액션 |
| `getRecommendCandidates` | 추천 후보 (제외 규칙 적용됨) |
| `getActionCrew` | The Crew 목록 (각자 참여한 항목 포함) |
| `groupCrewByItem` | 크루를 항목별로 묶기 — "1일차에 누가 오나" |
| `getActionResult` | 결과 + 소감 |
| `getChatPosts` | 게시판 (원글 + 댓글) |
| `getProfile` / `getFollowers` / `getFollowing` / `searchUsers` | 프로필·팔로우 |
| `getNotifications` | 알림 |

### 쓰기 — 전부 `lib/mutations.ts`

모든 함수가 `{ ok, data }` 또는 `{ ok: false, message }` 를 돌려줍니다.
`message`는 **그대로 사용자에게 보여주면 되는 한국어**라 `try/catch`가 필요 없습니다.

```ts
const res = await joinAction(supabase, actionId, items);
if (!res.ok) { setError(res.message); return; }
```

`joinAction` · `leaveAction` · `leaveActionWithReason` · `submitCrewVoice` ·
`postChatMessage` · `deleteChatMessage` ·
`saveActionDraft` · `updateActionText` · `saveActionItems` · **`addActionItems`** · `saveActionResult` · `publishAction` · `completeAction` · `cancelAction` · **`endActionEarly`** · `deleteDraft` ·
`updateProfile` · `isNicknameTaken` · `updateNotifySettings` ·
`toggleLike` · `toggleSave` · `toggleFollow` · `shareToUser` · `markNotificationRead`

**필요한 함수가 없으면 직접 추가하지 말고 민호에게 요청하세요.** `lib/`은 공유 구역입니다.

---

## 모집 수량 규칙 (가장 중요)

모집 방식은 **딱 두 가지**입니다.

| target_type | min_required | max_allowed | 의미 |
|---|---|---|---|
| RANGE | 3 | 3 | 정확히 3명 |
| RANGE | 3 | 5 | 3~5명 |
| MINIMUM | 10 | NULL | 최소 10명, 계속 모집 |

물품도 같은 구조를 씁니다. 보통 MINIMUM입니다.

**화면 표시 규칙 두 개:**

1. **MINIMUM에는 퍼센트를 쓰지 않습니다.** 15/10 = 150%는 사용자에게 의미가 없습니다.
2. **RANGE는 최소를 넘기면 분모가 바뀝니다.** `2 / 3명` → (3명 도달) → `3 / 5명`

숫자를 직접 조합하지 말고 반드시 `lib/utils/quota.ts`의 함수를 쓰세요.

```ts
import { getQuotaState, describeTarget } from '@/lib/utils/quota';
```

---

## 결정 사항 (2026-08-31 확정)

| 항목 | 결정 |
|---|---|
| 프로필 사진 | 없음. 이니셜 아바타만 (`components/ui/Avatar.tsx`) |
| 액션 대표 이미지 | 최대 3장 + 대표 지정 |
| 결과 사진 | 최소 1장, 최대 5장 (필수) |
| 물품 단위 | 자유 입력. 수량도 직접 타이핑 가능 |
| 날짜 | 모집 마감 / 활동 시작 / 활동 종료 **3개 별개 값** |
| 성별 | 가입 시 필수. **항목별로** 남/여/무관 제한 가능 |
| 참여 나가기 | 허용. status를 `LEFT`로, 행은 남김. 집계에서 제외 |
| 취소 · 조기 종료 | **활동 시작 전 = 취소(CANCELLED, 안 셈) · 활동 중 = 조기 종료(ENDED, 셈)**. 2026-09-04 |
| DRAFT 삭제 | 행을 실제로 삭제 |
| 크루챗 삭제 | 본인 글만 soft delete. **원글을 지우면 댓글도 함께 삭제** |
| 알림 | 6종 확정. 팔로우 알림 없음 |
| AI 검수 | PASS / REVISE / BLOCK 3단계. **호스트가 공개 버튼을 눌러야 ACTIVE** |
| 타인 프로필 | 통계 유지 + 참여 목록은 완료된 것만 + 닉네임 주 표기 |
| Discover 거리 | km 계산 안 함. 시·군·구 단위 매칭까지만 |

---

## 폴더 담당 (충돌 방지)

브랜치 충돌은 여러 명이 같은 파일을 건드릴 때 납니다. 아래를 지키면 거의 안 납니다.

| 담당 | 구역 |
|---|---|
| 민호 (통합) | `lib/` · `supabase/` · `middleware.ts` · `scripts/verify-db.mjs` · `app/notifications/` · `app/action/[id]/share/` · `app/api/ai/review/` · `app/api/ai/classify/` |
| 조장 | `app/activity/` · `app/trends/` · `components/trends/` · `app/api/ai/trends/` · `scripts/seed.mjs` · `lib/queries/stats.ts` |
| 디자이너 | `components/ui/` · `components/layout/` · `app/page.tsx` · `app/layout.tsx` · `app/globals.css` · `app/action/[id]/page.tsx` · `tailwind.config.ts` |
| 개발 A | `app/(auth)/` · `app/my/` · `app/user/` · `app/discover/` · `app/api/ai/discover/` · `lib/constants/regions.ts` · `lib/utils/scoring.ts` |
| 개발 B | `app/action/create/` · `app/action/[id]/` 하위 (join · welcome · crew · chat · result · voice) |

`components/action/` 은 **파일 단위로 담당**이 있습니다.

| 파일 | 담당 |
|---|---|
| ActionForm · ItemEditor · JoinForm · ChatBoard · ResultWriteForm · VoiceForm · **LeaveButton** | 개발 B |
| ActivityButtons | 조장 |
| DiscoverChat | 개발 A |
| SharePanel | 민호 |
| ActionGallery · AddressBox | 디자이너 |
| QuotaProgress | **공유** — 상세(디자이너)와 참여(개발 B)가 같이 씁니다. 고치기 전에 말하기 |

**`components/ui/`와 `lib/`은 공유 구역입니다.** 고칠 때는 먼저 말해주세요.
예외 — 위 표에 적힌 `lib/` 파일 4개(`stats.ts` · `regions.ts` · `scoring.ts` · `discover-ranking.ts`)는 각 담당이 바로 고쳐도 됩니다.

`tests/` 는 **누구나 추가**할 수 있습니다. 자기 담당 로직의 테스트를 붙이는 건 언제나 환영입니다.

```bash
npm test
```

Node 내장 테스트 러너를 씁니다. **새로 설치할 패키지가 없습니다.**

> **담당이 바뀌면 세 곳을 같이 고칩니다** — 이 표, 다른 쪽 표(CLAUDE.md ↔ docs/00-공통규칙.md), 그리고 해당 역할 문서(docs/01~05).
> 한 곳만 고치면 파일마다 답이 달라집니다. 2026-09-01에 실제로 그런 혼선이 있었습니다.

---

## 브랜치

```
main        배포용. 민호만 병합.
 └ dev      통합용. 모든 PR은 여기로.
    └ feature/이름-화면
```

1. `main`에 직접 push하지 않습니다.
2. 작업 시작 전 항상 `git pull origin dev`.
3. 브랜치는 작게, 자주 병합합니다. "다 만들면 올릴게요"보다 "목록만 되면 올릴게요"가 안전합니다.
4. `components/ui/`, `lib/`을 고칠 때는 먼저 공유합니다.
5. **스키마는 Supabase 콘솔에서 직접 고치지 않습니다.** 변경은 `supabase/`에 새 파일로 쌓습니다.

---

## 보안

- `SUPABASE_SERVICE_ROLE_KEY`는 서버 전용입니다. `NEXT_PUBLIC_` 접두사를 붙이면 절대 안 됩니다.
- 클라이언트 컴포넌트에서 `lib/openai.ts`를 import하지 마세요. `server-only`가 걸려 있어 빌드가 실패합니다.
- `.env.local`은 `.gitignore`에 있습니다. **키를 메신저로 주고받지 마세요.** 캡처가 남고 대화방은 검색됩니다.
- OpenAI 키는 **각자 발급받은 것만** 쓰세요. 빌려주고 빌려 쓰면 사용량이 섞이고, 하나가 새면 여럿이 멈춥니다.

---

## 코드 스타일

- 사용자에게 보이는 문구는 한국어. 코드 주석도 한국어.
- 에러 메시지는 무엇이 잘못됐고 어떻게 고치는지 알려줍니다. "오류가 발생했습니다" 금지.
- 상수는 `lib/constants/index.ts`에서 가져다 씁니다. 카테고리·시간·상태 문자열을 직접 적지 마세요.
- 커밋 메시지는 한국어로 무엇을 했는지. `feat: 액션 상세 화면 추가`
