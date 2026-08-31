-- =============================================================
-- 05 — 초기 스키마 이후 수정분
--
-- 스키마를 바꿀 때는 01~03 파일을 고치지 말고 이렇게 새 파일을 쌓습니다.
-- 앞 파일을 고치면 이미 DB에 적용한 사람과 새로 받은 사람의 DB가 달라집니다.
--
-- SQL Editor 에 통째로 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.
-- =============================================================

-- -------------------------------------------------------------
-- action_ai_metadata 에 INSERT 정책이 없었다.
--
-- 증상: 액션을 공개하면 AI 분류는 성공하는데(ai_runs 에 CLASSIFY SUCCESS 기록)
--       action_ai_metadata 에는 행이 생기지 않는다. 오류도 안 난다.
--       그 결과 Discover 추천이 그 액션을 찾지 못한다.
--
-- 원인: RLS 를 켜고 SELECT / UPDATE 정책만 만들었다.
--       정책이 없는 동작은 조용히 거부된다.
-- -------------------------------------------------------------
DROP POLICY IF EXISTS ai_meta_insert ON action_ai_metadata;

CREATE POLICY ai_meta_insert ON action_ai_metadata
  FOR INSERT WITH CHECK (is_action_owner(action_id));

-- -------------------------------------------------------------
-- 확인용 — 아래를 실행하면 테이블별 정책 종류를 볼 수 있습니다.
-- 앞으로 테이블을 추가하면 이걸로 빠진 정책이 없는지 확인하세요.
-- -------------------------------------------------------------
-- SELECT tablename, cmd, policyname
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, cmd;
