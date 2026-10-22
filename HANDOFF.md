# HANDOFF — 착착(CHAK CHAK) 고도화 인수인계

> 마지막 갱신: 2026-10-22 (노트북 반납 전, 마지막 정리)
> 새 세션은 **"HANDOFF.md 읽고 이어서 하자"** 로 시작하세요. 규칙·기술 함정은 `CLAUDE.md` 에 있습니다.
> 세션을 끝낼 때마다 이 파일을 **덮어써서** 현재 상태로 유지합니다(번호 붙여 쌓지 않음).

## 1. 프로젝트 한눈에

- **착착** = 누구나 쉽게 좋은 일(액션)을 만들고 함께 나누는 **Good Action SNS** (영어 정의는 "Social Action Network" 아님)
- 스택: Next.js 15 (App Router) · TypeScript · Tailwind · Supabase (DB·Auth·Storage) · OpenAI · Vercel
- AI 3종: **Review AI**(공개 전 검수 PASS·REVISE·BLOCK) · **Classify AI**(공개 시 7대 메타데이터) · **Discover AI**(대화형 추천)
- 저장소: `https://github.com/olivepop04/ChakChak-app.git` — 기본 브랜치 `main`
- 팀 프로젝트(5인)는 끝났고, **2026-10-14부터 혼자 고도화** 중. 발표자료 작업은 끝남(더 할 일 없음)

## 2. 현재 상태 (2026-10-22 확인)

- Git: `main` 이 `origin/main` 과 같음, 커밋 안 된 변경 없음. 최신 커밋 `d525bd4` (CLAUDE.md 1인용 정리)
- remote: `origin` = 내 레포, `team` = 옛 팀 레포(`minho880910-spec/final_proj`, push 막음 `no_push`)
- 박제: `proj_mvp` 브랜치(GitHub Ruleset으로 잠금) + `v1.0-mvp` 태그 = 팀 MVP 최종본
- Supabase: 내 조직 "ChakChak" / 프로젝트 "ChakChak-app" (ref `hjme…`, 서울). `supabase/01~22` 실행(04 제외), Confirm email 끔, 시드 완료, 내 계정 admins 등록
- Vercel: 내 Hobby 공간의 `chakchak-app`, 운영 배포 Ready. `main` 에 push → 자동 배포
- 관리자 화면 주소는 `/admin/feedback` (`/admin` 은 없음)

## 3. 확정된 결정과 이유

- **`main` 에서 바로 작업·push.** 혼자라 dev 브랜치·PR 병합 불필요. 큰 작업만 feature 브랜치 → Vercel 미리보기로 확인
- **DB 변경은 콘솔에서 직접 하지 말고 `supabase/23_….sql` 처럼 파일로 쌓기.** Supabase 무료 플랜엔 자동 백업이 없어서 SQL 파일이 백업 역할
- **AI는 Function Calling이 아니라 JSON 모드 + zod 검증.** AI는 판단·문장만, 점수·순위·공개 결정은 코드와 사람이 함
- AI 실패 시 앱은 멈추지 않고 기본값으로 대체(Review는 공개 허용, Classify는 기본값, Discover는 고정 문구)
- `CLAUDE.md` 의 팀원 이름은 "누가 정했는지의 기록"일 뿐. `docs/00~05` 는 팀 시절 문서

## 4. 건드리면 안 되는 것 / 주의

- `proj_mvp` 브랜치, `v1.0-mvp` 태그에 push 금지
- `supabase/02`·`03` 단독 재실행 금지, `04_seed.sql` 실행 금지
- `main` push = 실제 사이트 즉시 반영 → push 전 `npm run dev` 확인, 가능하면 `npm test`
- `SUPABASE_SERVICE_ROLE_KEY` 는 절대 `NEXT_PUBLIC_` 붙이지 말 것, 공유 금지
- Supabase 무료 플랜은 **1주일 미사용 시 일시정지** → 대시보드에서 Restore. 보여주기 전에 켜져 있는지 확인
- Vercel 환경변수를 바꾸면 **Redeploy** 해야 반영됨

## 5. 남은 일 / 고도화 후보

- [ ] **OpenAI 키 교체 대비**: 지금은 교육기관 지원 키라 곧 끊길 수 있음. 끊겨도 화면에 티가 안 남
  - 확인: `CLAUDE.md` 「보안」의 키 점검 명령 (`401` 폐기 / `429 insufficient_quota` 크레딧 소진)
  - 교체: `.env.local` + Vercel 환경변수 → Redeploy → `npm run reclassify` (미리보기) → `npm run reclassify -- --apply`
  - 내 키로 바꾸면 OpenAI **월 사용 한도**(예: $5~10) 꼭 설정
- [ ] Supabase **Site URL / Redirect URLs** 에 Vercel 주소가 들어가 있는지 확인 (`https://<vercel주소>`, `<vercel주소>/**`, `http://localhost:3000/**`)
- [ ] `.env.team.local` 의 `SUPABASE_SERVICE_ROLE_KEY` 줄 삭제(내 키가 잘못 들어가 있음) — 새 PC로는 옮기지 않아도 됨
- [ ] 고도화 기능 목록은 **아직 정하지 않음** → 새 PC 첫 세션에서 정하기
  - 사업화 검토(2026-10-08) 결론: 개인(B2C) 앱으로는 수익화 어려움. 하려면 **기업 ESG·사내 봉사, 지자체·학교용 사회공헌 운영 도구(B2B)** 방향. 지원사업 전에 담당자 인터뷰·소규모 파일럿·LOI 확보 권장
  - `CLAUDE.md` 가 861줄로 길어 매 세션 비용이 큼 → 핵심만 남기고 상세는 `docs/` 로 나누는 정리도 후보

## 6. 새 PC에서 실행하기

1. 설치: **Git**, **Node.js 24** (노트북은 v24.15.0), VS Code, Claude 데스크톱 앱
2. 받기 (VS Code 터미널 — 노트북에선 **cmd** 였음):
   ```
   git clone https://github.com/olivepop04/ChakChak-app.git
   cd ChakChak-app
   npm install
   ```
3. 프로젝트 최상위에 `.env.local` 만들기 (값은 따로 보관해 둔 것 / 각 대시보드에서 다시 복사):
   ```
   NEXT_PUBLIC_SUPABASE_URL=        # Supabase → Project Settings → Data API
   NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Supabase → API Keys → anon
   SUPABASE_SERVICE_ROLE_KEY=       # Supabase → API Keys → service_role (Reveal)
   OPENAI_API_KEY=                  # platform.openai.com
   ```
4. 실행: `npm run dev` → `http://localhost:3000` (DB는 이미 Supabase에 있으니 시드 다시 안 해도 됨)
5. 점검: `npm test`, `npm run typecheck`, 필요 시 `npm run verify:db`
6. (선택) 팀 레포를 다시 참고할 일이 있으면:
   ```
   git remote add team https://github.com/minho880910-spec/final_proj.git
   git remote set-url --push team no_push
   ```

## 7. Claude와 일하는 방식 (메모리는 새 PC로 안 넘어가서 여기 적어 둠)

- 인프라(Git·Supabase·Vercel) 작업은 **직접 하길 원함** → Claude는 화면 메뉴 위치까지 단계별로 안내, 명령은 하나씩 코드 블록으로. 읽기 전용 확인은 Claude가 해도 됨
- 터미널은 **cmd 기준**으로 명령 안내 (`cp`·`Copy-Item` 안 됨 → `copy`)
- **세션 = 목표 하나.** 끝나면 이 HANDOFF.md 갱신, 다음 목표는 새 세션
- 숫자·코드 동작은 근거(파일:줄)를 대고, 확인한 것과 추정한 것을 구분해서 말하기

## 8. 새 PC 첫 세션에서 할 일

1. 6번대로 실행 환경 세팅 → 로컬에서 로그인·홈 화면 확인
2. OpenAI 키 상태 점검 (끊겼으면 5번 절차대로 교체)
3. 고도화 목표 정하기 → 이 파일 5번 갱신
