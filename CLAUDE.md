# GOOD MVP — 개발 규칙

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

---

## 스키마를 바꿨다면

```bash
npm run verify:db
```

권한·정원·성별 제한이 실제로 막히는지 31가지를 확인합니다. 로컬에서만 돌아가고, 테스트 계정과 액션을 만들었다가 끝나면 지웁니다.

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
| `getActionCrew` | The Crew 목록 |
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

`joinAction` · `leaveAction` · `submitCrewVoice` · `postChatMessage` · `deleteChatMessage` ·
`publishAction` · `completeAction` · `cancelAction` · `deleteDraft` ·
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
| DRAFT 삭제 | 행을 실제로 삭제 |
| 크루챗 삭제 | 본인 글만 soft delete. **원글을 지우면 댓글도 함께 삭제** |
| 알림 | 6종 확정. 팔로우 알림 없음 |
| AI 검수 | PASS / REVISE / BLOCK 3단계. **Owner가 공개 버튼을 눌러야 ACTIVE** |
| 타인 프로필 | 통계 유지 + 참여 목록은 완료된 것만 + 닉네임 주 표기 |
| Discover 거리 | km 계산 안 함. 시·군·구 단위 매칭까지만 |

---

## 폴더 담당 (충돌 방지)

브랜치 충돌은 여러 명이 같은 파일을 건드릴 때 납니다. 아래를 지키면 거의 안 납니다.

| 담당 | 폴더 |
|---|---|
| 민호 (통합) | `lib/`, `middleware.ts`, `supabase/`, `app/api/notifications/` |
| 조장 | `app/activity/`, `app/api/ai/trends/`, `supabase/04_seed.sql` |
| 디자이너 | `components/ui/`, `components/layout/`, `app/page.tsx`, `app/action/[id]/page.tsx`, `tailwind.config.ts` |
| 개발 A | `app/(auth)/`, `app/my/`, `app/user/`, `app/discover/`, `app/api/ai/discover/` |
| 개발 B | `app/action/[id]/` 하위(join·chat·crew·result·voice), `app/api/chat/` |

**`components/ui/`와 `lib/`은 유일한 공유 구역입니다.** 여기를 고칠 때는 먼저 말해주세요.

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
- `.env.local`은 `.gitignore`에 있습니다. **키를 메신저로 주고받지 마세요.** OpenAI 대시보드에서 사용량 한도를 걸어두면 사고가 나도 금액이 막힙니다.

---

## 코드 스타일

- 사용자에게 보이는 문구는 한국어. 코드 주석도 한국어.
- 에러 메시지는 무엇이 잘못됐고 어떻게 고치는지 알려줍니다. "오류가 발생했습니다" 금지.
- 상수는 `lib/constants/index.ts`에서 가져다 씁니다. 카테고리·시간·상태 문자열을 직접 적지 마세요.
- 커밋 메시지는 한국어로 무엇을 했는지. `feat: 액션 상세 화면 추가`
