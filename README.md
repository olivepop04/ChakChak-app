# GOOD

좋은 일(액션)을 만들고, 참여하고, 결과까지 공유하는 모바일 웹 서비스입니다.

- Next.js 15 (App Router) · TypeScript · Tailwind CSS
- Supabase (PostgreSQL · Auth · Storage)
- OpenAI gpt-4o-mini · Recharts
- Vercel 배포

개발 규칙과 결정 사항은 [CLAUDE.md](./CLAUDE.md)에 있습니다. **먼저 읽어주세요.**

---

## 처음 세팅 (팀원용)

### 1. 코드 받기

```bash
git clone <저장소 주소>
cd final_proj
npm install
```

### 2. 환경변수

`.env.local.example`을 `.env.local`로 복사하고 값을 채웁니다.

```bash
cp .env.local.example .env.local
```

Supabase 값은 대시보드의 **Project Settings → API**에 있습니다.
`.env.local`은 git에 올라가지 않습니다. **키를 메신저로 주고받지 마세요.**

### 3. 실행

```bash
npm run dev
```

http://localhost:3000 을 엽니다. Supabase 연결 전에도 화면은 뜹니다.

---

## DB 만들기 (최초 1회, 민호가 진행)

Supabase 대시보드 → **SQL Editor**에서 아래 순서대로 실행합니다.

| 순서 | 파일 | 내용 |
|---|---|---|
| 1 | `supabase/01_schema.sql` | 테이블 14개 · 뷰 · 트리거 |
| 2 | `supabase/02_rls.sql` | RLS 정책 전체 · Storage 버킷 |
| 3 | `supabase/03_functions.sql` | RPC 함수 (참여·소감·상태 전환) |
| 4 | `supabase/04_seed.sql` | 시연용 더미 데이터 |

한 파일씩 통째로 붙여넣고 실행하세요. 나눠서 하면 어디까지 적용됐는지 알 수 없게 됩니다.

**이후 스키마 변경은 콘솔에서 직접 하지 말고** `supabase/05_...sql` 처럼 새 파일로 쌓습니다.

타입 파일은 스키마를 올린 뒤 다시 생성합니다.

```bash
npx supabase gen types typescript --project-id <프로젝트ID> > lib/types/database.ts
```

---

## 폴더 구조

```
app/                  화면 (App Router)
components/
  ui/                 공통 UI — 공유 구역. 고칠 때 먼저 말하기
  layout/             헤더·하단탭
  action/             액션 관련 컴포넌트
lib/
  supabase/           클라이언트 3종 (브라우저·서버·미들웨어)
  constants/          카테고리·시간·상태 등 모든 상수
  utils/quota.ts      모집 수량 표시 규칙 ★
  openai.ts           AI 호출 공통 함수 (서버 전용)
  types/database.ts   DB 타입 (자동 생성으로 교체할 것)
supabase/             SQL
middleware.ts         세션 갱신 + 보호 경로
```

---

## 자주 쓰는 명령

```bash
npm run dev
```

```bash
npm run typecheck
```

```bash
npm run build
```

PR을 올리기 전에 `npm run build`가 통과하는지 확인해주세요.
