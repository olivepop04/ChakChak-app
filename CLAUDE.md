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

**단, `02` 가 끝이 아닙니다** (2026-09-22에 확인). 번호가 큰 파일이 이깁니다.

| | |
|---|---|
| `02` 의 정책을 **덮어쓴** 것 | `participation_items_select` → `07` · `action_results_select` → `18` · `likes_insert`·`saves_insert` → `13` |
| `02` 에 **아예 없는** 것 | `shares` 는 테이블째로 `10` 에서 생기고, `action_ai_metadata` 의 INSERT 는 `05` 에서 처음 생깁니다 |

**빈 배열(SELECT) 증상은 `participation_items`(07) 와 `action_results`(18) 를 먼저 보세요.**
특히 `action_results` 는 `18` 에서 `COMPLETED 이거나 호스트` 로 좁혀졌습니다 —
`02` 의 `is_action_public`(ENDED 포함) 만 읽으면 **ENDED 액션의 결과가 왜 비는지 못 찾습니다.**

**쓰기도 `21` 에서 좁혔습니다** (2026-09-30, 배포 전 검수). 브라우저 개발자 도구로 표를 직접 고쳐
남의 크루챗에 들어가거나 공개 검수를 건너뛸 수 있었습니다.

| 표 | 직접 고치기 | 대신 |
|---|---|---|
| `participations` | **UPDATE 정책 없음** — 보내도 오류 없이 아무것도 안 바뀝니다 | 나가기·소감·상태 전환은 전부 RPC |
| `chat_messages` | **UPDATE 정책 없음** | 삭제는 `delete_chat_message` |
| `actions` | 새로 넣을 땐 `DRAFT` 만 · `status`·`owner_id`·두 사유 칸은 못 바꿈 | 공개·취소·조기 종료·결과 공개 RPC |
| `profiles` | `gender` 못 바꿈 (아바타처럼) | 관리자(서비스 롤)만 |

막는 기준은 `current_user = 'authenticated'`(직접 요청)입니다. RPC 는 함수 주인 역할로 돌아서 그대로 됩니다.
**그래서 새 기능에서 이 표들을 화면이 직접 UPDATE 하게 짜면 조용히 안 됩니다** — RPC 를 만들어 달라고 해주세요.

**자주 걸리는 것만 표로 적어둡니다.** 실제로 확인한 결과입니다.

| 무엇 | 비회원 | 로그인·미참여 | 참여한 크루 | 호스트 |
|---|---|---|---|---|
| 액션 내용 (ACTIVE 이상) | ✅ | ✅ | ✅ | ✅ |
| 참여 **수** (`crewCount`) | ✅ | ✅ | ✅ | ✅ |
| 참여자 **명단** | ❌ | ❌ | ✅ | ✅ |
| 각자 고른 **사람 항목** | ❌ | ❌ | ✅ | ✅ |
| 각자 고른 **물품 수량** | ❌ | ❌ | 본인 것만 | ✅ |
| 게시판 | ❌ | ❌ | ✅ | ✅ |
| 남의 **참여 완료 수·목록** | ✅ | ✅ | ✅ | ✅ |

마지막 줄만 다릅니다 — **참여 완료(소감까지 쓴 것)는 누구에게나 공개**입니다.
프로필 통계의 **"참여 완료 액션 N"** 이 그 값입니다 (아래 규칙 4 와 같은 이름입니다). 다만 `participations` 를 직접 세면 RLS 때문에
남의 것은 **0 이나 일부만** 나오니(내가 만든 액션·내가 속한 크루와 겹치는 것만 보입니다),
`lib/queries/public-stats.ts` 를 쓰세요 (`supabase/16_update.sql`).
**참여 예정·나간 기록은 여전히 비공개**입니다.

**"명단은 안 보여도 숫자는 보인다"** 를 기억하세요. 비회원에게 참여 현황을 보여줘야 하면
`crewCount` 를 쓰면 됩니다. 물품 수량을 크루끼리 숨긴 이유는 누가 얼마나 냈는지
서로 비교하게 되기 때문입니다 (`supabase/07_update.sql`).

**4. 「참여한 액션」 은 두 곳에서 다른 것을 셉니다** — 이름을 갈라 뒀습니다 (2026-09-11).

| 어디 | 이름 | 세는 것 |
|---|---|---|
| Activity 탭 | **참여한 액션** | 참여 예정 + 소감작성필요 + 참여 완료 + 취소됨 (전부) |
| 프로필 통계 | **참여 완료 액션** | 소감까지 쓴 것(`ACTUALLY_PARTICIPATED`)만 |

전에는 둘 다 「참여한 액션」 이라, 참여 예정만 있는 사람이
**목록에는 1개인데 통계는 0** 인 화면을 보고 버그로 신고했습니다. 버그가 아니라 이름 문제였습니다.
통계 라벨은 `lib/utils/profile-display.ts` 의 `buildProfileStats` 한 곳에서 나옵니다 —
내 프로필과 타인 프로필이 같은 함수를 씁니다.

**5. 데이터는 공용 함수로만** — 아래 6번 참고.

**6. 진행률은 뷰에서 읽으세요** — `action_item_progress`. 카드마다 합계 쿼리를 돌리면 피드에서 쿼리가 수십 번 나갑니다. (`lib/queries/`가 이미 그렇게 하고 있습니다)

**7. 뷰에서 온 값은 타입이 전부 `| null`입니다** — Postgres가 뷰의 NOT NULL 여부를 보장하지 못해서, 원본이 NOT NULL이어도 생성된 타입은 nullable이 됩니다. 실제로 비는 일은 없지만 타입 검사는 통과해야 하니 `?? 기본값`으로 받으세요. 이미 `lib/queries/`에서 처리했으니 화면에서는 신경 쓰지 않아도 됩니다.

**8. DB 타입 이름은 `lib/types/db.ts`에서 가져오세요** — `database.ts`는 자동 생성 파일이라 스키마를 바꿀 때마다 통째로 덮어써집니다. 손으로 아무것도 적지 마세요.

```ts
import type { ActionRow, ProfileRow } from '@/lib/types/db';
```

**9. 여러 행을 한 번에 insert할 때 DB 기본값이 안 먹습니다** — PostgREST가 컬럼 목록을 하나로 합쳐서, 어떤 행에만 없는 키를 "생략"이 아니라 **명시적 NULL**로 보냅니다. `DEFAULT`가 적용되지 않아 NOT NULL 위반이 납니다.

```ts
// ❌ 두 번째 행의 gender_requirement 가 NULL 로 전송되어 실패
await supabase.from('action_items').insert([
  { name: 'A', gender_requirement: 'MALE', ... },
  { name: 'B', ... },
]);
```

여러 행을 넣을 때는 **모든 컬럼을 빠짐없이 채우세요.** 모집 항목은 `saveActionItems()`가 이미 처리합니다.

**10. 공개된 액션에 `saveActionItems()` 를 부르면 안 됩니다** — 그 함수는 "전부 지우고 다시 넣기" 방식입니다.

`participation_items` 가 `ON DELETE CASCADE` 라, 항목을 지우면 **그 항목을 고른 크루들의 참여 기록이 함께 사라집니다.** 에러도 나지 않습니다.

```ts
// ❌ 공개된 액션에서 부르면 크루 전원의 항목 선택이 날아갑니다
await saveActionItems(supabase, actionId, items);

// ✅ 공개 뒤에는 추가만 합니다
await addActionItems(supabase, actionId, newItems);
```

DB 트리거(`supabase/10`)가 막아주지만, **애초에 맞는 함수를 쓰세요.**
DRAFT 는 무엇이든 가능하고, 공개된 뒤에는 수정·삭제가 거절됩니다.

**빈 배열은 「전부 지웠다」 는 뜻입니다** (2026-09-17에 고쳤습니다).

```ts
// 임시저장 — 항목을 다 지운 것도 그대로 저장합니다
await saveActionItems(supabase, id, items);

// 공개 — 항목이 하나도 없으면 거절합니다
await saveActionItems(supabase, id, items, { requireAtLeastOne: true });
```

전에는 빈 배열을 **무조건 거절**했습니다. 그래서 임시저장 중에 항목을 X 로 다 지우면
**화면은 비었는데 DB 에는 그대로 남고, 그런데도 「저장했어요」 가 떴습니다.**
새로고침하거나 뒤로 갔다 오면 지운 항목이 되살아났습니다 (수정 NO10 3쪽).

**두 겹으로 막혀 있었습니다.** 함수만 고쳐서는 안 고쳐졌습니다 —
`components/action/ActionForm.tsx` 가 `if (items.length > 0 || requireItems)` 로 감싸서
항목이 0개면 이 함수를 **아예 부르지 않았습니다.**
2026-09-17에 화면 쪽도 고쳤습니다 (`ActionForm.tsx:245`) — 조건을 없애고 항상 부릅니다.

```ts
// 지금 — 임시저장은 통과, 공개(handleReview)만 거절
const res = await saveActionItems(supabase, id, items, { requireAtLeastOne: requireItems });
if (!res.ok) { toast(res.message, 'error'); scrollAndFocus(itemsSectionRef.current); return null; }
```

> **`requireItems` 를 임시저장 경로에 넘기면 이 버그가 그대로 되살아납니다.**
> `handleSave` 는 `saveDraft()`, `handleReview` 만 `saveDraft({ requireItems: true })` 입니다.

**이제 테스트가 지킵니다** — `tests/action-items-save.test.ts` (2026-09-22).
**두 겹을 다 지킵니다.** 한쪽만 고쳐서는 안 고쳐졌던 버그라서요.

| 무엇 | 어떻게 |
|---|---|
| 함수 — 빈 배열을 거절하지 않는다 | 검사를 `lib/utils/action-items-validation.ts` 의 순수 함수로 떼어내 직접 부릅니다 |
| 화면 — 항목 0개에서도 함수를 부른다 | `ActionForm.tsx` 소스에 `items.length` 검사가 생기면 깨집니다 |
| 임시저장·공개 경로가 갈려 있다 | `saveDraft()` / `saveDraft({ requireItems: true })` 를 각각 확인합니다 |

`lib/mutations.ts` 는 `@/` 별칭을 써서 **Node 테스트 러너가 import 하지 못합니다**
(`ERR_MODULE_NOT_FOUND`). 그래서 검사만 떼어냈습니다.

**정확히는 「별칭이 없는 파일」 이 아니라 「런타임에 `@/` 를 안 타는 파일」 입니다** —
`lib/utils/action-items-validation.ts` 도 `import type { ActionItemInput } from '@/lib/mutations'` 를
씁니다. **`import type` 은 타입만 가져와서 실행 시점에 지워지기 때문에** 별칭을 풀 일이 없습니다.
값을 하나라도 `@/` 로 가져오면 그 순간 import 가 깨집니다. 다른 검사 로직에 테스트를 붙일 때도
같은 선을 지키세요.
**버그를 일부러 되살려 두 변이 모두 테스트가 깨지는 것을 확인했습니다.**

**11. `profiles.skills` 는 `null` 과 빈 배열이 다릅니다**

```
null      아직 안 물어봤음  → AI 가 물어봐도 됨
[]        없다고 답함     → 다시 묻지 않음
['사진']  있음            → 다시 묻지 않음
```

`?? []` 로 받으면 이 구분이 사라져서, **재능이 없는 사람에게 AI 가 계속 재능을 묻습니다.**
재능은 `lib/constants` 의 `SKILLS` 목록에서 고르고, **목록에 없으면 「기타」 한 칸에 직접 적습니다** —
`app/my/_components/skill-selection.ts` 의 `buildStoredSkills()` 가 그 값을 `profiles.skills` 에
그대로 넣습니다. **그래서 목록 밖 값이 DB 에 있을 수 있습니다.**
다만 **추천·매칭은 고정 목록 값으로만 합니다** — 같은 재능이 「사진 / 사진 찍기 / 사진 촬영」 으로
갈리면 액션과 연결이 안 되기 때문입니다 (`lib/constants/index.ts` 주석).

**재능은 15개 + 「기타」 = 화면에 16종**입니다 (2026-09-28, 조장님 요청으로 9 → 15).
목록은 **`SKILLS` 에서 정합니다.** 가입·프로필 수정(`TalentPreferenceEditor`)·AI 분류(`lib/ai/classify-spec.ts`)·Discover 선택지(`getQuestionOptions`)가 그걸 가져다 씁니다.
**「기타」 를 `SKILLS` 에 넣지 마세요** — 화면이 `[...SKILLS, '기타']` 로 칩을 만들어서 두 번 나옵니다.
새 재능은 **끝에 붙이세요** — 앞의 이름을 바꾸면 이미 저장된 값과 안 맞습니다. `tests/skills-list.test.ts` 가 지킵니다.

**다만 재능 이름을 손으로 적은 곳이 남아 있습니다** (2026-09-29 확인). 지금 값은 `SKILLS` 와 같습니다.
목록을 바꾸면 아래 표에서 **「조용히 어긋남」 인 곳은 테스트가 못 잡으니** 같이 고치세요.

| 어디 | 무엇 |
|---|---|
| `lib/ai/classify-spec.ts` 지시문의 출력 예시 | 재능 3개를 예로 적었습니다 — `tests/classify-sync.test.ts` 가 허용 목록 안인지 **검사합니다** |
| `scripts/seed.mjs` 시드 사용자 재능 · `scripts/verify-db.mjs` 검사값 | 사람마다 고른 값으로 적었습니다 — **조용히 어긋남** |

**Discover 는 위 `null` / `[]` 구분을 쓰지 않습니다** (2026-09-09 `452a6d2` 부터).
`profile.skills ?? []` 로 받아 둘 다 「등록된 재능 없음」 으로 봅니다.
9/28 개편 뒤로 재능 질문은 난이도에서 「전문지식/자격/재능 활용」 을 고른 대화에서만 나옵니다.

**12. 취소와 조기 종료는 다른 일입니다** — 상태도 카운팅도 다릅니다.

| 언제 | 무엇을 쓰나 | 결과 | 내가 만든 액션에 |
|---|---|---|---|
| 활동 시작 **전** | `cancelAction()` | `CANCELLED` | **안 셉니다** |
| 활동 **중** | `endActionEarly()` | `ENDED` | **셉니다** |
| 활동 종료 후 | 둘 다 안 됩니다 | — | 결과를 쓰는 길만 남습니다 |

**취소된 액션은 소개·안내도 고칠 수 없습니다** (2026-09-29, `supabase/19`). 「액션 수정」 버튼도 안 보이고, 수정 화면에 들어오면 상세로 돌려보냅니다.
종료·완료된 액션은 F41 대로 소개·안내를 고칠 수 있습니다.

"없던 일이 된 것"과 "하긴 했는데 일찍 끝난 것"을 나누기로 했습니다. 조기 종료는 예정 종료와 똑같이 흘러갑니다 — 크루는 `AFTER_ACTION`이 되고, 소감을 쓰면 참여 완료입니다.

조기 종료 사유는 **두 군데에 남습니다** (15).

| 어디 | 누가 볼 수 있나 | 쓸 곳 |
|---|---|---|
| `actions.early_end_reason` | **누구나** | 액션 상세 상단 안내 (취소 사유와 같은 자리) |
| 크루챗 공지 | **참여한 사람만** | 대화 흐름 속의 기록. 호스트도 못 지웁니다 |

처음엔 크루챗에만 남겼는데, 크루챗은 참여한 사람만 읽을 수 있어서
액션 상세 상단에 띄울 수가 없었습니다. 화면에서는 `action.earlyEndReason` 을 쓰세요.

다만 **버튼을 고를 때는 쓰면 안 됩니다.** 사유를 띄우는 용도일 뿐입니다 — 아래 15번.

**13. 액션은 카테고리를 여러 개 가집니다** — `category` 를 직접 쓰지 마세요.

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

**14. 결과도 「저장」과 「공개」가 다릅니다** — 액션 만들기와 같은 모양입니다 (2026-09-11).

```
saveActionResult()   임시저장 — 사진 0장도, 글이 비어 있어도 저장됩니다
completeAction()     공개    — 사진 1장 이상이 없으면 거절합니다
```

결과 작성을 한 번에 못 끝내는 경우가 있어서 이렇게 나눴습니다. 사진 정리가 늦어지는 것이
가장 흔한 이유라, 저장할 때 사진을 요구하면 「글만 써두고 나가기」 가 안 됩니다.

**임시저장한 결과는 호스트 본인에게만 보입니다.** RLS 가 공개된 결과(COMPLETED)와
내 결과만 읽게 막아 둡니다 (`supabase/18`). 결과 보기 화면은 비회원도 들어오는 곳이라,
쓰다 만 결과가 새면 안 됩니다. 이 정책을 되돌리면 그대로 새어 나갑니다.

**15. 액션 상세 맨 아래 큰 버튼은 `getActionCta()` 가 정합니다** — 화면에서 if 를 쌓지 마세요.

```ts
import { getActionCta } from '@/lib/utils/action-cta';

const cta = getActionCta({
  actionId: action.id,
  status: action.status,
  isOwner: action.isOwner,
  myParticipation: action.myParticipation,
  activityEndAt: action.activityEndAt,
  recruitClosed: action.recruitClosed,
  allItemsFull: action.items.length > 0 && action.items.every((i) => i.isFull),
});
```

| 누가 | 언제 | 무엇이 나오나 |
|---|---|---|
| 공통 | 취소됨 | `취소된 액션이에요` (누를 수 없음) |
| 공통 | 결과 나옴 | `결과 보기` |
| 호스트 | **아직 공개 전(DRAFT)** | `이어서 작성하기` → `/action/create?id=…` |
| 그 밖 | 아직 공개 전(DRAFT) | `아직 공개 전인 액션이에요` (RLS 가 먼저 가림) |
| 호스트 | 활동 종료 전 | `함께하는 크루와 이야기하기` |
| 호스트 | 활동 끝남 (**조기 종료 포함**) | `CREW CHAT` + `결과 작성` |
| 참여한 크루 | 언제나 | `함께하는 크루와 이야기하기` |
| 그 밖 | 활동 끝남 / 모집 마감 / 정원 참 | 각각 다른 안내 문구 |
| 그 밖 | 모집 중 | `참여하기` |

**`earlyEndReason` 이 있다고 갈래를 나누지 마세요.** 조기 종료도 결과를 씁니다(규칙 12).
2026-09-08에 여기서 갈래가 갈려서, 배지는 "결과 작성 필요" 인데 누를 것이 없는 화면이
나온 적이 있습니다. `tests/action-cta.test.ts` 가 이 표를 그대로 지키고 있습니다.

**DRAFT 도 빠져 있었습니다** (2026-09-11). 호스트 갈래로 떨어져서
「함께하는 크루와 이야기하기」 가 나왔는데, DRAFT 는 크루가 있을 수 없으니
누르면 **빈 게시판**이 열렸습니다. 게다가 그 화면 안내가
「완료된 액션이라 새 글을 쓸 수 없어요」 였습니다 — 위에는 「작성 중」 이라고 적혀 있는데요.

**안내 문구는 그 뒤에 고쳐졌습니다** (2026-09-22 확인). `app/action/[id]/chat/page.tsx` 가
DRAFT · CANCELLED · 그 밖을 각각 나누고, DRAFT 는 「아직 공개 전이라 크루가 없어요.」 입니다.
**이 문서가 「아직 그대로」 라고 적어둔 채 남아 있었습니다** — 고쳤습니다.

**16. 액션 카드 안에 「눌리거나 스와이프되는 것」 을 넣을 때는 `pointer-events-auto` 가 필요합니다** (2026-09-22).

`components/ui/ActionCard.tsx` 는 카드 전체를 덮는 투명 링크(`absolute inset-0 z-0`) 위에
본문을 얹고, 본문 래퍼에 **`pointer-events-none`** 을 걸어 클릭이 그 링크로 통과하게 만듭니다.
그래서 카드 안의 무언가가 이벤트를 받아야 하면 **그 자리에서 `pointer-events-auto` 로 되돌려야** 합니다.

```tsx
// ❌ 조용히 죽습니다 — 에러도 경고도 없습니다
<div className="relative -mx-5 h-[245px]">
  <ActionGallery … />
</div>

// ✅ 탭도 살리려면 Link, 버튼이면 pointer-events-auto
<Link href={`/action/${action.id}`} className="pointer-events-auto relative -mx-5 block h-[245px]">
  <ActionGallery … />
</Link>
```

실제로 이걸로 한 번 막혔습니다. 카드 썸네일을 `ActionGallery` 로 바꿨는데
**홈 카드 30개의 가로 스크롤이 전부 0px** 였고, 그중 **24개는 사진이 2장 이상이라
넘어가지도 않는 점을 그리고 있었습니다.** 터치는 덮개 링크로 빠져 액션 상세로 이동했습니다.
타입 검사·lint·테스트·빌드 전부 통과했습니다 — **화면을 눌러봐야 나옵니다.**

거꾸로 `pointer-events-auto` **만** 붙이면 그 자리의 탭이 죽습니다(덮개 링크에 안 닿음).
사진칸처럼 **탭도 살려야 하는 자리는 `Link` 로 감싸세요** — 가로 드래그는 안쪽
스크롤러가 먹고 탭은 `Link` 가 받습니다.

액션 상세의 `ActionGallery` 는 이 래퍼 밖이라 원래부터 잘 됩니다. **같은 컴포넌트가
카드에서만 안 되는 것**이라 상세에서 눌러보고 「되네」 하면 놓칩니다.

**17. 날짜·시각은 `lib/utils/date.ts` 만 쓰세요 — 직접 `getHours()` 를 부르면 배포에서 틀어집니다** (2026-09-24).

저장소 어디에도 TZ 설정이 없어서 **배포 서버는 UTC 로 돕니다.** 우리 PC 는 KST 라
`getMonth()`·`getHours()`·`getDay()` 를 쓴 코드가 **로컬에서는 맞고 배포에서만 틀립니다.**

```
토요일 10:00–17:00 활동  →  로컬(KST)  9월 26일 (토) 10:00–17:00
                         →  배포(UTC)  9월 26일 (토) 01:00–08:00
```

`date.ts` 는 이제 **KST 고정**입니다 (한국은 1988년 이후 일광절약시간이 없어 +9 고정이 정확).
`tests/date-kst.test.ts` 가 `TZ=UTC`·`TZ=Asia/Seoul` 양쪽에서 같은 값이 나오는지 지킵니다.

| | |
|---|---|
| **표시가 필요하면** | `formatDate` · `formatDateShort` · `formatTime` · `formatActivityPeriod` 를 쓰세요 |
| **주말 판정이 필요하면** | `isWeekend` 를 쓰세요. 직접 `getDay()` 를 부르면 **토요일 오전이 평일로 뒤집힙니다** |
| **남은 시간은 그대로** | `timeUntilDeadline` · `deadlineDDay` 는 두 시각의 **차이**라 시간대와 무관합니다. KST 변환을 넣지 마세요 |

최지수님이 찾았습니다. **서버 컴포넌트에서만 나고 클라이언트 컴포넌트는 브라우저 시간으로
그려서 정상**이라, 같은 날짜가 화면마다 다르게 보였습니다.
`lib/utils/scoring.ts` 의 시간대(오전·오후·저녁·밤) 판정도 2026-09-28에 KST 로 고쳐졌습니다 (지수님 PR1).
배포에서 「주말 오전」 만 되는 사람에게 **시간 점수(당시 15점)가 통째로 안 붙고** 있었습니다.
`tests/date-kst.test.ts` 가 `scoring.ts` 소스에도 `getHours()` 류가 다시 들어오는지 검사합니다.

트렌드의 주 라벨(`lib/queries/stats.ts` 의 `weekLabel`)도 2026-09-29에 `toKst()` 로 고쳐졌습니다 (성은님).
테스트는 아직 `date.ts` 와 `scoring.ts` 만 검사합니다.

> **새 날짜 함수를 넣을 때도 `getHours()` 류를 직접 쓰지 마세요.** `date.ts` 안의
> `toKst()` 로 옮긴 뒤 `getUTC*` 로 읽습니다. 테스트가 이 규칙을 소스에서 검사합니다.


**18. 사람 얼굴을 그릴 때는 고른 아바타를 같이 넘기세요** (2026-09-29).

```tsx
// ❌ 닉네임만 넘기면 그 사람이 고른 것과 다른 얼굴이 나옵니다
<Avatar name={user.nickname} />

// ✅ 조회 함수(lib/queries)가 주는 avatar 를 같이
<Avatar name={user.nickname} avatar={user.avatar} />
```

가입할 때 8종 중 하나를 고르고(`profiles.avatar`) 바꿀 수 없습니다. 사람 정보를 주는 조회 함수
(작성자 · 호스트 · 크루 · 팔로워 · 프로필)는 모두 `avatar` 를 같이 줍니다. 새로 조회를 짤 때도
`nickname` 옆에 `avatar` 를 같이 고르세요. 목록은 `lib/constants` 의 `AVATAR_KEYS` 와 `supabase/20` 두 곳이고
`tests/avatar.test.ts` 가 같은지 대조하고, **화면의 모든 `<Avatar>` 가 `avatar=` 를 넘기는지도 검사합니다** — 빠뜨리면 테스트가 깨집니다.

---

## 자주 쓰는 명령

```bash
npm run verify:db
```

스키마를 바꾼 뒤 돌리세요. 권한·정원·성별·생애주기·나가기·조기 종료·카테고리·공개 통계를 **실제 계정으로** 확인합니다
(검사 호출이 113곳. 일부가 반복문 안이라 실행 수는 그보다 많습니다 — **숫자를 문서에 박지 마세요, 계속 늘어납니다**). 로컬 전용이고, 테스트 계정을 만들었다가 끝나면 지웁니다.

```bash
npm run seed
```

시연용 액션 **101개**를 채웁니다. **여러 번 돌려도 안전합니다** — 기존 시드를 지우고 새로 넣습니다. `npm run seed:clean` 으로 지울 수 있고, 시드 계정(`@good.seed`)만 골라 지우므로 실제 사용자 데이터는 건드리지 않습니다.

**2026-09-11에 41개 판을 101개로 교체했습니다** (성은님). 앞 41개는 제목과 목록 순서를 그대로 두었기 때문에 **그때 만들어진 액션 주소가 살아 있습니다.** 액션 하나만 제목이 바뀌었습니다 — 「[모집미달 테스트] 동네 플로깅 모집」 → 「동네 플로깅 모집」. 제목에 "테스트" 가 박힌 카드가 홈 피드 맨 위에 뜨고 있었습니다.

계정은 **25개**입니다 — `seed1@good.seed` ~ `seed24@good.seed` 와 `demo@good.seed`. 비밀번호는 모두 `good1234!`.
2026-09-21에 8명에서 24명으로 늘렸습니다 — 연탄 나눔(15명)처럼 인원이 많은 액션과 성별 제한 항목을 태우려면 8명으로는 모자랐습니다. `demo` 는 관심 카테고리·지역·시간대가 전부 채워져 있어 Discover 추천과 호스트·크루 시나리오를 한 계정으로 보여줄 때 씁니다.
2026-09-28부터 `demo` 에 **재능(`교육·멘토링`)도 들어 있습니다.** 24명도 관심 분야가 사람마다 다르게 바뀌고, 재능이 새로 붙었습니다(성은님).

**AI 분류(`action_ai_metadata`)는 시드가 `scripts/data/action_ai_metadata_all.json` 에서 제목으로 찾아 넣습니다.**
그 JSON 에 없는 제목(새로 끝에 붙인 액션)은 기본값(`실내 활동` · `누구나 참여가능`)으로 들어가서
Discover 의 환경·난이도 점수가 틀어집니다. 그럴 때는 다시 분류합니다 (민호 담당, 2026-09-29에 고침).

```bash
npm run reclassify                    # 미리보기 — 무엇을 분류할지 목록만 (AI·DB 쓰기 없음)
npm run reclassify -- --apply         # 아직 제대로 분류 안 된 것만 분류해서 저장
npm run reclassify -- --export-seed   # 시드용 JSON 을 새로 씀 — 시드 액션 중 제대로 분류된 것만
npm run reclassify:active             # 모집 중 액션을 지금 판으로 — 미리보기. 저장은 -- --apply
```

두 명령은 **대상이 다릅니다.**

| 명령 | 대상 | 이미 분류된 액션 |
|---|---|---|
| `reclassify` | 색인 없음 · 시드 기본값 · 공개 때 AI 실패 기본값 | **건너뜁니다** |
| `reclassify:active` | 모집 중 액션 중 판이 지금 판(`classify-v4`)이 아닌 것 | **덮어씁니다** — 시연 전 추천이 바뀔 수 있습니다. 2026-09-30 에 모집 중 51개를 v4 로 돌려서 지금은 0개입니다 |

`--export-seed` 는 새 내용이 비었거나 기존 파일보다 10% 넘게 줄면 쓰지 않습니다(`--force` 로만). `seed:clean` 뒤에 돌려 빈 파일이 되는 사고를 막습니다.
전에는 「`classify-v2` 가 아닌 것」 을 골라서 앱에서 분류한 v3 를 덮어쓰고, 정작 시드 기본값은 건너뛰었습니다.
서비스 롤 키로 공유 DB 에 바로 쓰니 **먼저 미리보기로 목록을 보세요.** 결과는 `ai_runs` 에도 남습니다.
한 가지 남은 것 — `scripts/seed.mjs` 는 JSON 의 판 이름을 읽지 않고 늘 `classify-v3` 로 넣습니다(조장 구역).
그래서 `seed` 를 다시 돌리면 내용은 v4 인데 이름표가 v3 가 되어, `reclassify:active` 미리보기에 모집 중 전부가 다시 잡힙니다 — 분류가 틀린 게 아니니 급하지 않습니다.

**2026-09-30 에 모집 중 51개를 v4 로 다시 분류하고 시드 JSON 도 새로 썼습니다** (민호, 성은님 요청).
모임 규모 라벨이 실제 인원과 다른 것이 모집 중 23개 → 14개로 줄었습니다. **AI 가 인원 합산을 늘 지키지는 못합니다** —
그래서 추천 점수는 라벨 대신 모집 항목의 실제 인원(`totalGroupSize`)을 봅니다(성은님 9/30). 라벨은 사람 모집 항목이 없을 때만 대신 씁니다.
「누구나 참여가능」 인데 재능이 2개 이상인 것은 틀린 게 아니라 v4 규칙(전문·일반 역할이 섞이면 난이도는 가장 낮은 쪽)대로입니다.

액션 101개에는 화면을 하나씩 확인할 수 있는 상태가 골고루 들어 있습니다.

| 무엇 | 몇 개 | 어디서 확인 |
|---|---|---|
| ACTIVE | 55 (**홈 피드에는 더 적습니다** — 아래 참고) | 홈 · Discover |
| COMPLETED | 26 (결과 + 호스트 한마디 + 소감) | 결과 보기 |
| ENDED | 10 (그중 **3개**만 조기 종료 사유 있음 — 키는 6곳인데 3곳이 `null`) | 결과 작성 필요 |
| CANCELLED | 6 (취소 사유 있음) | Activity 취소됨 탭 |
| DRAFT | 4 (작성 진행도 1~4단계) | Activity 작성중 탭 |
| 진행중 · lazy 동기화 | 3 · 2 | 상태 전환 확인 |
| 연일 활동 | 3 (항목 이름이 "1일차/2일차") | 항목별 크루 보기 |

**홈 피드 숫자를 문서에 박지 마세요 — 계속 움직입니다.** `getActionFeed` 가
`status = ACTIVE` **에 더해** `activity_end_at > now` 와 `recruit_end_at > now` 까지 걸러서,
날짜가 지나면 같은 시드에서도 줄어듭니다. 2026-09-22 실측으로 **ACTIVE 52개 중 44개**였습니다
(시드 55개 중 3개는 lazy 동기화로 이미 ENDED 가 된 상태). 세어 봐야 하면 그때 재세요.

**시드로 만든 액션·계정의 주소는 매번 같습니다** (2026-09-04). 전에는 `seed` 를 다시 돌리면 같은 액션인데 번호가 바뀌어서, 화면을 열어둔 채 돌리면 그 링크가 죽었습니다("페이지를 찾을 수 없습니다"). 지금은 제목에서 번호를 계산하므로 **열어둔 탭도 그대로 살아 있습니다.** 북마크·발표 대본에 링크를 적어둬도 됩니다.

단, `scripts/seed.mjs` 의 `ACTIONS` **목록 순서를 바꾸면 그 뒤 액션들의 번호가 전부 바뀝니다.** 추가할 때는 목록 끝에 붙이세요. 제목만 바꾸면 그 액션 하나의 주소만 바뀝니다.

시드 계정으로 로그인한 상태에서 `seed` 를 다시 돌리면 **로그인만 풀립니다.** 계정을 지웠다 다시 만들기 때문이고, 버그가 아닙니다. 다시 로그인하면 됩니다 — 링크는 그대로 살아 있습니다.

---

## 디자인 값은 디자인 가이드가 원본입니다

색·타이포·간격·굵기·모서리 같은 값은 **소정님이 관리하는 디자인 가이드**에 있습니다.
링크만 있으면 열립니다.

> **착착 디자인 가이드** — https://claude.ai/artifact/P6DCcoQW5AEhvV5Q2qxc2s

Day 5(Foundations, 2026-09-15) ~ Day 10(2026-09-19) 에 확정된 것이 전부 여기 있습니다.

| 무엇 | 가이드에 있는 것 |
|---|---|
| 색 | 포인트 `#00A56E` · 기능색 5종(위험·주의·완료·진행중·중립) · 회색 5단계(Surface 2 · Text 2 · Hairline) |
| 타이포 | 6단계 — 24 · 20 · 17 · 15 · 13 · 11px (서체·굵기·쓰는 곳까지) |
| 간격 | 8단계 — 4 · 8 · 12 · 16 · 20 · 24 · 32px + 안전영역 예외 |
| 모서리 | **pill 999px 아니면 12px. 두 값만** |
| 그림자 | **안 씀(플랫).** 모달은 그림자 대신 딤 처리 |
| 컴포넌트 | 버튼 · 인풋 · 카드 · 카테고리 칩 · 모달 공통 규격 |
| 상태 스티커 | 표정 아이콘 3톤 · 9개 상태 배정 · 원 40px · 카드 우상단 |
| 로고 | 최소 크기 · 여백 · 컬러 선택 기준 (**제안, 확정 전**) |

**디자인 값을 소정님께 묻기 전에 여기를 먼저 보세요.** 가이드에 있는 값이면 물을 것이 아니라
**코드가 가이드를 따르는지 대조하는 것**이 할 일입니다.

2026-09-22에 실제로 이걸로 헛걸음했습니다 — 「주버튼이 검정에서 초록으로 바뀌는데
의도한 범위인가」 를 소정님께 확인 요청했는데, 가이드 Day 9 에 **실사용 28곳 조사와 함께**
「검정 → 포인트 그린. 새 규칙 아님 — 토큰 표에 이미 CTA 버튼으로 적혀 있었는데
코드가 안 따르고 있었음」 이라고 적혀 있었습니다.

> **가이드가 「제안(확정 전)」 이라고 표시한 항목은 구분해서 읽으세요.**
> 로고 사용 규칙이 그렇습니다 — 헤더 높이 같은 기존 확정값에서 역산한 제안값입니다.

---

## 액션 검수는 심사가 아니라 거들기입니다

착착은 착한 일을 **쉽게 시작하게** 만드는 서비스입니다. 검수도 그 편에 섭니다.

| 무엇 | 뜻 | 공개 |
|---|---|---|
| BLOCK | 개인정보·불법·사기·정치 포교·차별. **이 다섯 가지만** | ❌ |
| REVISE | 이대로는 참여자가 움직이기 어렵다 | ⭕ 호스트가 정함 |
| PASS | 문장이 투박해도, 활동이 소박해도 통과 | ⭕ |

**규모가 작다·전문적이지 않다·기관과 연계가 없다는 이유로 막지 않습니다.**
공원에서 쓰레기 한 번 줍는 것도 액션입니다.

코드 검사도 두 갈래입니다 (`app/api/ai/review/route.ts`).

```
blockers   비어 있거나 앞뒤가 안 맞는 것   → AI 를 부르지 않고 BLOCK
warnings   아쉬운 것                      → 알려만 주고 호스트가 판단
```

장소도 같습니다 — `getPlaceErrors()` 는 **비었는지**만 보고,
넓어서 찾아가기 어려운 것은 `getPlaceWarnings()` 가 알려주기만 합니다.
액션 만들기 화면(개발 B)과 검수(민호)가 같은 함수를 씁니다.

AI 는 **날짜와 이미지를 보지 못합니다.** 코드가 따로 확인합니다.
프롬프트에서 그것들을 판단하게 시키면 없는 말을 지어냅니다.

## AI 프롬프트를 고칠 때

**그 라우트 파일 맨 위의 버전 상수를 반드시 올리세요** (`trends-v1` → `trends-v2`).
`lib/openai.ts` 는 버전을 인자로 받아 `ai_runs` 에 적기만 합니다 — 거기를 고치는 게 아닙니다.

| 라우트 | 상수 | 지금 값 (2026-09-30) |
|---|---|---|
| `app/api/ai/review/` | `PROMPT_VERSION` | `review-v7` |
| `app/api/ai/classify/` — 규칙은 `lib/ai/classify-spec.ts` | `CLASSIFY_PROMPT_VERSION` | `classify-v4` |
| `app/api/ai/trends/` | `PROMPT_VERSION` | `trends-v3` |
| `app/api/ai/discover/` | `CHAT_PROMPT_VERSION` · `RECOMMEND_PROMPT_VERSION` | `discover-chat-v12-no-double-ack` · `discover-recommend-v14-category-guard` |

**번호는 올리기만 하세요.** 이름을 바꾸면서 숫자가 내려가면(`v7` → `v3`) 발표 자료에서 어느 쪽이 나중인지 헷갈립니다.
**분류 지시문·답 검사·허용 목록은 `lib/ai/classify-spec.ts` 한 곳입니다.** 공개 때 분류(라우트)와
재분류 스크립트(`scripts/classify-core.mjs`)가 같이 import 합니다 — 거기만 고치고 판을 올리세요.
`tests/classify-sync.test.ts` 가 두 곳이 자기 지시문을 따로 들기 시작하면 잡습니다. 스크립트 기록도 같은 판 이름으로 `ai_runs` 에 남습니다(사용자 없이).

`ai_runs` 테이블에 버전별 성공/실패가 쌓입니다. 발표의 "검증·개선" 항목은 여기서 뽑습니다 — 처음 프롬프트가 틀린 답을 낸 사례와, 고친 뒤 정확해진 사례를 나란히 보여줄 수 있습니다. **초기 버전 로그를 지우지 마세요.**

실제로 이렇게 잡은 게 두 건 있습니다.

- `discover-reason-v1` — 프롬프트에 "json" 이라는 낱말이 없어 OpenAI 가 400 을 돌려줬습니다. 화면에는 기본 문구가 나와서 겉보기엔 멀쩡했습니다.
- `trends-v1` → `v2` — 필드 이름이 모호해 AI 가 서로 다른 항목을 섞어 없는 비율을 만들어냈습니다.

---

## 데이터 다루는 법 (가장 중요)

> **읽기는 `lib/queries/`, 쓰기는 `lib/mutations.ts`.**
> 화면에서 `supabase.from(...)` 이나 `supabase.rpc(...)` 를 직접 쓰지 마세요.

> **지금 이 규칙을 어기는 화면이 10개 있습니다** (2026-09-22 실측 —
> `app/action/[id]/` 아래 8개 · `app/action/create/` · `app/activity/`).
> 새로 만드는 화면에서 따라 하지 마세요. 손댈 일이 생기면 `lib/queries/` 로 옮겨주세요.

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
| `getPublicParticipationCounts` / `getPublicParticipatedActionIds` | 남에게도 보이는 참여 통계 |
| `getNotifications` / `getUnreadCount` | 알림 · 안 읽은 수 |

### 쓰기 — 전부 `lib/mutations.ts`

**`isNicknameTaken` 하나만 빼고** 모든 함수가 `{ ok, data }` 또는 `{ ok: false, message }` 를
돌려줍니다. 그 하나는 `Promise<boolean>` 이라 `res.ok` 가 없습니다 — `if (!res.ok)` 로 받으면
**항상 통과합니다.**
`message`는 **그대로 사용자에게 보여주면 되는 한국어**라 `try/catch`가 필요 없습니다.

```ts
const res = await joinAction(supabase, actionId, items);
if (!res.ok) { setError(res.message); return; }
```

`joinAction` · `leaveActionWithReason` · `submitCrewVoice` ·
`postChatMessage` · `deleteChatMessage` ·
`saveActionDraft` · `updateActionText` · `saveActionItems` · **`addActionItems`** · `saveActionResult` · `publishAction` · `completeAction` · `cancelAction` · **`endActionEarly`** · `deleteDraft` ·
`updateProfile` · `isNicknameTaken` · `updateNotifySettings` ·
`toggleLike` · `toggleSave` · `toggleFollow` · `shareToUser` · `markNotificationRead`

**나가기는 `leaveActionWithReason` 하나뿐입니다.** 사유 없이 나가는 `leaveAction` 은
2026-09-11에 뺐습니다 — 그 함수는 `participations` 를 `LEFT` 로 바꾸기만 해서
크루챗에 사유도 안 남고 **호스트에게 알림도 가지 않았습니다.** 호스트는 크루가 빠진 것을
모른 채 모집 현황만 줄어드는 것을 보게 됩니다. DB 의 `leave_action` RPC 는
시간 검사 테스트(`verify:db`)가 쓰고 있어 남겨 뒀습니다.

**쓰고 나서 곧바로 다른 화면으로 이동한다면 `router.refresh()` 를 `push` 뒤에 두세요**
(2026-09-14). 순서가 중요합니다.

```ts
// ❌ 뒤로 왔을 때 바뀐 것이 안 보입니다
router.refresh();
router.push(href);

// ✅
router.push(href);
router.refresh();
```

알림 목록에서 이것 때문에 버그가 있었습니다. 알림을 누르면 DB 는 읽음으로 바뀌는데
**뒤로 오면 안 읽은 모습(노란 배경·빨간 점)이 그대로 보였습니다.** 새로고침하면 그때 바뀝니다.
서버에서 그린 화면이 클라이언트 라우터 캐시에 남아 있어서, 이동만 하면 캐시가 다시 그려집니다.

`refresh` 를 `push` **앞에** 두면 안 됩니다 — 이동이 무효화를 중단시킵니다.
실측: 즉시 push 하면 안 고쳐지고, 600ms 두면 고쳐졌습니다.

`refresh` 는 라우터 캐시를 **전부** 버리므로, 알림 목록만이 아니라
**홈 화면 안 읽음 배지(`app/page.tsx`)까지 같이 살아납니다.** 두 곳을 따로 고칠 필요가 없습니다.

> **주의 — `revalidatePath` 를 쓰는 서버 액션으로 해결하려 하지 마세요.** 한 번 그렇게 만들어
> 배포까지 해봤는데, 그 응답이 **해당 페이지를 다시 그리는 것까지 기다립니다.** `/notifications`
> 는 열 때마다 lazy 알림 두 종을 만들어서 배포 환경에서 2.8~6.1초 걸리는 화면입니다.
> 그 비용이 이동 앞에 붙어 **누르고 4~9초 뒤에 이동**했습니다. `push` 뒤의 `refresh` 는
> 같은 일을 이동 뒤로 미룹니다.

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

**화면 표시 규칙 세 개:**

1. **MINIMUM에는 퍼센트를 쓰지 않습니다.** 15/10 = 150%는 사용자에게 의미가 없습니다.
2. **RANGE의 분모는 끝까지 고정입니다.** `2 / 3~5명` → (3명 도달) → `3 / 3~5명`
   정확히 N명일 때만 `2 / 3명` 처럼 한 숫자로 씁니다.
3. **MINIMUM 도 「현재 / 목표」 입니다.** `35개 / 30개` — 목표를 넘겨도 분모는 목표 그대로.
   9/22 소정님 개편으로 화면이 먼저 바뀌었고 2026-09-29 에 유지로 정했습니다.
   그 전 결정(9/17 「N개 모였어요」)은 어디에도 안 나와서 `quota.ts` 도 맞췄습니다.

> 2026-09-01에 바꿨습니다. 전에는 최소를 넘기면 분모가 `3` → `5` 로 바뀌었는데,
> **숫자가 갑자기 변해서 헷갈린다**는 지적을 받았습니다.
> `lib/utils/quota.ts` 의 주석과 `docs/사용설명서.md` 에 같은 내용이 적혀 있습니다.
> 2026-09-17까지 이 문서만 옛 규칙이 적혀 있었습니다 — 고쳤습니다.

숫자를 직접 조합하지 말고 반드시 `lib/utils/quota.ts`의 함수를 쓰세요.

```ts
import { getQuotaState, describeTarget } from '@/lib/utils/quota';
```

---

## 결정 사항 (2026-08-31 확정)

| 항목 | 결정 |
|---|---|
| 프로필 사진 | **업로드 없음.** 가입 2단계에서 **아바타 8종 중 하나를 꼭 고르고, 바꿀 수 없습니다**(서버에서도 막음, `supabase/20`). 이미 가입한 사람은 8종 중 골고루 배정했습니다. 그림은 `public/avatars/avatar_01~08.svg` — 2026-09-29 조장님 요청 · 팀 결정 (그 전: 9/28 닉네임으로 정하는 표정 10종) |
| 액션 대표 이미지 | 최대 3장 + 대표 지정 |
| 결과 사진 | **공개할 때** 최소 1장, 최대 5장 (필수). **임시저장은 0장도 됨** — 2026-09-11 |
| 물품 단위 | 자유 입력. 수량도 직접 타이핑 가능 |
| 날짜 | 모집 마감 / 활동 시작 / 활동 종료 **3개 별개 값** |
| 성별 | 가입 시 필수. **항목별로** 남/여/무관 제한 가능 |
| 참여 나가기 | 허용. status를 `LEFT`로, 행은 남김. 집계에서 제외 |
| 나가기·취소 버튼 색 | **빨강을 쓰지 않습니다.** 다른 버튼과 같은 노멀 버튼 — 빨강이면 나가기를 부추기는 화면이 됩니다. 2026-09-08 |
| 취소 · 조기 종료 | **활동 시작 전 = 취소(CANCELLED, 안 셈) · 활동 중 = 조기 종료(ENDED, 셈)**. 2026-09-04 |
| DRAFT 삭제 | 행을 실제로 삭제 |
| 크루챗 삭제 | 본인 글만 soft delete. **원글을 지우면 댓글도 함께 삭제** |
| 알림 | **9종**. 팔로우 알림 없음 (처음 6종 + 크루 나감 · 모집 미달 · 조기 종료) |
| AI 검수 | PASS / REVISE / BLOCK 3단계. **호스트가 공개 버튼을 눌러야 ACTIVE** |
| 검수가 막는 범위 | **BLOCK 만 공개를 막습니다.** REVISE 는 "이대로는 참여자가 움직이기 어렵다"는 알림이라, 보고 나서 공개할지는 호스트가 정합니다. 2026-09-09 |
| 취소·종료 액션의 반응 | 좋아요·저장·공유를 **새로 누르는 것만** 막습니다. **이미 누른 것은 풀 수 있습니다** — 안 그러면 저장해 둔 액션이 끝나는 순간 목록에서 뺄 방법이 없어집니다. 2026-09-10 |
| 타인 프로필 | 통계 유지 + 참여 목록은 완료된 것만 + 닉네임 주 표기 |
| Discover 거리 | km 계산 안 함. 시·군·구 단위 매칭까지만 |
| Discover 추천 기준 · 대화 길이 | **성은님 현재 구현이 기준**입니다 — 코드가 원본(`lib/utils/scoring.ts` · `discover-ranking.ts` · `app/api/ai/discover/`). 9/1 「최대 3번 주고받고 추천」 · 9/3 「최소 범위 · 배점 110」 은 이 결정으로 대체. 2026-09-29 조장 결정 |

---

## 폴더 담당 (충돌 방지)

브랜치 충돌은 여러 명이 같은 파일을 건드릴 때 납니다. 아래를 지키면 거의 안 납니다.

| 담당 | 구역 |
|---|---|
| 민호 (통합) | `lib/` · `supabase/` · `middleware.ts` · `scripts/verify-db.mjs` · **`scripts/reclassify_all_actions.mjs`** · **`scripts/batch_reclassify_active.mjs`** · **`scripts/classify-core.mjs`** · `app/notifications/` · `app/action/[id]/share/` · `app/api/ai/review/` · `app/api/ai/classify/` · **`docs/`** · **루트 설정 파일**(`package.json` · `package-lock.json` · `tsconfig.json` · `next.config.ts` · `.eslintrc.json` · `.gitignore` · `.claude/launch.json` · **`vercel.json`** · `README.md` · `CLAUDE.md`) |
| 조장 | `app/activity/` · `app/trends/` · `components/trends/` · `app/api/ai/trends/` · `scripts/seed.mjs` · **`scripts/data/`** · **`scripts/check_seed_meta.mjs`** · `lib/queries/stats.ts` · **`app/discover/`** · **`app/api/ai/discover/`** · **`lib/utils/scoring.ts`** · **`lib/utils/discover-ranking.ts`** |
| 디자이너 | `components/ui/` · `components/layout/` · `app/page.tsx` · `app/layout.tsx` · **`app/not-found.tsx`** · **`app/error.tsx`** · **`app/global-error.tsx`** · **`app/icon.svg`** · `app/globals.css` · `app/action/[id]/page.tsx` · `tailwind.config.ts` · **`postcss.config.mjs`** |
| 개발 A | `app/(auth)/` · `app/my/` · `app/user/` · **`components/my/`** · **`app/api/auth/check-email/`** · `lib/constants/regions.ts` |
| 개발 B | `app/action/create/` · `app/action/[id]/` 하위 (join · welcome · crew · chat · **edit** · result · voice) |
| 공유 | `tests/` — **누구나 추가**할 수 있습니다. 남의 담당 로직 테스트를 **고칠** 때는 그 담당에게 말하세요 |

**액션 찾기(Discover)는 2026-09-29부터 조장 담당입니다.** 9/23 부터 성은님이 개편을 맡았고,
9/29 지수님이 「제 작업 범위에서 빼겠다」 고 해서 옮겼습니다.
`lib/constants/regions.ts` 는 가입·프로필 지역 선택(`RegionPicker`)도 같이 써서 **개발 A 에 남깁니다** — Discover 쪽에서 고쳐야 하면 지수님께 말해주세요.
액션 자동 분류(`app/api/ai/classify/`)는 **민호 담당으로 정했습니다** (9/29). 한꺼번에 다시 분류하는 스크립트(`scripts/reclassify_all_actions.mjs` · `batch_reclassify_active.mjs`)도 **민호가 맡습니다** — 공개 때 분류와 같은 AI 지시문을 따로 들고 있어서 한 사람이 같이 고쳐야 합니다. 시드용 결과 파일(`scripts/data/`)과 `check_seed_meta.mjs` 는 시드와 한 몸이라 조장 그대로입니다.

`components/action/` 은 **파일 단위로 담당**이 있습니다.

| 파일 | 담당 |
|---|---|
| ActionForm · ItemEditor · JoinForm · ChatBoard · ResultWriteForm · VoiceForm · **LeaveButton** · **AddressSearch** · **ActionHostActions** · **ActionTextEditForm** · **AddActionItemsForm** · **CrewVoiceList** · **ReasonModal** · **DateTimePickerModal** | 개발 B |
| ActivityButtons | 조장 |
| DiscoverChat | **조장** (2026-09-29) |
| SharePanel | **공유** — 공유 화면(민호)과 `ShareModal`(디자이너)이 같이 씁니다. 고치기 전에 말하기 |
| ActionGallery · AddressBox · **ActionCrewSection** · **ShareModal** | 디자이너 |
| QuotaProgress | 디자이너 — 2026-09-25 부터 **액션 상세에서만** 씁니다(참여 화면은 안 씀). 2026-09-29 에 「공유」 에서 바꿈 |

`AddressSearch` 와 `ActionHostActions` 는 이 표에 없어서 담당이 비어 있었습니다 (2026-09-14에 채웠습니다).
쓰이는 곳으로 갈랐습니다 — `AddressSearch` 는 `ActionForm` 에서만, `ActionHostActions` 는
액션 상세에서만 씁니다. `ActionHostActions` 는 호출하는 화면이 디자이너 구역이지만
**내용이 취소·조기 종료 모달**이라 개발 B 로 두었습니다 (형제 파일 `LeaveButton` 과 같은 성격).

그때 **같은 폴더의 6개가 또 비어 있었습니다** (2026-09-17에 채웠습니다).
9/14에는 눈에 띈 둘만 채웠는데, 이번에는 `components/action/` **21개를 전수로 세어** 표의 15개와
대조했습니다. 빠진 6개 중 5개는 9/14보다 **먼저 있던 파일**입니다 — 표를 눈으로만 훑으면 또 빕니다.

| 파일 | 쓰는 곳 | 담당 | 왜 |
|---|---|---|---|
| ActionTextEditForm · AddActionItemsForm | `app/action/[id]/edit/` | 개발 B | 공개 뒤 본문 수정·항목 추가 폼. 규칙 10 이 걸립니다 |
| CrewVoiceList | `app/action/[id]/result/` | 개발 B | 소감 접기·펼치기 목록 |
| ActionCrewSection | `app/action/[id]/page.tsx` | 디자이너 | 상세 화면의 **요약 카드**입니다 — 아바타 + 「N명 참여 중」 + 전체보기. 실제 크루 목록은 `/crew`(개발 B)가 그리고 이 파일은 거기로 보내기만 합니다 |
| ShareModal | `components/ui/ToggleButtons.tsx` | 디자이너 | **공유 로직이 한 줄도 없습니다** — portal · Esc 닫기 · 스크롤 잠금 · 제목뿐인 모달 껍데기이고, 친구 전송·링크 복사는 전부 `SharePanel` 이 합니다 |

`ActionCrewSection` 과 `ShareModal` 은 `ActionHostActions` 와 같은 자리에 있지만 **뒤집지 않았습니다.**
`ActionHostActions` 를 개발 B 로 옮긴 이유는 내용이 규칙 12(취소·조기 종료)의 **상태 전이**였기 때문입니다.
이 둘은 내용도 화면 UI 라 호출하는 쪽과 방향이 같습니다.

> **`ShareModal` 을 디자이너로 두면서 `SharePanel` 이 「공유」가 됐습니다.** 공유 화면(민호)과
> `ShareModal`(디자이너) 두 곳에서 쓰이기 때문입니다.
> `ShareModal` 은 모달 제목 17px · 액션 제목 15px 을 들고 있어 **8쪽 타이포 전담 PR 의 대상**입니다.
> 민호에게 주면 그 PR 이 담당 경계를 넘게 됩니다.

`ReasonModal` 은 2026-09-17에 새로 만들어진 파일입니다 (개발 B). 취소·조기 종료·나가기·
삭제 확인을 한 모달로 모은 것이라 내용이 `ActionHostActions`·`LeaveButton` 과 같은 성격입니다.
다만 **담당이 다른 사용처가 둘 더 있습니다** — `components/ui/LogoutButton.tsx`(디자이너) 와
`components/action/ActivityButtons.tsx`(조장). 고치기 전에 말해주세요.

> **새 파일을 만들면 이 표에 한 줄을 같이 넣으세요.** 9/14 에 둘, 9/17 에 여섯을 뒤늦게 채웠고
> `ReasonModal` 도 만든 날 표에 안 들어가 2026-09-21에 채웠습니다. 표는 훑어서는 안 메워집니다 —
> `ls components/action` 으로 세어 대조해야 빈 줄이 드러납니다.
> `DateTimePickerModal`(2026-09-23, 소정님)도 **병합한 9/24 에 민호가 안 넣어서** 9/27 에 채웠습니다.
> `ActionForm` 에서만 쓰는 입력 부품이라 `AddressSearch` 와 같은 이유로 개발 B 입니다.

**`MessageAccessButton` 은 지웠습니다** (2026-09-17). 저장소 전체에서 `import` 가 **0건**이었습니다.
F29(「메시지 보기」 안내)로 만들었는데, 상세 화면 하단이 `getActionCta()` 로 바뀌면서(규칙 15)
호출이 끊겼습니다. 같은 문구는 지금 `getActionCta()` 가 냅니다.
`app/action/[id]/page.tsx` 에 남아 있던 쓰이지 않는 지역변수 두 개
(`canViewChat` · `showMessageAccessButton`)도 같이 지웠습니다.

폴더 쪽도 세 군데가 비어 있었습니다.

| 경로 | 담당 | 왜 |
|---|---|---|
| `components/my/` | 개발 A | 4개 파일을 `app/my/` · `app/user/` 에서만 씁니다. **2026-09-17 전까지** 문서 어디에도 한 번도 없었습니다 |
| `app/action/[id]/edit/` | 개발 B | 실재하는데 위 괄호 목록에서 빠져 있었습니다. 위 두 폼이 이 화면 부품입니다 |
| `app/api/auth/check-email/` | 개발 A | 가입 이메일 중복 확인. `app/api/auth/` 가 통째로 비어 있었습니다 |

> **`check-email` 은 서비스 롤 키(`createAdminClient()`)를 쓰고 자체 레이트리밋을 돌리며
> 「계정 존재 여부를 오류로 흘리지 않는다」 판단이 들어 있습니다.** 기능 주인이 가입 화면이라
> 개발 A 로 두었지만, **그 세 가지를 건드릴 때는 민호에게 말해주세요** (보안 규칙이 걸립니다).
> 이 라우트가 쓰는 `lib/auth/email-availability.ts` 도 민호 구역입니다 (`tests/signup-followup.test.ts` 가 같이 씁니다).

### 여러 구역에 걸친 변경은 한 사람이 전부 맡습니다 (2026-09-14)

> **스타일·문구·제목을 통일하는 일은 폴더로 나눠지지 않습니다.**
> 한 사람이 전부 맡고, 그동안 그 파일은 아무도 건드리지 않습니다. **한 PR 로 올립니다.**

폴더 담당은 「각자 자기 화면을 만든다」에는 잘 맞지만, **위치가 아니라 패턴을 따라가는 변경**에는
맞지 않습니다. 실제로 두 번 겪었습니다.

| 요청 | 걸친 범위 |
|---|---|
| 화면 제목 한글로 통일 | 4명 · 7파일 |
| 버튼 높이 고정 해제 (글자 200%) | 5명 · 21파일 |

번지는 이유는 **공통 컴포넌트를 거치지 않는 것**입니다. `Button.tsx` 를 쓰는 파일은 **15개**인데
`<button>` 을 직접 쓴 파일이 **27개**입니다 (2026-09-28 실측 · 9/22 에는 16 · 26 — 세는 기준은
`grep -rl "<button" app/ components/` 에서 `Button.tsx` 자신을 뺀 것).
새 화면을 만들 때는 **`components/ui/` 의 것을 먼저 찾아 쓰세요.** 없으면 만들자고 말해주세요 —
그 한 번이 다음 통일 작업의 21파일을 1파일로 줄입니다.

**입력칸 공통 컴포넌트가 생겼습니다** — `components/ui/Input.tsx` (2026-09-22, 소정님).
전에는 이것이 없어서 같은 `min-h-11 rounded-xl border border-neutral-300 px-4 py-3 text-[15px]`
이 16개 파일에 복사돼 있었습니다. 지금 6개 파일이 `Input` 을 씁니다(2026-09-30 — 모집 항목 입력칸 `ItemEditor` 가 옮겨 와 하나 늘었습니다). 손으로 적은 곳은 9/22 기준 12개였습니다.
**새로 만드는 입력칸은 손으로 짜지 말고 `Input` 을 쓰세요.** 남은 12개는 손대는 화면이
생길 때 하나씩 옮기면 됩니다 — 그것만으로 다음 타이포·높이 통일 작업이 1파일이 됩니다.
같은 PR 로 `Chip` 에 `size="sm"` 이, `Button` 에 `href`(링크로 렌더) 가 들어왔고
`tailwind.config.ts` 에 `brand` · `danger` · `warning` · `info` 토큰이 생겼습니다.
대괄호로 색을 적던 곳(`bg-[#00A56E]` 등)은 이제 토큰을 쓸 수 있습니다.

절차는 이렇게 합니다.

1. **시작 전에 민호에게 알립니다.** 어떤 파일을 건드릴지 목록으로 주세요.
2. 민호가 공지하고, 그 기간에는 **다른 사람이 그 파일을 건드리지 않습니다.**
3. **파일별로 쪼개 나눠 고치지 마세요.** 세 명이 나누면 같은 패턴이 세 가지로 갈립니다.
4. 한 PR 로 올리면 민호가 점검하고 병합합니다.

**「미리 알려야 하는 것」 을 두 가지로 좁혔습니다** (2026-09-22, 소정님 제안).

화면을 만들다 보면 남의 구역 파일 몇 개를 스치는 일은 계속 생깁니다. 그때마다 공지하면
일이 멈추기만 합니다. 그래서 **디자인·화면 구성 개편처럼 이미 전체 공지가 된 작업이라면,
그 안에서 남의 파일 몇 개가 걸치는 것은 그 공지에 포함된 것으로 봅니다** —
단 **로직·백엔드를 안 건드리는 선까지**입니다.

대신 아래 두 경우는 **시작 전에 민호에게 한 줄 주세요.**

| 언제 | 왜 |
|---|---|
| **`components/ui/` · `components/layout/` · `lib/` 을 건드릴 때** — 화면 하나짜리 작업이든 아니든 | 이 세 곳은 쓰는 쪽이 전부 남의 화면입니다. `Header.tsx` 하나가 23개 화면에 걸칩니다 |
| **앱 전체에 같은 패턴을 한 번에 쓸어담는 작업** | 위 표(제목 통일 · 버튼 높이)의 그 종류입니다. 나눠 고치면 패턴이 갈립니다 |

실제 사례 — `a39a673`(Foundations 반영)은 **16파일**이었고 그중 **8개가 남의 구역**이었습니다
(개발 A 3 · 개발 B 3 · 조장 1 · 공유 1). 로직은 한 줄도 안 건드리고 손으로 짠
`input`·`button` 을 공통 컴포넌트로 바꾼 것이라, **규칙대로 한 사람이 한 PR** 로 올라왔고
충돌도 없었습니다. 다만 `components/ui/` 와 `tailwind.config.ts` 가 들어 있어
**위 첫 번째 조건에는 해당**합니다.

**`components/ui/` · `components/layout/` · `lib/` 은 공유 구역입니다.** 고칠 때는 먼저 말해주세요.
`components/layout/Header.tsx` 는 **23개 화면이 씁니다** (2026-09-29 — 약관·개인정보 화면이 공용 상단 바로 바뀜. 9/28 에는 22) — 다섯 담당 전원의 구역에 걸칩니다.
파일은 디자이너 것이지만, 여기를 고치면 남의 화면 상단 바가 전부 바뀝니다.
(형제 파일 `BottomNav.tsx` 는 `app/layout.tsx` 한 곳에서만 쓰므로 해당 없습니다.)
예외 — 위 표에 적힌 `lib/` 파일 4개(`stats.ts` · `regions.ts` · `scoring.ts` · `discover-ranking.ts`)는 각 담당이 바로 고쳐도 됩니다.
**2026-09-17까지 이 문장은 「4개」 인데 위 표에는 3개만 있었습니다** — `discover-ranking.ts` 가 빠져 있어
문서가 자기 자신과 어긋났습니다. 표에 넣어 맞췄습니다.

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

**`main` 에 올리면 Vercel 이 바로 배포합니다** (https://final-proj-alpha.vercel.app).
화면을 만드는 서버 위치는 `vercel.json` 의 `icn1`(서울)입니다 (2026-09-30). DB 가 서울 근처라서입니다 —
전에는 기본값인 미국 동부(`iad1`)에서 돌아서, 화면 하나에 DB 를 여러 번 묻는 동안 매번 태평양을 건너
**액션 상세가 3~4초** 걸렸습니다. 이 파일을 지우면 그때로 돌아갑니다.

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
