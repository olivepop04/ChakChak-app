# AI에게 코드를 시킬 때 — 공통 제약

> 이 내용은 **각 역할 문서에도 그대로 들어 있습니다.** 역할 문서 하나만 AI에게 줘도 됩니다.
> 이 파일은 규칙이 바뀌었을 때 **어디를 고쳐야 하는지 찾기 쉽게** 모아둔 원본입니다.
> (수정하면 `docs/01~05`의 같은 블록도 함께 고쳐주세요.)

---

## 복사해서 쓰는 블록

```
## 프로젝트

착착(CHAK CHAK) — 봉사·나눔 활동(=액션)을 만들고 참여하고 결과를 나누는 모바일 웹.
Next.js 15 (App Router) · TypeScript · Tailwind CSS · Supabase · OpenAI gpt-4o-mini

## 반드시 지킬 것

1. params 와 searchParams 는 Promise 다. 반드시 await 한다.
   const { id } = await params;

2. 데이터 읽기는 lib/queries/ 의 함수, 쓰기는 lib/mutations.ts 의 함수만 쓴다.
   화면에서 supabase.from(...) 이나 supabase.rpc(...) 를 직접 호출하지 않는다.
   필요한 함수가 없으면 새로 만들지 말고 "없다"고 알려준다.

3. 쓰기 함수는 { ok: true, data } 또는 { ok: false, message } 를 돌려준다.
   message 는 그대로 사용자에게 보여주면 되는 한국어다. try/catch 를 쓰지 않는다.

4. 화면 문구는 lib/constants/index.ts 에서 가져온다. 문자열을 직접 적지 않는다.
   ACTION_STATUS_LABEL · PARTICIPATION_STATUS_LABEL · CATEGORIES ·
   TIME_DAYS · TIME_SLOTS · GENDER_LABEL · GENDER_REQUIREMENT_LABEL · LIMITS · UPLOAD

5. 모집 수량 표시는 lib/utils/quota.ts 의 함수를 쓴다. 숫자를 직접 조합하지 않는다.
   getQuotaState · describeTarget · describeResult · describeResultCount · meetsGender

6. 날짜 표시는 lib/utils/date.ts 를 쓴다.
   formatDate · formatDateShort · formatTime · formatActivityPeriod · formatRelative

7. 이미 있는 공통 컴포넌트를 쓴다. 비슷한 것을 새로 만들지 않는다.
   components/ui/     Button Badge Chip EmptyState Toast Avatar ActionCard
                      ImageUploader RegionPicker UserList LogoutButton
                      ToggleButtons(LikeButton SaveButton FollowButton)
   components/layout/ Header BottomNav
   components/action/ QuotaProgress ActionGallery AddressBox ItemEditor 등

8. lib/ 과 components/ui/ 는 다섯 명이 함께 쓰는 공유 구역이다.
   담당이 아니면 수정하지 않는다. 수정이 필요하면 "수정이 필요하다"고 알려준다.

9. 서버 컴포넌트가 기본이다. 'use client' 는 훅·이벤트·브라우저 API 가
   필요할 때만 쓴다. 데이터 조회는 서버에서 하고 버튼만 클라이언트로 뺀다.

10. 목록 화면에는 빈 상태(EmptyState)를 반드시 넣는다. 다음 행동 버튼을 함께 준다.

11. 사용자에게 보이는 문구와 코드 주석은 한국어로 쓴다.
    에러 메시지는 무엇이 잘못됐고 어떻게 고치는지 알려준다. "오류가 발생했습니다" 금지.

12. 새 파일·새 쿼리·새 상수를 만들기 전에, 이미 있는 것을 먼저 찾아 쓴다.
```

---

## 왜 이렇게까지 적는가

조원마다 다른 AI에게 다른 방식으로 물어보면 **같은 프로젝트 안에 다섯 가지 코드 스타일**이 생깁니다.
쿼리를 각자 짜면 같은 데이터가 화면마다 다르게 보이고, 문구를 직접 적으면 "모집 중"과 "모집중"이 섞입니다.

**AI에게 "새로 만들지 말고 있는 걸 써라"고 못 박는 것이 핵심입니다.**
이 말이 없으면 AI는 매번 자기 방식으로 처음부터 만듭니다.
