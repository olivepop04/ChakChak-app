# 개발 B — 참여 · 게시판 · 결과

> 먼저 [00-공통-개발규칙.md](./00-공통-개발규칙.md)를 읽어주세요.

## 맡는 것

| 시기 | 내용 |
|---|---|
| 1~2주차 | Join → You're In! → The Crew |
| 3주차 | Crew Chat |
| 4~5주차 | 결과 작성 → 결과 보기 → 소감 작성 |

**왜 이렇게 묶었나:** 참여 → 활동 → 결과 → 소감이 **하나로 이어지는 흐름**이라 한 사람이 맡으면 맥락이 안 끊깁니다. 목록은 길어 보이지만 결과 쪽은 5주차에나 필요하니 실제로는 순차 진행입니다.

**어려운 부분(정원 검증·동시 신청 처리)은 이미 서버에 만들어져 있습니다.** 함수를 부르기만 하면 됩니다.

---

## 1주차 — Join 화면

**주소:** `/action/[id]/join`
**파일:** `app/action/[id]/join/page.tsx`
**목업:** `03.good_join_v05.html`

### 데이터

```tsx
import { getActionDetail } from '@/lib/queries/actions';

const { id } = await params;                     // ★ await 필수
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
const action = await getActionDetail(supabase, id, user!.id);
if (!action) notFound();
```

로그인은 middleware가 이미 확인했으므로 `user`는 있습니다.

또 하나 필요한 것: **내 성별**. 항목별 성별 제한을 미리 표시하려면 필요합니다.

```tsx
const { data: profile } = await supabase
  .from('profiles').select('gender').eq('id', user!.id).single();
```

### 화면 구성

```
‹  JOIN ACTION

[액션 요약 카드]
  🐶 우리 동네 보호소를 함께 도와요
  @olive · 8월 30일 · 서울 성동구

── 내가 할 수 있는 일 ──  (복수 선택)

☑ 일반 Crew
  최소 10명 · 특별한 조건 없음
  15명 참여  ████████  최소 인원이 충족되었어요.

☐ 요리 담당                        [조리사 자격증 보유]
  정확히 3명
  3 / 3명  ████████  모집이 완료되었어요.        ← 선택 불가

☐ 운반 지원                        [남성만]
  3~5명
  4 / 5명  ██████░░  최소 인원 충족 · 1자리 남음

☑ 분유
  최소 100통
  64통 참여  ██████░░  최소 36통이 더 필요해요.
  [−]  10통  [+]                    ← 물품만 수량 입력

── 참여 일정 & 장소 ──
8월 30일 · 14:00–17:00
○○동물보호소

── 나의 참여 ──
🙋 일반 Crew
🍼 분유 10통

[참여 확정하기]
```

### 항목 표시 — 이미 만들어진 컴포넌트를 쓰세요

```tsx
import { QuotaProgress } from '@/components/action/QuotaProgress';
import { meetsGender } from '@/lib/utils/quota';

{action.items.map((item) => {
  const genderOk = meetsGender(item, profile?.gender);
  const disabled = item.isFull || !genderOk;

  return (
    <label key={item.id} className={disabled ? 'opacity-50' : ''}>
      <input type="checkbox" disabled={disabled} ... />
      <QuotaProgress item={item} current={item.currentCount} detailed
                     conditionName={item.conditionName} />
      {!genderOk && <p className="text-xs text-red-600">성별 조건이 맞지 않아요.</p>}
      {item.type === 'GOODS' && checked && <QuantityInput ... />}
    </label>
  );
})}
```

**절대 하지 말 것:** `{item.currentCount} / {item.max_allowed}` 처럼 직접 조합하기.
최소 인원형은 퍼센트를 안 쓰고, 정해진 인원형은 최소를 넘기면 분모가 바뀝니다. 그 규칙이 컴포넌트 안에 있습니다.

### 수량 입력

| 항목 종류 | 수량 |
|---|---|
| 사람(`PERSON`) | 항상 **1**. 입력 UI 없음 |
| 물품(`GOODS`) | `[−] [숫자] [+]` + **직접 타이핑도 가능** |

```tsx
<input
  type="number" min={1} value={qty}
  onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
/>
```

### 참여 확정

```tsx
'use client';
import { joinAction } from '@/lib/mutations';

const res = await joinAction(supabase, actionId, selected.map((s) => ({
  actionItemId: s.itemId,
  quantity: s.item.type === 'PERSON' ? 1 : s.qty,
})));

if (!res.ok) {
  setError(res.message);   // "「요리 담당」 모집이 완료되었습니다. (3 / 3)"
  router.refresh();        // 최신 숫자로 갱신
  return;
}
router.push(`/action/${actionId}/welcome`);
```

### 여기가 가장 중요합니다

> **화면에서 본 숫자를 믿고 신청을 허용하면 안 됩니다.**
>
> 동시에 두 사람이 마지막 한 자리를 신청하면 **둘 다 화면에는 "1자리 남음"으로 보입니다.**
> 그래서 최종 판단은 서버(`join_action`)가 항목 행을 잠그고 순서대로 처리합니다.
>
> 화면의 `disabled`는 **미리 알려주기 위한 것일 뿐**입니다. 서버가 거절하면 그 메시지를 그대로 보여주고 `router.refresh()`로 숫자를 새로 불러오세요.

서버가 확인하는 것: 액션이 ACTIVE인가 · 모집 마감 전인가 · 내 액션이 아닌가 · 이미 참여 중이 아닌가 · 성별 조건 · **정원 초과**

### 완료 기준

- [ ] 모집 방식 3종이 각각 다르게 표시된다
- [ ] 마감된 항목은 체크가 안 된다
- [ ] 성별이 안 맞는 항목은 체크가 안 되고 이유가 표시된다
- [ ] 물품만 수량 입력이 나오고, 사람은 안 나온다
- [ ] 아무것도 안 고르고 확정하면 안내가 뜬다
- [ ] 정원이 찬 항목을 신청하면 서버 메시지가 그대로 보이고 숫자가 갱신된다
- [ ] 성공하면 `/welcome`으로 이동한다

---

## 1주차 — You're In!

**주소:** `/action/[id]/welcome`
**파일:** `app/action/[id]/welcome/page.tsx`
**목업:** `03.good_join_v05.html` 오른쪽 부분

```
🎉
You're In!
좋은 일을 함께 시작하게 되었어요.

┌────────────────────────────┐
│ 지금 이 액션을 함께하는 사람들 │
│ (O)(S)(D)(J)(M) +5          │
│ 현재 10명이 함께하고 있어요.  │
└────────────────────────────┘   ← 누르면 /crew 로 이동

[💬 함께하는 사람들과 이야기하기]  → /chat
[HOME으로 가기]                  → /
```

아바타 목록은 `getActionCrew()`로 가져와서 앞 5명만 보여주고 나머지는 `+N`으로.

---

## 2주차 — The Crew

**주소:** `/action/[id]/crew`
**파일:** `app/action/[id]/crew/page.tsx`
**목업:** `05.good_the_crew_v01.html`

```tsx
import { getActionCrew } from '@/lib/queries/participations';

const { owner, crew } = await getActionCrew(supabase, id, user!.id);
```

```
‹  THE CREW

── 리더 ──
(O) olive          8개 참여 · 3개 리드    [프로필 보기]

── 함께하는 사람들 (10) ──
(S) sarah          8개 참여 · 2개 리드    [프로필 보기]
(J) jason          5개 참여 · 3개 리드    [프로필 보기]
...
```

- `getActionCrew`가 **나간 사람(LEFT)을 이미 제외**합니다
- `프로필 보기` → `/user/{id}`
- 활동 이력 숫자는 `participatedCount`, `ledCount`를 쓰세요 (직접 세지 마세요)

**완료 기준**

- [ ] Owner가 맨 위에 따로 표시된다
- [ ] 나간 사람이 목록에 없다
- [ ] 프로필로 이동된다

---

## 3주차 — Crew Chat

**주소:** `/action/[id]/chat`
**파일:** `app/action/[id]/chat/page.tsx`
**목업:** `04.good_project_chat_v01.html`

### 구조 — 대화방처럼 보이지만 게시판입니다

- 원글 + 댓글 **1단계만**. 대댓글은 DB가 막습니다
- **실시간 아님.** 페이지에 들어올 때 최신 목록을 불러옵니다
- 텍스트만. 이미지 업로드 없음
- 본인 글만 삭제 가능. **원글을 지우면 딸린 댓글도 함께 삭제됩니다**

### 데이터

```tsx
import { getChatPosts, canWriteChat } from '@/lib/queries/chat';

const posts = await getChatPosts(supabase, id, user!.id);
const writable = canWriteChat(action.status);   // ACTIVE / ENDED 에서만 true
```

`getChatPosts`가 돌려주는 것:

```ts
{
  id, content, createdAt, deletedAt,
  author: { id, nickname },
  isMine: boolean,
  replies: [ { ...같은 모양 } ],
}
```

**삭제된 글은 `content`가 이미 `'삭제된 글입니다.'`로 바뀌어 있습니다.** 그냥 그리면 되고, `deletedAt`이 있으면 회색으로 흐리게 처리하세요.

### 쓰기

```tsx
import { postChatMessage, deleteChatMessage } from '@/lib/mutations';

// 원글
await postChatMessage(supabase, actionId, text);
// 댓글
await postChatMessage(supabase, actionId, text, parentPostId);
// 삭제
if (!confirm('삭제할까요? 이 글에 달린 댓글도 함께 사라집니다.')) return;
await deleteChatMessage(supabase, messageId);

router.refresh();
```

### 상태별 동작

| 액션 상태 | 읽기 | 쓰기 |
|---|---|---|
| ACTIVE / ENDED | ✅ | ✅ |
| COMPLETED / CANCELLED | ✅ | ❌ 입력창 숨기고 "종료된 액션이라 새 글을 쓸 수 없어요" |
| 나간 사람 | ❌ 접근 불가 | ❌ |

RLS가 서버에서 막지만, **입력창을 미리 숨기는 게 친절합니다.**

### 안전장치 (명세서 요구사항)

- 공백만 있는 글 차단 → `mutations`가 이미 처리
- 1000자 제한 → `mutations`가 이미 처리
- **전송 버튼 중복 클릭 방지** → 직접 처리해야 합니다

```tsx
const [sending, setSending] = useState(false);
async function send() {
  if (sending) return;
  setSending(true);
  await postChatMessage(...);
  setSending(false);
}
<button disabled={sending || !text.trim()}>전송</button>
```

- **HTML을 코드로 실행하지 않기** → React가 기본으로 처리합니다.
  단 `dangerouslySetInnerHTML`을 **절대 쓰지 마세요.**

### 완료 기준

- [ ] 원글과 댓글이 계층으로 보인다
- [ ] 댓글에 다시 댓글을 달 수 없다
- [ ] 본인 글에만 삭제 버튼이 보인다
- [ ] 원글을 지우면 댓글도 함께 "삭제된 글입니다"가 된다
- [ ] COMPLETED 액션에서는 입력창이 없다
- [ ] 전송 버튼을 빠르게 두 번 눌러도 글이 하나만 올라간다
- [ ] `<script>alert(1)</script>` 를 쓰면 글자로 보인다 (실행되면 안 됨)

---

## 4주차 — 결과 작성 (Owner)

**주소:** `/action/[id]/result/write`
**파일:** `app/action/[id]/result/write/page.tsx`

### 접근 조건

- **Owner만**, 액션이 **ENDED** 상태일 때

```tsx
if (!action.isOwner) notFound();
if (action.status !== 'ENDED') redirect(`/action/${id}/result`);
```

### 화면

```
── 자동 집계 ──   ← 수정 불가, 보여주기만
  일반 Crew    15명   최소 10명 → 최소 인원을 충족했습니다.
  요리 담당    3명 / 3명 → 모집 인원을 충족했습니다.
  분유        64통   최소 100통 → 최소 인원에 36통 모자랐습니다.

── 이렇게 마무리했어요 ──
  [텍스트 입력]

── 결과 사진 ──   ★ 최소 1장, 최대 5장 (필수)
  [+] [+] [+]

── Owner's Voice ──
  [텍스트 입력]

[결과 공개하기]
```

집계 문장은 함수를 쓰세요.

```tsx
import { describeResult, describeResultCount } from '@/lib/utils/quota';

describeResultCount(item, item.currentCount)   // "15명" 또는 "3명 / 3명"
describeResult(item, item.currentCount)        // "최소 인원을 충족했습니다."
```

### 이미지 업로드

```tsx
const path = `${actionId}/${crypto.randomUUID()}.${ext}`;
const { error } = await supabase.storage.from('result-images').upload(path, file);
if (error) { alert('사진 업로드에 실패했어요.'); return; }

const { data: { publicUrl } } = supabase.storage.from('result-images').getPublicUrl(path);
urls.push(publicUrl);
```

**업로드 성공을 확인한 URL만 DB에 저장하세요.** 실패했는데 URL부터 저장하면 깨진 이미지가 남습니다.

파일 검사: JPEG/PNG/WebP만, 5MB 이하 (`UPLOAD` 상수 참고)

### 저장 → 공개

```tsx
// 1) 결과 저장 (사진 1~5장 필수 — DB CHECK가 막습니다)
await supabase.from('action_results').insert({
  action_id: actionId, content, image_urls: urls, owner_voice: ownerVoice,
});

// 2) 공개
const res = await completeAction(supabase, actionId);
if (!res.ok) { alert(res.message); return; }
```

`completeAction`이 상태를 COMPLETED로 바꾸고 **참여자 전원에게 알림을 보냅니다.** 따로 만들 필요 없습니다.

### 완료 기준

- [ ] Owner가 아니면 못 들어간다
- [ ] 집계 숫자와 문장이 실제 참여 데이터와 맞다
- [ ] 사진 없이 저장하면 막힌다
- [ ] 6장째는 추가가 안 된다
- [ ] 공개 후 상태가 COMPLETED가 되고 참여자에게 알림이 간다

---

## 5주차 — 결과 보기 · 소감 작성

### 결과 보기 — `/action/[id]/result`

**비회원도 볼 수 있습니다.**

```tsx
import { getActionResult } from '@/lib/queries/participations';
const result = await getActionResult(supabase, id);
if (!result) return <p>아직 결과가 등록되지 않았어요.</p>;
```

```
── 이렇게 마무리했어요 ──
  자동 집계 (항목별)
  결과 내용 + 사진

── Owner's Voice ──
  "..."   @olive

── Crew Voice (5) ──
  (S) sarah  "..."
  (J) jason  "..."
```

### 소감 작성 — `/action/[id]/voice`

**접근 조건:** 참여자이고 상태가 `AFTER_ACTION`일 때

```tsx
import { submitCrewVoice } from '@/lib/mutations';

const res = await submitCrewVoice(supabase, actionId, content);
if (!res.ok) { setError(res.message); return; }
router.push(`/action/${actionId}/result`);
```

- **10자 이상 1000자 이하**
- 저장과 동시에 참여 상태가 `ACTUALLY_PARTICIPATED`로 바뀝니다 — **한 트랜잭션이라 따로 처리할 필요 없습니다**
- 이때부터 MY의 "참여 액션 수"에 카운트됩니다

입력 중 글자 수를 보여주세요.

```tsx
<p className="text-xs text-neutral-400">{content.length} / 1000</p>
{content.length < 10 && content.length > 0 && (
  <p className="text-xs text-red-600">10자 이상 작성해주세요.</p>
)}
```

### 완료 기준

- [ ] 결과를 비회원도 볼 수 있다
- [ ] 소감이 목록에 바로 반영된다
- [ ] 9자로 저장하면 막힌다
- [ ] 소감 작성 후 MY의 참여 수가 1 늘어난다
- [ ] 같은 액션에 소감을 두 번 쓸 수 없다
- [ ] 참여하지 않은 사람은 소감 화면에 못 들어간다
