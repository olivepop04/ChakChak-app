-- =============================================================
-- 08 — 모집 미달 알림 (F37)
--
-- SQL Editor 에 통째로 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.
-- =============================================================


-- -------------------------------------------------------------
-- SHORTFALL — 모집이 마감됐는데 최소 인원/수량을 못 채웠을 때 (F37)
--
-- 팀 합의: 자동으로 취소하지 않습니다. 호스트가 직접 판단합니다.
--
--   "그대로 진행" — 아무것도 안 하면 됩니다
--   "취소"       — 기존 cancel_action() 을 부릅니다
--
-- 그래서 새로 필요한 건 "호스트가 이 상황을 알게 하는 것" 하나뿐입니다.
-- 컬럼을 늘리지 않고 알림 한 종류만 추가합니다.
--
-- 알림 자체는 lib/notifications/lazy.ts 가 만듭니다.
-- 정해진 시각에 도는 서버가 없어서, 호스트가 알림·Activity 화면을 열 때
-- 조건을 확인해 만드는 방식(lazy)입니다. SCHEDULE·VOICE_REQUEST 와 같습니다.
-- -------------------------------------------------------------
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'SCHEDULE',          -- 활동 전날 (lazy)
    'RESULT_REQUEST',    -- ENDED 전환 → 호스트
    'RESULT_PUBLISHED',  -- COMPLETED 전환 → 크루
    'VOICE_REQUEST',     -- COMPLETED + 5일 (lazy)
    'CANCELLED',         -- 취소 → 크루
    'INVITED',           -- 공유 → 대상 회원
    'LEFT_CREW',         -- 크루가 참여 취소 → 호스트
    'SHORTFALL'          -- 모집 마감 + 최소 미달 → 호스트 (lazy)
  ));
