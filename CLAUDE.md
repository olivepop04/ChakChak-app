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

**4. 참여 신청·소감 저장은 반드시 RPC로** — `.insert()`를 여러 번 부르면 트랜잭션이 아닙니다. 아래 함수를 쓰세요.

```ts
await supabase.rpc('join_action', { p_action_id: id, p_items: items });
await supabase.rpc('submit_crew_voice', { p_action_id: id, p_content: text });
```

**5. 진행률은 뷰에서 읽으세요** — `action_item_progress`. 카드마다 합계 쿼리를 돌리면 피드에서 쿼리가 수십 번 나갑니다.

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
