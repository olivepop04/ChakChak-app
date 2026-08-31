# 조장 — Activity · 트렌드 · 시드 데이터 · 발표

> 먼저 [00-공통-개발규칙.md](./00-공통-개발규칙.md)를 읽어주세요.

## 맡는 것

| 시기 | 내용 |
|---|---|
| 1~2주차 | Activity 화면 2종 (Joined / Created) |
| 2~3주차 | 시드 데이터 30~50개 |
| 4~5주차 | 트렌드 대시보드 (AI Agent #2) |
| 계속 | 발표 시나리오 · 리허설 |

**이 조합은 일부러 이렇게 묶었습니다.** 발표 준비로 며칠 빠져도 다른 사람이 기다리지 않는 일들입니다. Activity는 남의 코드 의존이 적고, 트렌드는 3순위라 늦어져도 전체가 멈추지 않습니다.

---

## 1주차 — Activity 화면

**주소:** `/activity`
**파일:** `app/activity/page.tsx`
**목업:** `07.good_activity_created_v04.html`, `08.good_activity_joined_v03.html`

상단에 탭 두 개가 있고, 아래에 카드 목록이 나오는 구조입니다.

```
ACTIVITY
┌─────────────┬─────────────┐
│  참여한 액션 │  만든 액션   │   ← 탭
└─────────────┴─────────────┘
  [카드]
  [카드]
```

### 데이터 가져오기

```tsx
// app/activity/page.tsx  (서버 컴포넌트)
import { createClient } from '@/lib/supabase/server';
import { getMyJoinedActions } from '@/lib/queries/participations';
import { getMyCreatedActions } from '@/lib/queries/actions';

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;              // ★ await 필수
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;                          // middleware가 이미 막지만 타입을 위해

  const isCreated = tab === 'created';
  const items = isCreated
    ? await getMyCreatedActions(supabase, user.id)
    : await getMyJoinedActions(supabase, user.id);

  // ...
}
```

탭은 주소로 구분합니다: `/activity` (참여한) / `/activity?tab=created` (만든).
`<Link href="/activity?tab=created">` 로 이동하면 됩니다. `useState`가 필요 없습니다.

### 탭 1 — 참여한 액션

`getMyJoinedActions()`가 돌려주는 것 (`JoinedActionData`):

```ts
{
  ...ActionCardData,              // 카드에 필요한 것 전부
  participationStatus: 'BEFORE_ACTION' | 'AFTER_ACTION' | 'ACTUALLY_PARTICIPATED',
  mySelection: '일반 Crew · 분유 10통',   // 내가 고른 항목 요약
  hasVoice: boolean,                      // 소감을 썼는가
}
```

> 나간 액션(`LEFT`)은 함수가 이미 걸러냅니다.

**상태별로 배지와 버튼이 다릅니다.**

| 참여 상태 | 배지 문구 | 버튼 |
|---|---|---|
| `BEFORE_ACTION` | 참여 예정 | `액션 보기` · `CREW CHAT` · `나가기` |
| `AFTER_ACTION` | 소감 작성 필요 | `결과 보기` · `소감 남기기` |
| `ACTUALLY_PARTICIPATED` | 참여 완료 | `결과 보기` |

배지 문구는 직접 적지 말고 상수를 쓰세요.

```tsx
import { PARTICIPATION_STATUS_LABEL } from '@/lib/constants';
PARTICIPATION_STATUS_LABEL[item.participationStatus]
```

**카드는 공통 컴포넌트를 씁니다.** 버튼은 `footer`로 넣으세요.

```tsx
import { ActionCard } from '@/components/ui/ActionCard';

<ActionCard
  action={item}
  showStatus
  footer={
    <div className="flex gap-2">
      <Link href={`/action/${item.id}`} className="...">액션 보기</Link>
      <Link href={`/action/${item.id}/chat`} className="...">CREW CHAT</Link>
      <LeaveButton actionId={item.id} />   {/* 클라이언트 컴포넌트 */}
    </div>
  }
/>
```

### "나가기" 버튼

별도 클라이언트 컴포넌트로 만드세요. **확인 창을 반드시 넣습니다.**

```tsx
'use client';
import { createClient } from '@/lib/supabase/client';
import { leaveAction } from '@/lib/mutations';
import { useRouter } from 'next/navigation';

export function LeaveButton({ actionId }: { actionId: string }) {
  const router = useRouter();

  async function handleLeave() {
    if (!confirm('참여를 취소할까요? 모집 인원에서 빠지고, 게시판에도 들어갈 수 없게 됩니다.')) return;

    const res = await leaveAction(createClient(), actionId);
    if (!res.ok) { alert(res.message); return; }
    router.refresh();
  }

  return <button onClick={handleLeave}>나가기</button>;
}
```

활동이 시작된 뒤에는 서버가 거절합니다(`"활동이 시작된 뒤에는 나갈 수 없습니다."`). 그 메시지를 그대로 보여주면 됩니다.

### 탭 2 — 만든 액션

`getMyCreatedActions()`는 **DRAFT까지 전부** 돌려줍니다 (내 것이니까).

| 액션 상태 | 배지 | 버튼 |
|---|---|---|
| `DRAFT` | 작성 중 | `계속 작성하기` · `삭제하기` |
| `ACTIVE` | 모집 중 | `CREW CHAT` · `수정하기` · `취소하기` |
| `ENDED` | 결과 작성 필요 | `CREW CHAT` · `결과 작성` |
| `COMPLETED` | 완료 | `CREW CHAT` · `결과 보기` |
| `CANCELLED` | 취소됨 | 취소 사유 표시 |

**삭제·취소도 클라이언트 컴포넌트로.**

```tsx
import { deleteDraft, cancelAction } from '@/lib/mutations';

// DRAFT 삭제
if (!confirm('작성 중인 액션을 삭제할까요? 되돌릴 수 없습니다.')) return;
const res = await deleteDraft(supabase, actionId);

// 취소 — 사유 5자 이상 필수
const reason = prompt('취소 사유를 적어주세요. 참여자에게 전달됩니다.');
if (!reason) return;
const res = await cancelAction(supabase, actionId, reason);
```

취소하면 **참여자 전원에게 알림이 자동으로 갑니다.** 따로 만들 필요 없습니다.

### 빈 상태

두 탭 모두 필요합니다.

```
참여한 액션이 없을 때:
  "아직 참여한 액션이 없어요"
  "마음에 드는 액션을 찾아보세요."
  [액션 찾아보기]  → /discover

만든 액션이 없을 때:
  "아직 만든 액션이 없어요"
  "함께할 사람을 모아보세요."
  [액션 만들기]  → /action/create
```

### 완료 기준

- [ ] 탭 두 개가 주소로 전환된다 (`?tab=created`)
- [ ] 참여 상태 3종의 배지와 버튼이 표에 적힌 대로 다르게 나온다
- [ ] 액션 상태 5종의 배지와 버튼이 표에 적힌 대로 다르게 나온다
- [ ] "나가기" 후 목록에서 사라지고, 해당 액션의 모집 숫자가 줄어든다
- [ ] DRAFT 삭제가 동작하고, ACTIVE는 삭제 버튼이 없다
- [ ] 취소하면 참여자에게 알림이 간다 (다른 계정으로 확인)
- [ ] 두 탭 모두 빈 상태 화면이 나온다

---

## 2~3주차 — 시드 데이터

**파일:** `scripts/seed.mjs`

### 이미 39개가 들어 있습니다

```bash
npm run seed
```

```bash
npm run seed:clean
```

`npm run seed` 는 **여러 번 돌려도 안전합니다.** 기존 시드를 지우고 새로 넣습니다.
시드 계정은 이메일이 `@good.seed` 로 끝나서 그것만 골라 지웁니다. **실제 사용자 데이터는 건드리지 않습니다.**

시드 계정으로 로그인해볼 수 있습니다.

```
seed1@good.seed  (seed2 … seed8)
비밀번호: good1234!
```

### 데이터를 바꾸려면

`scripts/seed.mjs` 파일 **맨 위 `USERS` 와 `ACTIONS` 배열만** 고치면 됩니다. 나머지는 건드릴 필요 없습니다.

액션 하나는 이렇게 생겼습니다.

```js
['우리 동네 보호소를 함께 도와요', '동물', IMG.dog, '서울특별시 성동구 왕십리로 100', 'ACTIVE', 0, 5,
  [['산책 도우미', 'PERSON', 'M', 5, null, '명', 'ANY'],
   ['사료',       'GOODS',  'M', 50, null, '포', 'ANY']]],
```

| 자리 | 뜻 |
|---|---|
| 1 | 제목 |
| 2 | 카테고리 (8종 중 하나) |
| 3 | 대표 이미지 |
| 4 | 장소 |
| 5 | 상태 — `ACTIVE` / `ENDED` / `COMPLETED` / `CANCELLED` |
| 6 | 며칠 전에 만들어졌는지 (주간 추이 그래프용) |
| 7 | 활동일이 며칠 뒤(+) 또는 며칠 전(−) |
| 8 | 모집 항목들 — `[이름, 종류, 방식, 최소, 최대, 단위, 성별]` |

**방식**은 `'R'`(정해진 인원, 최소~최대) 또는 `'M'`(최소 인원만, 상한 없음)입니다.

> ⚠️ 상태가 `COMPLETED` 면 7번(활동일)이 반드시 **음수**여야 합니다. 이미 끝난 활동이어야 결과가 있을 수 있으니까요.

### 현재 분포

```
카테고리  8종 전부 (3~6개씩)
상태      ACTIVE 24 · COMPLETED 10 · ENDED 4 · CANCELLED 1
기간      최근 8주에 분산
모집방식  RANGE 22 · MINIMUM 32
결과      10건 · 소감 25건 · 좋아요 115건
```

발표용으로 더 늘리고 싶으면 `ACTIONS` 에 줄을 추가하고 다시 `npm run seed` 를 돌리면 됩니다.

---

## 4~5주차 — 트렌드 대시보드 (AI Agent #2)

**주소:** `/trends` (또는 Home 안의 섹션 — 팀과 상의)
**파일:** `app/trends/page.tsx`, `app/api/ai/trends/route.ts`

### 처리 흐름

```
1. 서버가 DB 집계 쿼리 실행
2. 집계 결과(숫자)를 LLM에 전달
3. LLM이 눈에 띄는 변화 3~5개를 자연어로 설명
4. Recharts로 그래프
5. 그래프 + AI 해설을 함께 표시
```

**외부 데이터(뉴스·SNS)는 쓰지 않습니다.** GOOD 내부 데이터만.

### 1단계 — 집계 쿼리부터

**AI보다 그래프를 먼저 만드세요.** 그래프가 없으면 AI 해설도 검증할 수 없습니다.

```sql
-- 카테고리별 액션 수
SELECT category, COUNT(*) FROM actions
WHERE status IN ('ACTIVE','ENDED','COMPLETED') GROUP BY category;

-- 주간 추이
SELECT date_trunc('week', created_at) AS week, COUNT(*)
FROM actions GROUP BY week ORDER BY week;

-- 카테고리별 평균 참여자 수
SELECT a.category, AVG(c.crew_count)
FROM actions a JOIN action_social_counts c ON c.action_id = a.id
GROUP BY a.category;

-- 모집 달성률 (최소 인원 충족 비율)
SELECT COUNT(*) FILTER (WHERE is_min_met)::float / NULLIF(COUNT(*), 0)
FROM action_item_progress;
```

민호에게 이 쿼리들을 `lib/queries/stats.ts`에 넣어달라고 요청하세요.

### 2단계 — Recharts

`'use client'`가 **반드시** 필요합니다.

```tsx
'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export function CategoryChart({ data }: { data: { category: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>
        <XAxis dataKey="category" fontSize={11} />
        <YAxis fontSize={11} allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="count" fill="#334155" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

### 3단계 — AI 해설

```ts
import { callStructuredAI } from '@/lib/openai';
import { z } from 'zod';

const TrendSchema = z.object({
  insights: z.array(z.object({
    title: z.string(),
    detail: z.string(),
  })).min(3).max(5),
});

const result = await callStructuredAI({
  agent: 'TRENDS',
  promptVersion: 'trends-v1',
  system: `당신은 사회공헌 활동 데이터 분석가입니다.
아래 집계 숫자만 보고 눈에 띄는 변화 3~5개를 설명하세요.

규칙:
- 주어진 숫자에 없는 내용을 지어내지 마세요.
- 미래를 예측하지 말고 "현재 현황과 변화 패턴"만 설명하세요.
- 일반인이 읽을 수 있는 쉬운 문장으로 쓰세요.
- 각 항목은 제목 한 줄 + 설명 두 문장 이내.

형식: {"insights":[{"title":"...","detail":"..."}]}`,
  user: JSON.stringify(stats),
  schema: TrendSchema,
});
```

> **발표에서 "미래 예측"이라고 하지 마세요.** 데이터가 50건이라 예측이라고 하면 질문을 받습니다.
> **"현재 활동 현황과 변화 패턴 분석"**이라고 표현하세요.

### 완료 기준

- [ ] 그래프 3종 이상이 실제 DB 숫자로 그려진다
- [ ] AI 해설 3~5개가 나오고, **그래프 숫자와 실제로 맞다**
- [ ] 데이터가 적을 때도 화면이 깨지지 않는다
- [ ] AI 호출이 실패해도 그래프는 보인다 (해설 자리에 안내 문구)

---

## 계속 — 발표 준비

### 시나리오 한 줄

명세서의 "끊기지 않는 흐름"을 **계정 하나로 처음부터 끝까지** 돌려보는 것이 목표입니다.

```
회원가입 → 액션 만들기 → AI 검수 → 공개 → 추천에 노출 →
(다른 계정) 참여 → 게시판 → 결과 작성 → 소감 → MY 카운트 증가
```

### 리허설을 언제 하나

**4주차에 한 번 반드시 돌려보세요.** 5주차에 처음 돌리면 고칠 시간이 없습니다.

리허설에서 확인할 것:

- [ ] 계정 2개로 전체 흐름이 끊기지 않고 이어지는가
- [ ] 중간에 "권한이 없습니다" 같은 오류가 안 나는가
- [ ] 각 화면 전환이 5초 안에 되는가
- [ ] AI 호출이 실패했을 때 데모가 멈추지 않는가

**AI가 발표 중에 실패할 수 있습니다.** 미리 만들어 둔 결과를 보여줄 수 있도록 백업 계정에 완성된 액션을 하나 준비해두세요.
