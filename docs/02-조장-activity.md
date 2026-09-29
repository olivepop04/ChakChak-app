# 조장 — 내 활동 · 트렌드 · 시연 데이터 · 발표

> **이 문서 하나만 AI에게 줘도 됩니다.** 필요한 제약이 아래에 다 들어 있습니다.
> 팀 공통 작업 규칙(브랜치·PR)은 [00-공통규칙.md](./00-공통규칙.md)에 있습니다.
>
> **PR 을 만들 때 받는 쪽이 `main` 으로 자동 선택돼 있습니다.
> 반드시 `dev` 로 바꿔주세요.** 그대로 두면 리뷰 없이 배포됩니다.

```bash
git fetch origin
git checkout feature/조장-activity
git merge origin/dev        # ← 이 줄을 빼면 안 됩니다
```

> **`git merge origin/dev` 를 반드시 같이 하세요.**
> 브랜치는 만들어진 시점에 멈춰 있습니다. 그냥 `checkout` 만 하면
> **그 이후에 올라온 작업이 전부 사라진 것처럼 보입니다.**
> 작업을 시작할 때마다, 그리고 민호가 "dev 갱신했다" 고 하면 그때마다 돌리세요.

---

## 지금 상태

**전부 동작합니다.** 이 조합은 **발표 준비로 며칠 빠져도 다른 사람이 기다리지 않는 일**들로 묶었습니다.

| 담당 | 주소 | 파일 |
|---|---|---|
| 내 활동 (참여/생성 탭) | `/activity` | `app/activity/page.tsx` · `components/action/ActivityButtons.tsx` |
| 트렌드 대시보드 | `/trends` | `app/trends/page.tsx` · `components/trends/` |
| 트렌드 AI 해설 | — | `app/api/ai/trends/route.ts` |
| 집계 | — | `lib/queries/stats.ts` |
| 시연 데이터 | — | `scripts/seed.mjs` · `scripts/data/` · 재분류 스크립트 3개 |
| **액션 찾기(Discover)** | `/discover` | `app/discover/` · `app/api/ai/discover/` · `components/action/DiscoverChat.tsx` · `lib/utils/scoring.ts` · `lib/utils/discover-ranking.ts` — **2026-09-29부터** |

---

## 시연 데이터 — 이미 101개가 들어 있습니다

```bash
npm run seed
```

```bash
npm run seed:clean
```

**여러 번 돌려도 안전합니다.** 기존 시드를 지우고 새로 넣습니다. 시드 계정은 이메일이 `@good.seed` 로 끝나서 **그것만 골라 지웁니다.** 직접 가입한 계정이나 만든 액션은 건드리지 않습니다.

### 데이터를 바꾸려면

`scripts/seed.mjs` **맨 위 `USERS` 와 `ACTIONS` 배열만** 고치면 됩니다. SQL을 몰라도 됩니다.

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
| 8 | 모집 항목 — `[이름, 종류, 방식, 최소, 최대, 단위, 성별]` |

**방식**은 `'R'`(정해진 인원, 최소~최대) 또는 `'M'`(최소 인원만, 상한 없음).

> ⚠️ 상태가 `COMPLETED` 면 7번이 반드시 **음수**여야 합니다. 이미 끝난 활동이어야 결과가 있을 수 있으니까요.

### 현재 분포

```
카테고리  8종 전부 (3~6개씩)        상태  ACTIVE 24 · COMPLETED 10 · ENDED 4 · CANCELLED 1
기간      최근 8주에 분산            모집  RANGE 22 · MINIMUM 32
결과      10건 · 소감 25건 · 좋아요 115건
```

---

## 트렌드 대시보드

**위치를 아직 안 정했습니다.** 지금은 `/trends` 로 따로 있고 하단 탭에는 없습니다. Home 안으로 넣고 싶으면 `app/page.tsx` 에서 컴포넌트를 import 하면 됩니다 — **세 층으로 분리해 뒀기 때문에 옮겨도 안 깨집니다.**

```
lib/queries/stats.ts       집계 (화면과 무관)
components/trends/Charts   그래프 조각 4개 (독립적)
app/trends/page.tsx        조합만
```

### AI 해설을 고칠 때 — 중요

`app/api/ai/trends/route.ts` 의 프롬프트를 고치면 **`PROMPT_VERSION` 을 반드시 올리세요.**

```ts
const PROMPT_VERSION = 'trends-v2';   // → 'trends-v3'
```

`ai_runs` 테이블에 버전별 기록이 쌓입니다. **발표의 "검증·개선" 항목을 여기서 뽑습니다.**

실제로 이렇게 잡은 게 있습니다.

> `trends-v1` 은 "39개 액션 중 25개가 완료되어 참여율 64%"라는 **없는 통계를 만들어냈습니다.**
> 25는 소감을 쓴 *사람 수*였는데 AI가 *완료된 액션 수*로 읽은 겁니다.
> 필드 이름을 `소감까지_남긴_참여자_수` 로 바꾸고 "새 비율을 계산하지 말라"는 규칙을 추가해 `v2` 에서 해결했습니다.

**v1 기록을 지우지 마세요.** 발표에서 그대로 쓸 수 있습니다.

---

## 첫 작업 제안

### ① 시연 데이터를 현실감 있게 (반나절)

지금 제목이 조금 기계적입니다. 실제로 있을 법한 액션으로 바꾸면 발표 때 훨씬 그럴듯합니다.

### ② 트렌드 위치 결정 (팀과 상의)

`/trends` 로 둘지, Home 안에 넣을지, 하단 탭에 추가할지.

### ③ 발표 시나리오 리허설 (4주차에 반드시)

**계정 하나로 처음부터 끝까지** 돌려보세요.

```
가입 → 액션 만들기 → AI 검수 → 공개 → 추천에 노출 →
(다른 계정) 참여 → 게시판 → 결과 작성 → 소감 → MY 카운트
```

화면이 다 있어도 **중간에 한 번 끊기면 발표에서 그대로 보입니다.** 그리고 AI가 발표 중에 실패할 수 있으니, **미리 완성해 둔 액션을 백업 계정에 하나** 준비해두세요.

---

## 완료 기준

- [ ] `npm run build` 통과
- [ ] 참여 상태 3종의 배지와 버튼이 다르게 나온다
- [ ] 액션 상태 5종의 배지와 버튼이 다르게 나온다
- [ ] "나가기" 후 목록에서 사라지고 모집 숫자가 줄어든다
- [ ] DRAFT 삭제가 되고, ACTIVE 에는 삭제 버튼이 없다
- [ ] 취소하면 참여자에게 알림이 간다 (다른 계정으로 확인)
- [ ] 두 탭 모두 빈 상태 화면이 나온다
- [ ] 그래프 3종이 실제 DB 숫자로 그려진다
- [ ] **AI 해설의 숫자가 그래프와 맞다** (틀리면 프롬프트를 고치고 버전을 올린다)
- [ ] AI 호출이 실패해도 그래프는 나온다

---

---

## 이번 개편에서 할 일 (2026-09-01 합의)

> 전체 합의는 [06-개편-합의.md](./06-개편-합의.md). 아래 "첫 작업 제안"보다 이 목록이 실제 과제입니다.
>
> **✅ 민호의 준비 작업(문구 교체 · DB 변경 · 공용 함수)은 전부 끝났습니다. 바로 시작하시면 됩니다.**
> `git pull origin dev` 로 최신을 받고 시작해주세요.

### 지금 바로 할 수 있는 것

**F16 — "액션 보기" 버튼을 맨 왼쪽으로 (10분)**
버튼 순서만 바꾸면 됩니다. 파일: `components/action/ActivityButtons.tsx`

**F17 — 상태 표시를 카드 위쪽으로 (1시간)**
"액션 예정 / 액션 종료 / 참여 완료" 배지를 카드 **상단에 눈에 띄게** 올리고,
카드 아래쪽에 있던 배지와 **참여 형태 표시(예: 청소담당, 집게 2개)는 삭제**합니다.
파일: `app/activity/page.tsx`

> 📁 **알려드립니다** — `ActivityButtons.tsx` 안에 있던 **나가기 버튼이 별도 파일로 빠졌습니다**
> (`components/action/LeaveButton.tsx`, 개발 B 담당). 나가기 사유 남기기(F40)가 개발 B 과업이라
> 조장님 파일을 건드리지 않도록 분리했습니다. **화면 동작은 그대로**입니다.

**F37 — 모집 미달 시 호스트가 직접 판단 (반나절)**
모집 마감이 지났는데 최소 인원을 못 채우면 **자동으로 취소하지 않습니다.**
호스트가 보고 정하게 합니다.

호스트에게 **`SHORTFALL` 알림**이 자동으로 갑니다 (민호가 만들어 뒀습니다).
조장님이 할 일은 **Activity(내가 만든 탭)에서 그 상황을 보여주고 선택지를 주는 것**입니다.

- "그대로 진행" → 아무것도 안 하면 됩니다
- "액션 취소" → 이미 있는 `CancelActionButton` 을 그대로 쓰면 됩니다

미달 여부는 `getActionItems()` 의 `isMinMet` 으로 알 수 있습니다.

> ### ✅ 알림 생성은 민호가 연결해 뒀습니다
>
> `app/activity/page.tsx` 의 "내가 만든" 탭에서 `syncHostNotifications()` 를
> 이미 부르고 있습니다. **조장님은 화면만 만들면 됩니다.**
>
> 미달 상황을 확인하려면 `getActionItems()` 의 `isMinMet` 을 보세요.
> 알림 자체는 `/activity` 나 `/notifications` 중 어디를 열어도 만들어집니다.

### 이제 해도 됩니다 (민호 작업 완료됨)

**시드 데이터 다시 넣기 (10분)**
스키마가 바뀌므로 `npm run seed` 를 한 번 다시 돌립니다. 여러 번 돌려도 안전합니다.

**장소명을 채워주시면 좋겠습니다.** 이번에 `place_name` 컬럼이 생겼는데(F32) 시드에는 비어 있습니다.
"○○구민회관", "△△보호소" 처럼 상호가 들어가야 디자이너가 상세 화면을 만들 때
실제로 어떻게 보이는지 확인할 수 있습니다. `scripts/seed.mjs` 맨 위 `ACTIONS` 배열만 고치면 됩니다.

**연일 활동 예시도 하나 넣어주시면 좋겠습니다.** 개발 B가 F45(일정별 참가자)를 만드는데,
"1일차 배식팀 / 2일차 정리팀" 처럼 항목이 날짜로 나뉜 액션이 하나도 없으면 화면을 확인할 수 없습니다.

### 발표 준비 (병행)

[발표-AI-트러블슈팅.md](./발표-AI-트러블슈팅.md) 를 읽어보세요.
"AI를 어디까지 믿을 것인가"를 실제 사고 2건과 함께 정리한 자료인데,
발표의 "검증·개선" 파트에 그대로 쓸 수 있게 슬라이드 구성과 예상 질문·답까지 들어 있습니다.

---

# AI에게 시킬 때

**아래를 그대로 복사해서 앞에 붙이고, 원하는 작업을 이어서 쓰세요.**

```
## 프로젝트

착착(CHAK CHAK) — 봉사·나눔 활동(=액션)을 만들고 참여하고 결과를 나누는 모바일 웹.
Next.js 15 (App Router) · TypeScript · Tailwind CSS · Supabase · OpenAI gpt-4o-mini

## 내 담당

내 활동 화면 · 트렌드 대시보드 · 시연 데이터 · 발표 · 액션 찾기(Discover).
app/activity/ · app/trends/ · components/trends/ · app/api/ai/trends/
lib/queries/stats.ts · scripts/seed.mjs · components/action/ActivityButtons.tsx
scripts/data/ · scripts/reclassify_all_actions.mjs · scripts/batch_reclassify_active.mjs · scripts/check_seed_meta.mjs
app/discover/ · app/api/ai/discover/ · components/action/DiscoverChat.tsx
lib/utils/scoring.ts · lib/utils/discover-ranking.ts   (Discover 는 2026-09-29부터 내 담당)

lib/constants/regions.ts 는 가입·프로필과 같이 쓰는 개발 A 파일이다. 고칠 일이 있으면 개발 A 에게 말한다.
app/api/ai/classify/ (액션 자동 분류)는 아직 민호 담당이다.

화면은 이미 다 동작한다. 나는 써보고 어색한 곳을 고친다.

## 반드시 지킬 것

1. params 와 searchParams 는 Promise 다. 반드시 await 한다.
   const { tab } = await searchParams;

2. 데이터 읽기는 lib/queries/ 의 함수, 쓰기는 lib/mutations.ts 의 함수만 쓴다.
   화면에서 supabase.from(...) 을 직접 호출하지 않는다.
   getMyJoinedActions · getMyCreatedActions · getTrendStats
   deleteDraft · cancelAction
   (나가기 버튼은 components/action/LeaveButton.tsx 로 빠졌다. 개발 B 담당이다)

3. 쓰기 함수는 { ok: true, data } 또는 { ok: false, message } 를 돌려준다.
   message 는 그대로 사용자에게 보여주면 되는 한국어다. try/catch 를 쓰지 않는다.

4. 화면 문구는 lib/constants/index.ts 에서 가져온다. 문자열을 직접 적지 않는다.
   ACTION_STATUS_LABEL · PARTICIPATION_STATUS_LABEL · CATEGORIES

5. 탭은 주소로 구분한다 (/activity 와 /activity?tab=created).
   useState 로 탭을 관리하지 않는다. Link 로 이동하면 서버에서 데이터를 바로 가져올 수 있다.

6. 트렌드 집계에서 participations 를 직접 세지 않는다.
   RLS 때문에 비회원에게는 0 으로 보이고 사람마다 숫자가 달라진다.
   집계 전용 뷰(action_item_progress, action_social_counts)와 crew_voices 를 쓴다.
   이미 lib/queries/stats.ts 가 그렇게 되어 있으니 그대로 쓴다.

7. 트렌드 AI 프롬프트를 고치면 PROMPT_VERSION 을 반드시 올린다 (trends-v2 → v3).
   ai_runs 에 버전별 기록이 쌓이고, 발표의 검증·개선 근거가 된다.
   AI 에게 "주어진 숫자를 그대로 인용하고 새 비율을 계산하지 말라"고 지시한다.
   서로 다른 항목을 섞어 없는 통계를 만들어낸 적이 있다.
   "미래 예측"이 아니라 "현재 현황과 변화 패턴"으로 표현한다.
   AI 호출이 실패해도 그래프는 나와야 한다.

8. Recharts 를 쓰는 컴포넌트에는 'use client' 가 필요하다.
   차트는 components/trends/Charts.tsx 에 독립적으로 두고, 데이터는 props 로 받는다.
   차트가 직접 DB 를 조회하지 않는다. 그래야 Home 으로 옮겨도 안 깨진다.

9. 날짜 표시는 lib/utils/date.ts 를 쓴다.

10. 이미 있는 공통 컴포넌트를 쓴다. 비슷한 것을 새로 만들지 않는다.
    Button Badge StatusBadge ParticipationBadge EmptyState Toast
    ActionCard Header BottomNav

11. lib/ 과 components/ui/ 는 다섯 명이 함께 쓰는 공유 구역이다.
    lib/queries/stats.ts · lib/utils/scoring.ts · lib/utils/discover-ranking.ts 와
    components/trends/ 는 내 담당이라 고쳐도 된다.
    그 밖의 lib/ 파일은 수정하지 말고 "수정이 필요하다"고 알려준다.

12. 되돌릴 수 없는 동작(나가기·삭제·취소)에는 반드시 확인 창을 넣는다.

13. 목록 화면에는 빈 상태(EmptyState)를 반드시 넣는다. 다음 행동 버튼을 함께 준다.

14. 사용자에게 보이는 문구와 코드 주석은 한국어로 쓴다.

15. 새 파일·새 쿼리·새 상수를 만들기 전에, 이미 있는 것을 먼저 찾아 쓴다.

## 오늘 할 일

(여기에 원하는 작업을 적으세요. 예시)
scripts/seed.mjs 의 ACTIONS 배열에서 액션 제목과 소개글을
실제로 있을 법한 문장으로 바꿔줘. 배열 구조와 나머지 코드는 건드리지 말고
제목·소개·장소만 자연스럽게 고쳐줘.
```
