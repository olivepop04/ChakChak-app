# 착착 (CHAK CHAK)

좋은 일(**액션**)을 만들고, 참여하고, 결과까지 함께 나누는 모바일 웹 서비스입니다.

- **Next.js 15** (App Router) · TypeScript · Tailwind CSS
- **Supabase** — 데이터베이스 · 로그인 · 파일 저장
- **OpenAI** gpt-4o-mini — AI 에이전트 3종
- **Vercel** 배포

---

## 🔰 처음이신가요?

**설치부터 테스트까지 하나하나 짚어주는 문서가 따로 있습니다.**

### 👉 [docs/사용설명서.md](docs/사용설명서.md)

Node.js 설치 · 코드 받기 · **`.env.local` 값을 직접 발급받는 법** · 실행 · 화면별 테스트 ·
**어떤 버튼을 누르면 어디에 무엇이 저장되는지**까지 전부 들어 있습니다.

아래 내용은 그걸 마친 뒤에 보시면 됩니다.

---

## 목차

1. [처음 시작하기](#1-처음-시작하기)
2. [매일 하는 작업 흐름](#2-매일-하는-작업-흐름)
3. [내가 맡은 부분 찾기](#3-내가-맡은-부분-찾기)
4. [데이터 다루는 법](#4-데이터-다루는-법)
5. [폴더 구조](#5-폴더-구조)
6. [막혔을 때](#6-막혔을-때)

---

## 1. 처음 시작하기

### 1-1. 준비물 확인

터미널(Windows는 **Git Bash** 또는 PowerShell)을 열고 아래를 하나씩 쳐보세요.

```bash
node -v
```

`v20` 이상이 나와야 합니다. 아무것도 안 나오거나 버전이 낮으면 [nodejs.org](https://nodejs.org)에서 **LTS 버전**을 설치하세요.

```bash
git --version
```

버전이 안 나오면 [git-scm.com](https://git-scm.com)에서 설치하세요.

### 1-2. 코드 받기

```bash
git clone https://github.com/minho880910-spec/final_proj.git
```

```bash
cd final_proj
```

### 1-3. 라이브러리 설치

```bash
npm install
```

2~3분 걸립니다. `node_modules` 폴더가 생기면 성공입니다. 이 폴더는 git에 올라가지 않으니 신경 쓰지 않아도 됩니다.

> **warning가 여러 줄 나와도 정상입니다.** `error`만 아니면 넘어가세요.

### 1-4. 환경변수 파일 만들기

민호에게 받은 값을 넣을 파일을 직접 만듭니다.

```bash
echo NEXT_PUBLIC_SUPABASE_URL= > .env.local
```

> 파일 하나를 만드는 것일 뿐입니다. VS Code 에서 새 파일을 `.env.local` 로 만들어도 같습니다.
>
> ⚠️ **윈도우는 확장자를 숨깁니다.** 메모장으로 만들면 `.env.local.txt` 가 되기 쉬우니,
> 탐색기 → 보기 → **"파일 확장명"** 을 켜고 확인하세요.

`.env.local` 파일을 열면 이렇게 생겼습니다.

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
OPENAI_API_KEY=sk-...
```

**값을 직접 발급받는 방법은 [사용설명서 4장](docs/사용설명서.md#4-최초-환경설정)에 화면 경로까지 적어 두었습니다.**

- Supabase 값 3개 → 대시보드에서 각자 복사 (민호에게 프로젝트 초대를 먼저 받으세요)
- OpenAI 키 → 각자 발급 (담당이 아니면 비워 둬도 개발에 지장 없습니다)

> ⚠️ **이 파일은 절대 git에 올리면 안 됩니다.** `.gitignore`에 이미 등록돼 있으니 그냥 두시면 됩니다.
> 그리고 **키를 카톡·디스코드로 주고받지 마세요.** 캡처가 남고 대화방은 검색됩니다.

### 1-5. 실행해보기

```bash
npm run dev
```

터미널에 `Ready in ...` 이 뜨면 브라우저에서 **http://localhost:3000** 을 여세요.

Supabase 값을 아직 안 채웠다면 노란 안내 상자가 보입니다. **정상입니다.** 화면 아래쪽에 모집 표시 예시와 아바타가 보이면 설치가 제대로 된 것입니다.

끄고 싶으면 터미널에서 `Ctrl + C`.

---

## 2. 매일 하는 작업 흐름

### 2-1. 작업 시작할 때

**항상 최신 코드를 먼저 받으세요.** 이걸 건너뛰면 나중에 충돌이 크게 납니다.

```bash
git checkout dev && git pull origin dev
```

그 다음 **내 작업용 브랜치**를 만듭니다. 이름은 `feature/이름-화면` 형식으로.

```bash
git checkout -b feature/민호-알림화면
```

### 2-2. 작업하는 중

파일을 고치고 저장하면 브라우저가 자동으로 새로고침됩니다. 계속 그렇게 만들어 나가면 됩니다.

### 2-3. 올리기 전에 반드시

```bash
npm run build
```

**이게 통과해야 올립니다.** 타입 오류가 있는 코드가 `dev`에 들어가면 다음 사람이 전부 막힙니다.
오류가 나면 메시지에 파일 이름과 줄 번호가 나오니 그곳을 고치세요.

### 2-4. 올리기

```bash
git add -A && git commit -m "feat: 알림 목록 화면 추가"
```

```bash
git push -u origin feature/민호-알림화면
```

터미널에 GitHub 링크가 뜹니다. 그걸 눌러 **Pull request**를 만들고, **받는 브랜치가 `dev`인지** 확인한 뒤 만드세요. `main`으로 가면 안 됩니다.

### 2-5. 커밋 메시지 쓰는 법

앞에 종류를 붙이고 한국어로 무엇을 했는지 씁니다.

| 앞머리 | 언제 |
|---|---|
| `feat:` | 새 기능을 만들었을 때 |
| `fix:` | 잘못된 걸 고쳤을 때 |
| `style:` | 화면 모양만 바꿨을 때 |
| `refactor:` | 동작은 같은데 코드를 정리했을 때 |
| `docs:` | 문서만 고쳤을 때 |

---

## 3. 내가 맡은 부분 찾기

문서가 여러 개인 이유는 이렇습니다. **찾을 게 정해져 있습니다.**

| 무엇이 궁금할 때 | 볼 문서 |
|---|---|
| 어떻게 설치하고 실행하나 | `docs/사용설명서.md` |
| 우리 팀은 어떻게 일하나 | `docs/00-공통규칙.md` |
| 코드가 어떻게 생겼나 | `CLAUDE.md` |
| **내가 무엇을 맡았나 · AI에게 뭐라고 시키나** | **`docs/01~05` 중 본인 것** |


> 💡 **각 역할 문서는 혼자서도 완결된 브리핑입니다.**
> 그 파일 하나만 AI에게 통째로 주고 "이거 해줘"라고 해도 되도록, 지켜야 할 제약을 안에 다 넣어 두었습니다.
> 문서 맨 아래에 **복사해서 쓰는 프롬프트**가 있습니다.

| 담당 | 문서 |
|---|---|
| 처음 시작 (필독) | [docs/사용설명서.md](docs/사용설명서.md) — 설치·실행·테스트 |
| 모두 (필독) | [docs/00-공통규칙.md](docs/00-공통규칙.md) — 우리가 어떻게 일하나 |
| 민호 — 통합·인프라·알림 | [docs/01-민호-통합.md](docs/01-민호-통합.md) |
| 조장 — Activity·트렌드·시드 | [docs/02-조장-activity.md](docs/02-조장-activity.md) |
| 디자이너 — UI·Home·Detail | [docs/03-디자인-ui.md](docs/03-디자인-ui.md) |
| 개발 A — 가입·프로필·Discover | [docs/04-개발A-auth-discover.md](docs/04-개발A-auth-discover.md) |
| 개발 B — 만들기·참여·게시판·결과 | [docs/05-개발B-join-result.md](docs/05-개발B-join-result.md) |
| **이번 개편 (전원 필독)** | [docs/06-개편-합의.md](docs/06-개편-합의.md) — 2026-09-01 합의와 작업 순서 |
| 확정 43건 전체 목록 | [docs/07-확정-43건.md](docs/07-확정-43건.md) — F번호가 뭘 뜻하는지 |

그리고 [CLAUDE.md](./CLAUDE.md)에 팀 규칙과 결정 사항이 정리돼 있습니다. **AI에게 코드를 짜달라고 할 때도 이 파일을 같이 읽히면** 결과가 훨씬 일관됩니다.

---

## 4. 데이터 다루는 법

**이 부분이 가장 중요합니다.** 여기만 지키면 오류가 크게 줄어듭니다.

### 4-1. 규칙 두 줄

> **읽을 때는 `lib/queries/` 의 함수를 부른다.**
> **쓸 때는 `lib/mutations.ts` 의 함수를 부른다.**

`supabase.from('actions').select(...)` 같은 코드를 **화면에 직접 쓰지 마세요.** 사람마다 조건을 다르게 걸어서 같은 데이터가 화면마다 다르게 보이게 됩니다.

### 4-2. 읽기 예시 (서버 컴포넌트)

```tsx
// app/page.tsx
import { createClient } from '@/lib/supabase/server';
import { getActionFeed } from '@/lib/queries/actions';
import { ActionCard } from '@/components/ui/ActionCard';

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const actions = await getActionFeed(supabase, { viewerId: user?.id ?? null });

  return (
    <div className="flex flex-col gap-4 p-5">
      {actions.map((a) => <ActionCard key={a.id} action={a} />)}
    </div>
  );
}
```

### 4-3. 쓰기 예시 (클라이언트 컴포넌트)

`mutations` 함수는 **성공/실패와 사람이 읽을 수 있는 메시지**를 돌려줍니다. `try/catch`를 쓰지 않아도 됩니다.

```tsx
'use client';
import { createClient } from '@/lib/supabase/client';
import { joinAction } from '@/lib/mutations';
import { useRouter } from 'next/navigation';

export function JoinButton({ actionId, items }) {
  const router = useRouter();

  async function handleClick() {
    const supabase = createClient();
    const res = await joinAction(supabase, actionId, items);

    if (!res.ok) {
      alert(res.message);   // "「요리 담당」 모집이 완료되었습니다. (3 / 3)"
      return;
    }
    router.push(`/action/${actionId}/welcome`);
  }

  return <button onClick={handleClick}>참여 확정하기</button>;
}
```

### 4-4. 서버용? 클라이언트용?

| 상황 | 쓰는 것 |
|---|---|
| 파일 맨 위에 `'use client'`가 **없다** | `import { createClient } from '@/lib/supabase/server'` → **`await createClient()`** |
| 파일 맨 위에 `'use client'`가 **있다** | `import { createClient } from '@/lib/supabase/client'` → **`createClient()`** (await 없음) |

버튼 클릭·입력처럼 사용자가 조작하는 부분만 `'use client'`로 만들고, 데이터를 불러와 보여주기만 하는 화면은 서버 컴포넌트로 두는 게 빠릅니다.

### 4-5. 필요한 조회 함수가 없다면

`lib/queries/`에 직접 추가하지 말고 **민호에게 먼저 말해주세요.** 이 폴더는 다섯 명이 함께 쓰는 공유 구역이라 각자 고치면 충돌이 납니다.

---

## 5. 폴더 구조

```
app/                     화면 (파일 경로 = 웹 주소)
  page.tsx               →  /
  action/[id]/page.tsx   →  /action/어떤아이디
components/
  ui/                    공통 UI  ⚠️ 공유 구역
  layout/                헤더·하단탭  ⚠️ 공유 구역
  action/                액션 관련 컴포넌트
lib/                     ⚠️ 공유 구역 — 고치기 전에 말하기
  queries/               데이터 읽기 함수
  mutations.ts           데이터 쓰기 함수
  supabase/              접속 설정 (건드릴 일 없음)
  constants/             카테고리·상태 등 모든 상수
  utils/quota.ts         모집 수량 표시 규칙 ★
  types/                 타입 정의
supabase/                DB SQL 파일
docs/사용설명서.md        ★ 처음이면 이것부터
docs/                    담당별 작업 가이드
middleware.ts            로그인 확인 (건드릴 일 없음)
CLAUDE.md                팀 규칙 ★ 먼저 읽기
```

**⚠️ 공유 구역**을 고쳐야 하면 팀 채팅에 먼저 알려주세요. 그 외 본인 담당 폴더는 마음껏 고치셔도 됩니다.

---

## 6. 막혔을 때

### 화면에 아무것도 안 나오고 빈 목록만 보여요

**십중팔구 RLS(권한 설정)입니다.** 에러가 안 나고 조용히 빈 배열이 돌아오기 때문에 찾기 어렵습니다.

1. 로그인은 되어 있나요?
2. 그 데이터를 볼 권한이 있는 사용자인가요? (예: 게시판은 참여자만 볼 수 있습니다)
3. `supabase/02_rls.sql`에서 해당 테이블 정책을 확인하세요.

### `params.id`가 undefined예요

Next.js 15에서는 `params`가 **Promise**입니다.

```tsx
// ❌ 안 됨
export default function Page({ params }: { params: { id: string } }) {
  const id = params.id;
}

// ✅ 맞음
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
}
```

검색해서 나오는 예제 대부분이 구버전이라 **다들 한 번씩 여기서 막힙니다.**

### `Module not found` 오류

`npm install`을 다시 해보세요. 그래도 안 되면 `node_modules` 폴더를 지우고 다시 설치합니다.

```bash
rm -rf node_modules package-lock.json && npm install
```

### `npm run build`가 실패해요

타입 오류입니다. 메시지에 `파일이름.tsx(줄번호,글자번호): error TS...` 형태로 위치가 나옵니다. 그 줄을 보세요.
자주 나는 원인은 **`null`일 수 있는 값을 그냥 쓴 것**입니다. `값?.속성` 이나 `값 ?? 기본값`으로 처리하세요.

### git에서 충돌(conflict)이 났어요

**혼자 해결하려다 남의 코드를 지우는 일이 자주 생깁니다.** 민호에게 화면 캡처와 함께 물어보세요.
급하면 이렇게 원래 상태로 되돌릴 수 있습니다(내 작업도 사라지니 주의).

```bash
git merge --abort
```

### 그래도 모르겠으면

팀 채팅에 **① 무엇을 하려 했는지 ② 오류 메시지 전체 캡처 ③ 어느 파일인지** 세 가지를 함께 올려주세요. 이 세 가지가 있으면 대부분 몇 분 안에 풀립니다.

---

## 개발자용 명령 모음

```bash
npm run dev
```

```bash
npm run build
```

```bash
npm run typecheck
```

시연용 데이터를 채우거나 지웁니다. (로컬 전용)

```bash
npm run seed
```

```bash
npm run seed:clean
```

스키마를 바꾼 뒤 권한·정원·성별 제한이 실제로 막히는지 확인합니다.

```bash
npm run verify:db
```

---

## DB 세팅 (최초 1회 · 민호 담당)

Supabase 대시보드 → **SQL Editor**에서 순서대로 실행합니다.

| 순서 | 파일 | 내용 |
|---|---|---|
| 1 | `supabase/01_schema.sql` | 테이블 15개 · 뷰 · 트리거 |
| 2 | `supabase/02_rls.sql` | 권한 정책 전체 · 파일 저장소 |
| 3 | `supabase/03_functions.sql` | 참여·소감·상태 전환 함수 |
| 4 | `supabase/05_fixes.sql` | 권한 보완 (AI 분류 저장) |
| 5 | `supabase/06_update.sql` | 알림 설정 · 참여 시간 · 장소명 · 나가기 사유 · 수정 잠금 |
| 6 | `supabase/07_update.sql` | 참여 항목 공개 범위 (크루끼리 사람 항목만) |
| 7 | `supabase/08_update.sql` | 모집 미달 알림 |
| 8 | `supabase/09_update.sql` | 나가기의 시간 빈틈 막기 (활동 시작 후 나가기 차단) |

**번호 순서대로 전부 실행하세요.** 하나라도 빠뜨리면 앱이 조용히 깨집니다.
예를 들어 06 을 안 돌리면 장소명·알림 설정·나가기 사유가 통째로 동작하지 않습니다.

한 파일씩 통째로 붙여넣고 실행하세요. 나눠서 하면 어디까지 적용됐는지 알 수 없게 됩니다.

> `04_seed.sql` 은 실행하지 않습니다 — 시연 데이터는 SQL이 아니라 `npm run seed` 로 넣습니다.

> ⚠️ **이미 적용한 뒤 특정 파일만 다시 돌리지 마세요.**
> 뒤 파일이 앞 파일의 내용을 덮어쓴 곳이 있어서, 앞 파일만 재실행하면 **뒤 내용이 사라집니다.**
> 다시 돌려야 하면 **그 번호부터 끝까지 순서대로** 돌리세요.

> **새 SQL 파일을 만들면 이 표에도 한 줄 추가하세요.** 이 표가 곧 세팅 순서입니다.

실행 후 타입 파일을 자동 생성본으로 교체합니다.

```bash
npx supabase gen types typescript --project-id <프로젝트ID> > lib/types/database.ts
```

**이후 스키마 변경은 콘솔에서 직접 하지 말고** `supabase/05_....sql`처럼 새 파일로 쌓으세요.
