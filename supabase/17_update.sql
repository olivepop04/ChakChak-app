-- =============================================================
-- 17. 계정을 지울 수 있게 만들기 (2026-09-11)
-- =============================================================
--
-- 실제로 막혀 있었습니다. 계정에 크루챗 글이나 참여 기록이 하나라도 있으면
-- Supabase 의 계정 삭제가 이렇게 실패합니다.
--
--     Database error deleting user
--
-- profiles.id 는 auth.users(id) 를 ON DELETE CASCADE 로 참조합니다.
-- 그래서 계정을 지우면 profiles 행까지 함께 지워져야 하는데,
-- 아래 네 테이블이 profiles 를 ON DELETE 절 없이(= NO ACTION) 참조해서
-- 그 CASCADE 를 막아버렸습니다.
--
--     참조하는 곳                 ON DELETE
--     likes · saves · follows     CASCADE      ← 괜찮음
--     notifications               CASCADE      ← 괜찮음
--     ai_runs                     SET NULL     ← 괜찮음 (발표용 로그는 남는다)
--     participations              (없음)       ← 막음
--     crew_voices                 (없음)       ← 막음
--     chat_messages               (없음)       ← 막음
--     actions                     (없음)       ← 막음
--
-- 더 나빴던 것은 **실패가 조용했다**는 점입니다.
-- scripts/verify-db.mjs 와 scripts/seed.mjs 가 deleteUser() 의 에러를 보지 않아서,
-- 지워지지 않은 계정을 "삭제 완료" 로 찍고 넘어갔습니다.
-- 그래서 test-owner-… 같은 계정이 DB 에 계속 남아 있었습니다.
-- 스크립트 쪽도 같이 고쳤습니다.
--
-- 여기서는 "그 사람 본인이 남긴 것" 세 개만 CASCADE 로 바꿉니다.

ALTER TABLE participations DROP CONSTRAINT IF EXISTS participations_user_id_fkey;
ALTER TABLE participations
  ADD CONSTRAINT participations_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE crew_voices DROP CONSTRAINT IF EXISTS crew_voices_user_id_fkey;
ALTER TABLE crew_voices
  ADD CONSTRAINT crew_voices_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_user_id_fkey;
ALTER TABLE chat_messages
  ADD CONSTRAINT chat_messages_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ─────────────────────────────────────────────────────────────
-- actions.owner_id 는 일부러 그대로 둡니다
-- ─────────────────────────────────────────────────────────────
--
-- 여기까지 CASCADE 로 열면, 계정 하나를 지울 때 그 사람이 만든 액션이
-- **다른 사람들이 이미 참여한 것까지 포함해서** 조용히 사라집니다.
-- 크루들의 참여 기록과 소감도 함께 없어집니다.
--
-- 호스트를 지울 때는 그 액션을 어떻게 할지 먼저 정해야 하므로,
-- "그냥 지워지는 것" 보다 "막히는 것" 이 맞습니다.
-- 시드·검증 스크립트는 이미 액션을 먼저 지운 다음 계정을 지웁니다.

COMMENT ON CONSTRAINT chat_messages_user_id_fkey ON chat_messages IS
  '계정을 지우면 그 사람이 쓴 글도 함께 사라집니다. '
  '나가기 사유(LEFT_NOTICE)도 마찬가지지만, 사유는 호스트에게 간 알림(notifications.body)에 '
  '따로 남아 있어서 호스트가 내용을 잃지는 않습니다.';

-- ─────────────────────────────────────────────────────────────
-- 확인용 (직접 돌려볼 때)
-- ─────────────────────────────────────────────────────────────
-- SELECT c.conname, c.confdeltype
-- FROM pg_constraint c
-- JOIN pg_class t ON t.oid = c.conrelid
-- WHERE c.confrelid = 'profiles'::regclass
-- ORDER BY t.relname;
--   confdeltype: 'a' = NO ACTION · 'c' = CASCADE · 'n' = SET NULL
