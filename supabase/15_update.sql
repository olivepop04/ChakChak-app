-- =============================================================
-- 15 — 조기 종료 사유를 액션 상세에서도 읽을 수 있게
--
-- SQL Editor 에 통째로 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.
--
-- 「UI 및 기획 수정 4」 2쪽:
--   "조기종료 사유 작성시 처리는 취소사유 작성 방식과 동일하게
--    => 액션상세 페이지 상단에 메시지 띄우기"
--
-- ─────────────────────────────────────────────────────────────
-- 왜 필요한가
--
-- 12 에서 조기 종료 사유를 크루챗 공지로 남기게 했습니다. 그때는
-- "새 컬럼도 새 화면도 필요 없다" 는 게 장점이었습니다.
--
-- 그런데 액션 상세 상단에 띄우려니 문제가 생깁니다 —
-- 크루챗은 **참여한 사람만** 읽을 수 있습니다. 취소 사유는
-- actions.cancel_reason 이라 누구나 보는데, 조기 종료 사유만
-- 크루챗에 있으면 같은 자리에 같은 방식으로 못 띄웁니다.
--
-- 그래서 취소 사유와 똑같이 컬럼에도 남깁니다.
-- 크루챗 공지는 그대로 둡니다 — 대화 흐름 속의 기록이라 의미가 다릅니다.
-- ─────────────────────────────────────────────────────────────
-- =============================================================


-- -------------------------------------------------------------
-- ① 컬럼 추가
-- -------------------------------------------------------------
ALTER TABLE actions
  ADD COLUMN IF NOT EXISTS early_end_reason TEXT;

COMMENT ON COLUMN actions.early_end_reason IS
  '호스트가 활동을 일찍 끝낸 이유. end_action_early() 가 채웁니다 (15)';


-- -------------------------------------------------------------
-- ② 이미 조기 종료된 액션의 사유를 크루챗에서 옮겨오기
--
-- 12 이후에 조기 종료한 액션이 있다면 그 사유가 크루챗에만 있습니다.
-- 컬럼으로 한 번 복사해 둡니다.
-- -------------------------------------------------------------
UPDATE actions a
   SET early_end_reason = m.content
  FROM (
    SELECT DISTINCT ON (action_id) action_id, content
      FROM chat_messages
     WHERE kind = 'EARLY_END_NOTICE' AND deleted_at IS NULL
     ORDER BY action_id, created_at
  ) m
 WHERE a.id = m.action_id
   AND a.early_end_reason IS NULL;


-- -------------------------------------------------------------
-- ③ 조기 종료할 때 컬럼에도 남기기
--
-- ⚠️ 12_update.sql 의 함수를 덮어씁니다.
--    12 를 다시 실행했다면 이 파일도 다시 실행하세요.
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION end_action_early(p_action_id UUID, p_reason TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_action actions%ROWTYPE;
  v_uid    UUID := auth.uid();
  v_reason TEXT := btrim(COALESCE(p_reason, ''));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT * INTO v_action FROM actions WHERE id = p_action_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '액션을 찾을 수 없습니다.';
  END IF;
  IF v_action.owner_id <> v_uid THEN
    RAISE EXCEPTION '본인이 만든 액션만 종료할 수 있습니다.';
  END IF;
  IF v_action.status <> 'ACTIVE' THEN
    RAISE EXCEPTION '진행 중인 액션만 종료할 수 있어요.';
  END IF;

  -- 활동 중인가 — 시작했고, 아직 예정 종료 전인가
  IF v_action.activity_start_at IS NULL
     OR v_action.activity_start_at > now() THEN
    RAISE EXCEPTION '아직 활동이 시작되지 않았어요. 시작 전이라면 취소를 쓰세요.';
  END IF;
  IF v_action.activity_end_at IS NOT NULL
     AND v_action.activity_end_at <= now() THEN
    RAISE EXCEPTION '이미 활동이 끝난 액션이에요. 결과를 작성하시면 됩니다.';
  END IF;

  IF char_length(v_reason) < 5 THEN
    RAISE EXCEPTION '일찍 종료하는 이유를 5자 이상 적어주세요. 크루들에게 전해집니다.';
  END IF;
  IF char_length(v_reason) > 1000 THEN
    RAISE EXCEPTION '종료 사유는 1000자까지 적을 수 있어요.';
  END IF;

  -- ① 사유를 먼저 남긴다 (나가기와 같은 이유로 순서를 함수 안에 고정)
  INSERT INTO chat_messages (action_id, user_id, content, kind)
  VALUES (p_action_id, v_uid, v_reason, 'EARLY_END_NOTICE');

  -- ② 종료 — 사유를 컬럼에도 남깁니다 (15).
  --    크루챗은 참여한 사람만 읽을 수 있어서, 액션 상세 상단에
  --    띄우려면 누구나 읽을 수 있는 자리가 따로 필요합니다.
  UPDATE actions
     SET status = 'ENDED', early_end_reason = v_reason
   WHERE id = p_action_id;

  UPDATE participations
     SET status = 'AFTER_ACTION'
   WHERE action_id = p_action_id AND status = 'BEFORE_ACTION';

  -- ③ 호스트에게 결과 작성 요청
  --    sync_action_status 와 같은 event_key 라 알림이 두 번 가지 않습니다.
  INSERT INTO notifications (user_id, type, action_id, event_key)
  VALUES (v_action.owner_id, 'RESULT_REQUEST', p_action_id,
          'RESULT_REQUEST:' || p_action_id)
  ON CONFLICT (event_key) DO NOTHING;

  -- ④ 크루에게 조기 종료 알림
  INSERT INTO notifications (user_id, type, action_id, body, event_key)
  SELECT p.user_id, 'EARLY_END', p_action_id, v_reason,
         'EARLY_END:' || p_action_id || ':' || p.user_id
  FROM participations p
  WHERE p.action_id = p_action_id
    AND p.status <> 'LEFT'
    AND p.user_id <> v_uid
  ON CONFLICT (event_key) DO NOTHING;
END;
$$;


-- =============================================================
-- 확인 — npm run verify:db 가 [17] 구간에서 함께 검사합니다
--
--   조기 종료 뒤 actions.early_end_reason 에 사유가 들어감
--   비회원·미참여자도 그 값을 읽을 수 있음 (크루챗과 달리)
-- =============================================================
