# Discover Conversation Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Discover의 고정 5문항 추천 구조를 유지하면서 환영, 답변 연결, 실제 데이터 기반 개인화, 추천 시작 및 조건 완화 문구를 자연스럽게 개선합니다.

**Architecture:** 질문 순서와 추천 시점은 기존 `interview.ts`가 계속 담당합니다. 같은 파일에 순수한 대화 문구 생성 함수를 추가해 단위 테스트하고, `route.ts`는 해당 함수를 호출해 일관된 문구를 반환합니다. 화면은 서버의 조건 완화 여부만 보고 하나의 자연스러운 안내를 표시합니다.

**Tech Stack:** Next.js 15, TypeScript, React 19, Node test runner, Zod

## Global Constraints

- 사용자는 정확히 5개의 질문에 답한 뒤 추천을 받습니다.
- 첫 질문은 재능 활용 여부이며, 답에 따라 재능 또는 참여 방식으로 갈라집니다.
- 프로필과 참여 이력에 없는 사실은 말하지 않습니다.
- Discover 재능 선택지는 `lib/constants/index.ts`의 `SKILLS`를 사용합니다.
- 후보 조회, 점수 계산, 추천 이유 생성, DB 스키마는 변경하지 않습니다.

---

### Task 1: 대화 문구 생성 규칙

**Files:**
- Modify: `app/api/ai/discover/interview.ts`
- Test: `tests/discover-interview.test.ts`

**Interfaces:**
- Produces: `getQuestionReply(key, context): string`
- Produces: `getRecommendationReply(context): string`

- [ ] **Step 1: 실패하는 대화 문구 테스트 작성**

첫 질문의 환영과 닉네임, 재능 미사용 답변의 안심 문장, 실제 참여 분야를 활용한 질문, 답변 기반 추천 요약을 리터럴 문장으로 검증합니다.

- [ ] **Step 2: 대상 테스트를 실행해 기존 코드에서 실패 확인**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test --experimental-strip-types tests/discover-interview.test.ts`

Expected: `getQuestionReply` 또는 `getRecommendationReply`가 없어 실패합니다.

- [ ] **Step 3: 최소 문구 생성 함수 구현**

`QuestionCopyContext`에 닉네임, 프로필 재능, 선택한 재능, 분야 기준, 참여 이력 여부, 누적 성향을 전달합니다. 함수는 실제로 전달된 값만 문장에 포함합니다.

- [ ] **Step 4: 대상 테스트 통과 확인**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test --experimental-strip-types tests/discover-interview.test.ts`

Expected: 모든 Discover 인터뷰 테스트가 통과합니다.

### Task 2: API 대화와 공통 재능 선택지 연결

**Files:**
- Modify: `app/api/ai/discover/route.ts`
- Test: `tests/discover-interview.test.ts`

**Interfaces:**
- Consumes: `getQuestionReply`, `getRecommendationReply`
- Consumes: `SKILLS`
- Produces: 기존 Discover JSON 응답 구조 유지

- [ ] **Step 1: 재능 옵션 계약 테스트 작성**

Discover의 `skills` 질문 선택지가 전달받은 프로필 공통 재능 목록과 같은 값과 순서를 반환하는지 확인합니다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test --experimental-strip-types tests/discover-interview.test.ts`

Expected: 공통 재능 옵션 함수가 없어 실패합니다.

- [ ] **Step 3: API에 문구와 공통 옵션 연결**

`QUESTION_OPTIONS.skills`의 묶음 문자열을 제거하고 `SKILLS`를 사용합니다. 질문 응답에서는 서버의 대화 문구를 사용하고, 다섯 답변 뒤에는 누적 성향 요약 문구를 사용합니다. AI 프롬프트에도 짧은 수용 문장과 근거 없는 개인화 금지를 명시합니다.

- [ ] **Step 4: 대상 테스트와 타입 검사 실행**

Run: `npm run typecheck`

Expected: 오류 없이 종료합니다.

### Task 3: 화면 안내 문구와 전체 검증

**Files:**
- Modify: `components/action/DiscoverChat.tsx`

**Interfaces:**
- Consumes: 기존 `relaxation: string[]`
- Produces: 조건 완화 시 사용자용 통합 안내 한 번 표시

- [ ] **Step 1: 화면 문구 수정**

진행 상태를 `맞춤 추천 준비 중 · n/5`, 로딩을 `답변을 살펴보고 있어요`로 바꿉니다. 조건 완화 배열에 값이 하나 이상 있으면 다음 문장을 한 번 표시합니다.

> 말씀해주신 조건에 맞는 액션이 많지 않아 비슷한 조건까지 조금 넓혀서 찾아봤어요. 최대한 비슷한 액션부터 보여드릴게요.

- [ ] **Step 2: 전체 검증 실행**

Run: `npm test`

Run: `npm run typecheck`

Run: `npm run lint`

Run: `npm run build`

Run: `git diff --check`

Expected: 테스트 실패 0개, 타입·린트·빌드·diff 검사 모두 성공합니다.

- [ ] **Step 3: 변경 파일 선별 커밋과 PR 생성**

대화 문구 관련 파일과 테스트·설계·계획 문서만 커밋합니다. 브랜치를 푸시하고 `dev` 대상 PR을 생성합니다.
