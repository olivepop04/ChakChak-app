-- =============================================================
-- 13 — 취소된 액션은 더 이상 반응할 수 없게
--
-- SQL Editor 에 통째로 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.
--
-- 「UI 및 기획 수정 4」 18쪽:
--   "취소된 이후에도 좋아요 / 저장 / 공유 가능함
--    => 취소즉시 불가로 변경하고 취소되서 안된다는 메시지 띄우기"
--
-- 실제로 세 가지 다 됐습니다. 막는 규칙이 아예 없었습니다.
--
-- ⚠️ 이 파일은 02(likes·saves 정책)와 10(notify_invite)이 만든 것을
--    덮어씁니다. 02·10 을 다시 실행했다면 이 파일도 다시 실행하세요.
-- =============================================================


-- -------------------------------------------------------------
-- ① 취소된 액션에는 좋아요를 누를 수 없다
--
-- 이미 눌러둔 것은 그대로 둡니다. 지우면 "내가 뭘 좋아했었지" 가
-- 사라지고, 취소는 호스트 사정이지 크루 잘못이 아니기 때문입니다.
-- 새로 누르는 것만 막습니다. 취소도 계속 됩니다(DELETE 는 그대로).
-- -------------------------------------------------------------
DROP POLICY IF EXISTS likes_insert ON likes;
CREATE POLICY likes_insert ON likes
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND action_status(action_id) <> 'CANCELLED'
  );


-- -------------------------------------------------------------
-- ② 저장도 같은 규칙
-- -------------------------------------------------------------
DROP POLICY IF EXISTS saves_insert ON saves;
CREATE POLICY saves_insert ON saves
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND action_status(action_id) <> 'CANCELLED'
  );


-- -------------------------------------------------------------
-- ③ 공유(친구에게 보내기)도 막는다
--
-- is_action_public() 은 "DRAFT 가 아닌가" 만 봅니다. 그래서 취소된
-- 액션도 통과했습니다. 취소 여부를 따로 봅니다.
--
-- ⚠️ 10_update.sql 의 함수를 덮어씁니다.
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION notify_invite(p_action_id UUID, p_target UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;
  IF p_target = auth.uid() THEN
    RAISE EXCEPTION '자기 자신에게는 공유할 수 없습니다.';
  END IF;
  IF NOT is_action_public(p_action_id) THEN
    RAISE EXCEPTION '공개된 액션만 공유할 수 있습니다.';
  END IF;

  -- 취소된 액션은 공유할 수 없습니다 (13)
  IF action_status(p_action_id) = 'CANCELLED' THEN
    RAISE EXCEPTION '취소된 액션은 공유할 수 없어요.';
  END IF;

  INSERT INTO notifications (user_id, type, action_id, event_key)
  VALUES (p_target, 'INVITED', p_action_id,
          'INVITED:' || p_action_id || ':' || p_target)
  ON CONFLICT (event_key) DO NOTHING;

  -- 공유 수 집계용 기록 (10)
  INSERT INTO shares (action_id, user_id, target_id)
  VALUES (p_action_id, auth.uid(), p_target);
END;
$$;


-- =============================================================
-- 확인 — npm run verify:db 가 [18] 구간에서 검사합니다
--
--   취소된 액션에 좋아요 · 저장 · 공유 거절
--   취소 전에 눌러둔 좋아요는 그대로 남고, 해제도 됨
--   취소되지 않은 액션은 전부 그대로 동작
-- =============================================================
