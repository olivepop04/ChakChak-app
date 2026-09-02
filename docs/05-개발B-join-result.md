# 개발 B — 만들기 · 참여 · 게시판 · 결과

> **이 문서 하나만 AI에게 줘도 됩니다.** 필요한 제약이 아래에 다 들어 있습니다.
> 팀 공통 작업 규칙(브랜치·PR)은 [00-공통규칙.md](./00-공통규칙.md)에 있습니다.
>
> **PR 을 만들 때 받는 쪽이 `main` 으로 자동 선택돼 있습니다.
> 반드시 `dev` 로 바꿔주세요.** 그대로 두면 리뷰 없이 배포됩니다.

```bash
git fetch origin
git checkout feature/개발B-join
git merge origin/dev        # ← 이 줄을 빼면 안 됩니다
```

> **`git merge origin/dev` 를 반드시 같이 하세요.**
> 브랜치는 만들어진 시점에 멈춰 있습니다. 그냥 `checkout` 만 하면
> **그 이후에 올라온 작업이 전부 사라진 것처럼 보입니다.**
> 작업을 시작할 때마다, 그리고 민호가 "dev 갱신했다" 고 하면 그때마다 돌리세요.

---

## 지금 상태

**전부 동작합니다.** 만들기 → 참여 → 활동 → 결과 → 소감, 액션의 처음부터 끝까지가 제 담당입니다.

> **새로 이관받음 (2026-09-01):** 액션 만들기 화면. 민호가 만들어 이미 동작하고, 이제 제가 주인입니다.

| 화면 | 주소 | 파일 |
|---|---|---|
| **액션 만들기** | `/action/create` | `app/action/create/page.tsx` + `components/action/ActionForm.tsx` · `ItemEditor.tsx` |
| 참여하기 | `/action/[id]/join` | `app/action/[id]/join/page.tsx` + `components/action/JoinForm.tsx` |
| 참여 완료 | `/action/[id]/welcome` | `app/action/[id]/welcome/page.tsx` |
| 함께하는 사람들 | `/action/[id]/crew` | `app/action/[id]/crew/page.tsx` |
| 크루 게시판 | `/action/[id]/chat` | `app/action/[id]/chat/page.tsx` + `components/action/ChatBoard.tsx` |
| 결과 작성 | `/action/[id]/result/write` | `app/action/[id]/result/write/page.tsx` + `components/action/ResultWriteForm.tsx` |
| 결과 보기 | `/action/[id]/result` | `app/action/[id]/result/page.tsx` |
| 소감 작성 | `/action/[id]/voice` | `app/action/[id]/voice/page.tsx` + `components/action/VoiceForm.tsx` |

---

## 알아둬야 할 규칙 6개

### ① 화면에서 본 숫자를 믿고 신청을 허용하면 안 됩니다

동시에 두 사람이 마지막 한 자리를 신청하면 **둘 다 화면에는 "1명 더 함께할 수 있어요"로 보입니다.**

그래서 최종 판단은 서버(`join_action`)가 합니다. 항목 행을 잠그고 순서대로 처리해서, 두 번째 사람은 이렇게 거절됩니다.

```
「산책 도우미」 모집이 완료되었습니다. (1 / 1)
```

화면의 `disabled` 는 **미리 알려주기 위한 것**입니다. 서버가 거절하면 그 메시지를 그대로 보여주고 `router.refresh()` 로 숫자를 다시 불러오세요.

### ② 게시판은 대화방처럼 보이지만 게시판입니다

- **원글 + 댓글 1단계.** 대댓글은 DB 트리거가 막습니다
- **실시간 아님.** 화면에 들어올 때 최신 목록을 불러옵니다
- 본인 글만 삭제. **원글을 지우면 딸린 댓글도 함께** 사라집니다
- 삭제는 행을 지우지 않고 `deleted_at` 에 시각을 적습니다. `getChatPosts()` 가 `content` 를 이미 `'삭제된 글입니다.'` 로 바꿔서 줍니다

**전송 버튼 중복 클릭 방지는 직접 처리해야 합니다.** 빠르게 두 번 누르면 글이 두 개 올라갑니다.

### ③ 소감은 저장과 상태 변경이 함께 일어납니다

`submitCrewVoice()` 안에서 **한 트랜잭션으로** 처리됩니다. 화면에서 상태를 따로 바꿀 필요가 없습니다.

```
소감 저장  +  참여 상태를 ACTUALLY_PARTICIPATED 로  →  MY 참여 수에 반영
```

하나만 저장되면 "소감은 썼는데 참여 완료가 안 된" 이상한 상태가 되기 때문입니다.

### ④ 결과 사진은 최소 1장이 필수입니다

DB CHECK 로도 막혀 있습니다. 그리고 **결과를 먼저 저장하고 그다음에 상태를 바꿔야** 합니다. `completeAction()` 이 "결과가 없으면" 거절하기 때문입니다.

### ⑤ 액션 저장·나가기는 준비된 함수를 부르세요

민호가 만들어 뒀습니다. 직접 `insert` / `update` 하지 마세요.

```tsx
// 액션 초안 저장 — 제목만 있어도 저장됩니다 (자동 임시저장용)
const res = await saveActionDraft(supabase, {
  title, category, address, placeName,          // placeName = "신라목욕탕"
  recruitEndAt, activityStartAt, activityEndAt,
}, actionId);                                    // actionId 없으면 새로 만듭니다
if (!res.ok) { toast(res.message, 'error'); return; }
const id = res.data;                             // 새로 만든 액션의 id
```

**날짜 앞뒤 검사(F14)가 이 함수 안에 들어 있습니다.** 마감이 활동 시작보다 뒤면
`"모집 마감은 활동 시작보다 앞서야 해요…"` 를 돌려줍니다. 화면에서 따로 검사하지 마세요.

```tsx
// 사유 남기고 나가기 — 세 가지가 한 번에, 순서까지 보장됩니다
const res = await leaveActionWithReason(supabase, actionId, reason);
//   ① 사유를 게시판에 (LEFT_NOTICE 딱지가 붙습니다)
//   ② 참여 상태 LEFT
//   ③ 호스트에게 알림 (사유 포함)
```

**사유는 5자 이상 필수**입니다. 한 번 올리면 본인도 못 지우니, 보내기 전에 확인 창을 띄워주세요.
게시판에서는 `post.kind === 'LEFT_NOTICE'` 로 구분해 "참여 취소" 표시를 붙이면 됩니다.

### ⑥ 액션 공개는 2단계입니다

만들기 화면의 저장은 DRAFT 까지입니다. 저장 → AI 검수 → **호스트가 최종 공개를 눌러야** ACTIVE 가 됩니다. `publishAction()` 이 이 흐름을 처리하니 화면에서 상태를 직접 바꾸지 마세요.

모집 항목 저장은 **반드시 `saveActionItems()`** 를 쓰세요. 여러 행을 한 번에 insert 하면 DB 기본값이 안 먹는 문제가 있는데, 이 함수가 모든 컬럼을 채워서 피해 갑니다.

---

## 첫 작업 제안

### ① 참여 흐름 전체를 두 계정으로 돌려보기 (1시간)

시크릿 창(`Ctrl+Shift+N`)으로 계정 두 개를 동시에 띄우고 돌려보세요.

- 정원이 1명인 항목을 두 계정으로 동시에 신청 → 두 번째가 거절되는가
- 성별 조건이 있는 항목이 체크가 안 되는가
- 나가기 후 모집 숫자가 줄어드는가
- 나갔던 사람이 다시 신청할 수 있는가

### ② 게시판 다듬기 (반나절)

댓글 입력창이 열리고 닫히는 흐름, 삭제 확인 문구, 글이 많을 때의 스크롤을 봐주세요.

### ③ 만들기 → 참여가 한 흐름인지 보기 (반나절)

직접 액션을 하나 만들어 끝까지 가보세요. 만들기에서 모집 항목을 이렇게 넣으면 참여 화면에 어떻게 보이는지 몸으로 익히는 게, 앞으로 이 화면에 붙는 작업들(버튼 이름 · 검수 팝업 · 날짜 검사 · 자동 임시저장 · 종료일 체크박스 · 장소명 칸)의 기반이 됩니다.

### ④ 결과 화면 (반나절)

`/action/[id]/result` 는 **비회원도 볼 수 있는 화면**입니다. 활동의 마지막을 보여주는 곳이라 발표에서도 쓰입니다.

---

## 쓸 수 있는 함수

```tsx
// 읽기
import { getActionDetail, getActionItems } from '@/lib/queries/actions';
import { getActionCrew, groupCrewByItem, getActionResult }
  from '@/lib/queries/participations';
import { getChatPosts, canWriteChat } from '@/lib/queries/chat';

// 쓰기
import { joinAction, leaveAction, leaveActionWithReason, submitCrewVoice,
         postChatMessage, deleteChatMessage, completeAction } from '@/lib/mutations';

// 액션 만들기 (새로 이관받은 화면)
import { saveActionDraft, saveActionItems, publishAction, deleteDraft }
  from '@/lib/mutations';

// 결과 저장 — 저장한 다음에 completeAction() 을 부릅니다
import { saveActionResult } from '@/lib/mutations';

// 표시
import { QuotaProgress } from '@/components/action/QuotaProgress';
import { describeResult, describeResultCount, meetsGender } from '@/lib/utils/quota';
import { uploadImage } from '@/lib/upload';   // 자동 리사이즈 포함
```

---

## 완료 기준

- [ ] `npm run build` 통과
- [ ] 모집 방식 3종이 각각 다르게 표시된다
- [ ] 마감된 항목·성별이 안 맞는 항목은 체크가 안 되고 이유가 보인다
- [ ] 물품만 수량 입력이 나오고 사람은 안 나온다
- [ ] **정원이 찬 항목을 신청하면 서버 메시지가 그대로 보이고 숫자가 갱신된다**
- [ ] 대댓글을 달 수 없다
- [ ] 원글을 지우면 댓글도 함께 "삭제된 글입니다"가 된다
- [ ] 전송 버튼을 빠르게 두 번 눌러도 글이 하나만 올라간다
- [ ] `<script>alert(1)</script>` 를 쓰면 글자로 보인다 (실행되면 안 됨)
- [ ] 참여하지 않은 계정은 게시판에 못 들어간다
- [ ] 결과 사진 없이 저장하면 막힌다
- [ ] 소감 작성 후 MY 참여 수가 1 늘어난다
- [ ] 같은 액션에 소감을 두 번 쓸 수 없다
- [ ] DRAFT 로 저장한 액션을 다시 열어 이어서 수정할 수 있다
- [ ] 제목만 입력해도 저장되고 사진 칸이 열린다
- [ ] 마감일을 활동 시작일보다 뒤로 잡으면 한국어 안내가 그 자리에 뜬다
- [ ] 장소명(예: 신라목욕탕)이 저장되고 상세 화면에 보인다
- [ ] 사유 없이 나가기를 누르면 막히고, 사유를 쓰면 게시판에 "참여 취소" 로 남는다
- [ ] AI 검수를 거치지 않고는 공개(ACTIVE)로 바꿀 수 없다

---

---

## 이번 개편에서 할 일 (2026-09-01 합의)

> 전체 합의는 [06-개편-합의.md](./06-개편-합의.md).
> 이번에 **액션 만들기 화면을 이관받아서** 제 할 일이 거기 몰려 있습니다.
>
> **✅ 민호의 준비 작업(문구 교체 · DB 변경 · 공용 함수)은 전부 끝났습니다. 바로 시작하시면 됩니다.**
> `git pull origin dev` 로 최신을 받고 시작해주세요.

### 액션 만들기 6종 (`components/action/ActionForm.tsx` 중심)

> ### ✅ F00 — 공용 함수 교체는 민호가 끝냈습니다 (안 하셔도 됩니다)
>
> `ActionForm.tsx` 와 `ResultWriteForm.tsx` 가 `supabase` 를 직접 부르던 것을
> `saveActionDraft()` · `saveActionResult()` 로 바꿔뒀습니다.
> **화면 전체에서 직접 쓰기가 0곳**이 됐습니다.
>
> 덕분에 **날짜 앞뒤 검사(F14)와 사진 장수 검사가 이미 돌고 있습니다.**
> 저장이 거절되면 `res.message` 에 한국어 문구가 담겨 옵니다.

**F11 — 검수 결과를 팝업으로 (1시간)**
지금은 하단의 "생성" 버튼과 검수 결과의 "공개" 버튼이 동시에 보여 헷갈립니다.
검수 결과를 **팝업으로** 띄우고, **팝업 안에서만 "액션 공개하기"** 를 누르게 바꿉니다.

**F14 — 날짜 순서 안내 (30분) — 검사도 배선도 끝났습니다**
마감일이 활동 시작일보다 늦거나 활동 종료가 시작보다 앞이면, 예전에는 저장이 **조용히 실패**했습니다.
지금은 `saveActionDraft()` 가 저장 전에 검사해서 한국어 메시지를 돌려줍니다.

```
"모집 마감은 활동 시작보다 앞서야 해요. 마감일을 활동 시작일 이전으로 바꿔주세요."
"활동 종료는 활동 시작보다 뒤여야 해요. 종료 시각을 다시 확인해주세요."
```

**같은 검사를 화면에서 또 만들지 마세요.** 두 곳에 있으면 나중에 한쪽만 고치게 됩니다.
할 일은 **받은 메시지를 그 칸 옆에 보여주고, 그 자리로 화면을 옮기는 것**뿐입니다.

**F31 — 종료일 "시작일과 같음" 체크박스 (1시간)**
하루짜리 활동이 대부분이라 체크박스를 **기본으로 켜두고**, 켜져 있으면 종료일이 시작일을 따라갑니다.

**F30·F33 — 자동 임시저장 (반나절)**
지금은 저장을 눌러야 사진 칸이 열립니다. **제목을 입력하면 자동으로 임시 저장**되어
사진 칸이 바로 열리게 합니다. 공개할 때 빈 칸이 있으면 **그 자리로 화면을 옮겨서** 알려줍니다.
저장 함수는 민호가 `lib/mutations.ts` 에 만들어줍니다 — 저는 가져다 붙이기만.

**F32 — 장소명 칸 + 주소 검색 (반나절)**
주소는 **다음 우편번호 검색**(무료, 키 불필요)으로 고르고,
그 아래 **장소명 칸**("신라목욕탕")을 새로 만들어 직접 입력받습니다.

> ### ✅ 배선은 민호가 끝냈습니다 — **입력칸 하나만** 만들면 됩니다
>
> `ActionFormInitial` · `EMPTY` · `initial` · 저장 전달까지 전부 연결돼 있고,
> `placeName` state 도 이미 있습니다. 실측으로 왕복까지 확인했습니다
> (저장 → 다시 열기 → 상세 화면).
>
> **하실 일은 두 가지입니다.**
>
> ```tsx
> // components/action/ActionForm.tsx — 주소 칸 아래에
> <input
>   value={placeName}
>   onChange={(e) => setPlaceName(e.target.value)}
>   placeholder="예) 신라목욕탕"
> />
> ```
>
> 그리고 **주소 칸에 다음 우편번호 검색**을 붙이는 것(무료·키 불필요).
> 그게 F32 의 전부입니다.

### 참여·게시판 쪽

**F29 — "메시지 보기" 버튼 (1시간)**
참여 안 한 사람에게도 버튼은 보여주되, 누르면 **"참여 신청을 한 사람만 볼 수 있어요"** 팝업.

**F40 — 나가기 사유 (반나절) — 함수 하나로 끝납니다**

> 📁 **버튼 위치**: `components/action/LeaveButton.tsx` (**개발 B 담당**)
> 원래 조장 파일(`ActivityButtons.tsx`) 안에 있었는데, 이 과업이 개발 B 몫이라
> 민호가 파일을 분리했습니다. **조장 파일은 건드리지 않아도 됩니다.**
나가기 창에서 **사유를 필수로** 받고, 이 함수 하나만 부르면 됩니다.

```tsx
const res = await leaveActionWithReason(supabase, actionId, reason);
if (!res.ok) { toast(res.message, 'error'); return; }
```

안에서 세 가지가 **한 트랜잭션으로** 일어납니다. 중간에 실패하면 전부 되돌아갑니다.

```
① 사유를 게시판에 올린다  (kind = 'LEFT_NOTICE')
② 참여 상태를 LEFT 로
③ 호스트에게 알림          (사유가 body 에 함께 담깁니다)
```

**세 가지를 따로 부르지 마세요.** 나가고 나면 게시판 권한이 사라져서
순서가 틀어지면 글이 안 올라갑니다. 그래서 순서를 함수 안에 고정해 뒀습니다.

- 사유는 **5자 이상 1000자 이하**. 짧으면 서버가 한국어로 거절합니다
- 활동이 시작된 뒤에는 나갈 수 없습니다 (기존 규칙 그대로)
- 게시판에서 `post.kind === 'LEFT_NOTICE'` 인 글에 **"참여 취소" 딱지**를 붙여주세요

보내기 전 확인 창을 꼭 넣어주세요 — **한 번 올린 사유는 본인도 지울 수 없습니다.**
(나가면 게시판에 들어갈 수 없으니까요)
> "이 내용이 크루들에게 보입니다. 한번 보내면 지울 수 없어요."

**F23 — 결과 화면 소감 목록 접기 (1시간)**
`/action/[id]/result` 의 크루 소감을 **최신 2개만 보여주고 "+ 더보기"** 로 펼칩니다.
소감이 20개 넘으면 결과 사진까지 내려가기 전에 지칩니다.
파일: `app/action/[id]/result/page.tsx`

**F41 — 공개한 액션의 소개·안내 수정 (반나절)**
호스트가 공개 뒤에도 소개글과 안내사항은 고칠 수 있게 합니다. 제목·날짜·장소는 잠깁니다.

> ⚠️ **`saveActionDraft()` 를 쓰면 안 됩니다.** 제목·날짜까지 전부 보내는데,
> DB 가 "공개 뒤엔 소개·안내만" 을 강제해서 거절합니다. 날짜 입력칸이 초를 버리는 탓에
> **저장된 값을 그대로 되돌려 보내도 막힙니다.**
>
> 대신 **`updateActionText(supabase, actionId, { description, notice })`** 를 쓰세요.
> 두 칸만 보내므로 안전합니다. 호스트에게만 보여주세요(`action.isOwner`).

**F43 — 참여 완료 화면의 "HOME으로 가기" 버튼 삭제 (10분)**
파일: `app/action/[id]/welcome/page.tsx`

> ✅ **선행 작업은 끝났습니다.** 원래 이 화면은 하단 탭이 숨겨져 있어서,
> 버튼만 지우면 **홈으로 갈 방법이 사라지는 상태**였습니다.
> 민호가 `BottomNav` 에서 이 화면을 숨김 목록에서 뺐으니(F02) 이제 안전하게 지우면 됩니다.
> 지우기 전에 화면 아래에 탭이 실제로 보이는지 한 번만 확인해주세요.

**F45 — The Crew 항목별 보기 (반나절)**
"1일차에 누가 오나" 를 볼 수 있게 합니다. 파일: `app/action/[id]/crew/page.tsx`

연일 활동은 **모집 항목을 날짜로 나눠서** 다룹니다 — "1일차 배식팀", "2일차 정리팀".
크루가 항목을 고르는 것이 곧 날짜를 고르는 것이 됩니다. 달력은 만들지 않습니다.

`getActionCrew()` 가 이제 **각자 무엇에 참여했는지** 함께 돌려줍니다.
항목 기준으로 뒤집는 함수도 준비해 뒀습니다.

```tsx
import { getActionCrew, groupCrewByItem } from '@/lib/queries/participations';

const { owner, crew } = await getActionCrew(supabase, id, user.id);

// 사람 기준 — 지금 화면
crew[0].nickname;   // "지우"
crew[0].selection;  // "1일차 배식팀 · 담요 10장"

// 항목 기준 — 새로 만들 보기
const groups = groupCrewByItem(crew);
// [{ itemId, name: '1일차 배식팀', unit: '명', type: 'PERSON',
//    total: 4, members: [{ person, quantity }, ...] }, ...]
```

> ⚠️ **물품은 다른 크루에게 안 보입니다.** 누가 얼마를 냈는지는 서로 비교하게 되는 정보라
> **본인과 호스트만** 볼 수 있게 해뒀습니다. 사람 항목("1일차 배식팀")은 크루끼리 공개됩니다.
>
> 그래서 크루가 보는 화면에서는 **물품 항목 묶음이 비어 보일 수 있습니다.** 정상입니다.
> 물품까지 다 보여주려면 호스트 화면에서만 보여주세요 (`action.isOwner`).

---

# AI에게 시킬 때

**아래를 그대로 복사해서 앞에 붙이고, 원하는 작업을 이어서 쓰세요.**

```
## 프로젝트

착착(CHAK CHAK) — 봉사·나눔 활동(=액션)을 만들고 참여하고 결과를 나누는 모바일 웹.
Next.js 15 (App Router) · TypeScript · Tailwind CSS · Supabase · OpenAI gpt-4o-mini

## 내 담당

액션의 처음부터 끝까지 — 만들기 → 참여 → 활동 → 결과 → 소감.
app/action/create/ · app/action/[id]/ 하위 (join · welcome · crew · chat · result · voice)
components/action/ (ActionForm · ItemEditor · JoinForm · ChatBoard · ResultWriteForm · VoiceForm)

화면은 이미 다 동작한다. 나는 써보고 어색한 곳을 고친다.

## 반드시 지킬 것

1. params 는 Promise 다. 반드시 await 한다.
   const { id } = await params;

2. 데이터 읽기는 lib/queries/ 의 함수, 쓰기는 lib/mutations.ts 의 함수만 쓴다.
   화면에서 supabase.from(...) 이나 supabase.rpc(...) 를 직접 호출하지 않는다.
   필요한 함수가 없으면 새로 만들지 말고 "없다"고 알려준다.

3. 쓰기 함수는 { ok: true, data } 또는 { ok: false, message } 를 돌려준다.
   message 는 그대로 사용자에게 보여주면 되는 한국어다. try/catch 를 쓰지 않는다.
   joinAction · leaveAction · leaveActionWithReason · submitCrewVoice ·
   postChatMessage · deleteChatMessage · completeAction ·
   saveActionDraft · saveActionItems · saveActionResult · publishAction · deleteDraft

4. 정원·성별 검증의 최종 판단은 서버(join_action)가 한다.
   화면의 disabled 는 미리 알려주기 위한 것일 뿐이다.
   서버가 거절하면 res.message 를 그대로 보여주고 router.refresh() 로 숫자를 갱신한다.
   "화면에 자리가 남았으니 신청을 허용한다" 같은 판단을 클라이언트에서 하지 않는다.

5. 모집 수량 표시는 lib/utils/quota.ts 의 함수를 쓴다. 숫자를 직접 조합하지 않는다.
   getQuotaState · describeTarget · describeResult · describeResultCount · meetsGender
   최소 인원형(MINIMUM)에는 퍼센트를 쓰지 않는다.
   정해진 인원형(RANGE)은 최소를 넘기면 분모가 min 에서 max 로 바뀐다.
   사람 항목은 수량이 항상 1이고, 물품만 수량을 입력받는다.

6. 게시판은 원글 + 댓글 1단계다. 대댓글을 만들지 않는다 (DB 트리거가 막는다).
   삭제는 soft delete 다. 원글을 지우면 딸린 댓글도 함께 삭제 처리된다.
   getChatPosts() 가 삭제된 글의 content 를 이미 '삭제된 글입니다.' 로 바꿔서 준다.
   전송 버튼 중복 클릭을 막는다 (busy 상태로 disabled).
   dangerouslySetInnerHTML 을 절대 쓰지 않는다.

7. 소감 저장은 submitCrewVoice() 하나로 끝난다.
   참여 상태 변경이 그 안에서 함께 일어나므로 화면에서 따로 바꾸지 않는다.

8. 결과는 사진이 최소 1장 필수다. 결과를 먼저 저장하고 그다음 completeAction() 을 부른다.
   순서를 바꾸면 "결과를 먼저 작성해주세요" 로 거절된다.

9. 날짜 표시는 lib/utils/date.ts 를 쓴다.
   formatDate · formatDateShort · formatTime · formatActivityPeriod · formatRelative

10. 이미 있는 공통 컴포넌트를 쓴다. 비슷한 것을 새로 만들지 않는다.
    Button Badge Chip EmptyState Toast Avatar ActionCard ImageUploader
    QuotaProgress Header BottomNav

11. lib/ 과 components/ui/ 는 다섯 명이 함께 쓰는 공유 구역이다.
    수정하지 말고 "수정이 필요하다"고 알려준다.
    components/action/ 안의 내 담당 파일은 고쳐도 된다.

12. 서버 컴포넌트가 기본이다. 'use client' 는 훅·이벤트가 필요할 때만 쓴다.

13. 목록 화면에는 빈 상태(EmptyState)를 반드시 넣는다.
    권한이 없어 못 보는 화면은 빈 목록이 아니라 이유를 알려준다.
    (예: 게시판 — "참여한 사람만 볼 수 있어요")

14. 사용자에게 보이는 문구와 코드 주석은 한국어로 쓴다.
    되돌릴 수 없는 동작(나가기·삭제)에는 확인 창을 넣는다.

15. 새 파일·새 쿼리·새 상수를 만들기 전에, 이미 있는 것을 먼저 찾아 쓴다.

16. 액션 공개는 2단계다. 저장(DRAFT) → AI 검수 → 호스트가 최종 공개해야 ACTIVE.
    publishAction() 이 처리하니 상태를 직접 바꾸지 않는다.
    모집 항목 저장은 saveActionItems() 만 쓴다 — 여러 행 insert 시
    DB 기본값이 안 먹는 문제를 이 함수가 처리해 둔다.

17. 액션 본문 저장은 saveActionDraft() 만 쓴다.
    actions 테이블을 직접 insert/update 하지 않는다.
    날짜 앞뒤 검사(모집 마감 <= 활동 시작 < 활동 종료)가 이 함수 안에 있으므로
    화면에서 같은 검사를 또 만들지 않는다.
    장소는 address(주소 검색)와 placeName(호스트가 직접 입력) 두 칸이다.

18. 나가기는 leaveActionWithReason(supabase, actionId, reason) 하나로 끝난다.
    게시판 글 → 나가기 → 호스트 알림 순서가 함수 안에 고정돼 있다.
    화면에서 세 가지를 나눠 부르지 않는다. 사유는 5자 이상 필수다.
    게시판에서 kind === 'LEFT_NOTICE' 인 글은 "참여 취소" 로 구분해 보여준다.

19. 날짜 앞뒤 검사는 saveActionDraft() 안에 이미 있다. 화면에서 또 만들지 않는다.
    받은 message 를 해당 입력칸 옆에 보여주고 그 자리로 스크롤하는 것까지가 화면의 일이다.

20. The Crew 를 항목별로 묶을 때는 groupCrewByItem(crew) 를 쓴다.
    물품(GOODS) 항목은 본인과 호스트에게만 보인다. 크루 화면에서 물품 묶음이
    비어 보이는 것은 정상이며, 버그로 오해해 RLS 를 바꾸려 하지 않는다.

## 오늘 할 일

(여기에 원하는 작업을 적으세요. 예시)
components/action/ChatBoard.tsx 에서 댓글 입력창이 열렸을 때
다른 글의 댓글창을 열면 이전 것이 닫히도록 고쳐줘.
그리고 글이 20개 넘을 때 스크롤 위치가 어색하지 않은지 봐줘.
```
