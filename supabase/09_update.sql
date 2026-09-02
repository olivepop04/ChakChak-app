-- =============================================================
-- 09 — 나가기의 시간 빈틈 막기
--
-- SQL Editor 에 통째로 붙여넣고 실행하세요.
--
-- ⚠️ 이 파일은 03(leave_action)과 06(leave_action_with_reason)이 만든
--    함수를 덮어씁니다. 03 이나 06 을 단독 재실행하면 이 수정이 사라지니,
--    다시 돌릴 일이 있으면 반드시 09 까지 순서대로 돌리세요.
-- =============================================================


-- -------------------------------------------------------------
-- 무엇이 문제였나
--
-- 나가기 함수 둘 다 "참여 상태가 BEFORE_ACTION 인가" 만 봤습니다.
-- 그런데 상태 전환(BEFORE_ACTION → AFTER_ACTION)은 누군가 액션을
-- 열어야 일어나는 lazy 방식입니다.
--
-- 그래서 활동이 이미 끝났는데 아무도 그 액션을 안 열었으면:
--   actions.status        = ACTIVE        (ENDED 로 안 바뀜)
--   participations.status = BEFORE_ACTION (AFTER_ACTION 으로 안 바뀜)
-- 이 틈에 나가기가 통과했습니다. 실측으로 확인한 버그입니다.
--
--   · 집계에서 빠져 결과의 참여 인원이 실제보다 적게 기록되고
--   · 끝난 활동 게시판에 "참여 취소" 사유 글이 올라가고
--   · "활동이 시작된 뒤에는 나갈 수 없습니다" 라는 문구가 거짓이 됩니다
--
-- 고치는 법
--   참여 상태와 무관하게 활동 시작 시각을 직접 봅니다.
--   시계는 lazy 전환과 달리 누가 열어주지 않아도 정확합니다.
-- -------------------------------------------------------------


-- -------------------------------------------------------------
-- ① leave_action — 사유 없이 나가기 (03 의 함수 + 시간 검사)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION leave_action(p_action_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_status TEXT;
  v_start  TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  -- 활동 시작 시각을 직접 본다. lazy 상태 전환을 기다리지 않는다. (09)
  SELECT activity_start_at INTO v_start FROM actions WHERE id = p_action_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '없는 액션입니다.';
  END IF;
  IF v_start IS NOT NULL AND v_start <= now() THEN
    RAISE EXCEPTION '활동이 시작된 뒤에는 나갈 수 없습니다.';
  END IF;

  SELECT status INTO v_status
  FROM participations WHERE action_id = p_action_id AND user_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION '참여 내역이 없습니다.';
  END IF;
  IF v_status <> 'BEFORE_ACTION' THEN
    RAISE EXCEPTION '활동이 시작된 뒤에는 나갈 수 없습니다.';
  END IF;

  UPDATE participations
     SET status = 'LEFT', left_at = now()
   WHERE action_id = p_action_id AND user_id = v_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION leave_action(UUID) TO authenticated;


-- -------------------------------------------------------------
-- ② leave_action_with_reason — 사유 남기고 나가기 (06 의 함수 + 시간 검사)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION leave_action_with_reason(
  p_action_id UUID,
  p_reason    TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_owner  UUID;
  v_status TEXT;
  v_start  TIMESTAMPTZ;
  v_reason TEXT := btrim(coalesce(p_reason, ''));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  IF char_length(v_reason) < 5 THEN
    RAISE EXCEPTION '나가는 이유를 5자 이상 적어주세요. 함께하기로 한 크루들에게 전해집니다.';
  END IF;
  IF char_length(v_reason) > 1000 THEN
    RAISE EXCEPTION '나가는 이유는 1000자까지 적을 수 있어요.';
  END IF;

  SELECT owner_id, activity_start_at INTO v_owner, v_start
  FROM actions WHERE id = p_action_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION '없는 액션입니다.';
  END IF;

  -- 활동 시작 시각을 직접 본다. lazy 상태 전환을 기다리지 않는다. (09)
  IF v_start IS NOT NULL AND v_start <= now() THEN
    RAISE EXCEPTION '활동이 시작된 뒤에는 나갈 수 없습니다.';
  END IF;

  SELECT status INTO v_status
  FROM participations WHERE action_id = p_action_id AND user_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION '참여 내역이 없습니다.';
  END IF;
  IF v_status <> 'BEFORE_ACTION' THEN
    RAISE EXCEPTION '활동이 시작된 뒤에는 나갈 수 없습니다.';
  END IF;

  -- ① 사유를 먼저 남긴다
  --    화면에서 나눠 부르면 나가는 순간 게시판 권한이 사라져 글이 안 올라갑니다.
  --    그래서 순서를 함수 안에 고정해 두었습니다.
  INSERT INTO chat_messages (action_id, user_id, content, kind)
  VALUES (p_action_id, v_uid, v_reason, 'LEFT_NOTICE');

  -- ② 나가기
  --    left_at 을 반드시 함께 채웁니다.
  --    CONSTRAINT left_at_set 이 (status='LEFT') = (left_at IS NOT NULL) 을 강제합니다.
  UPDATE participations
  SET status = 'LEFT', left_at = now()
  WHERE action_id = p_action_id AND user_id = v_uid;

  -- ③ 호스트에게 알림 (자기 액션에서 나가는 경우는 제외)
  IF v_owner <> v_uid THEN
    INSERT INTO notifications (user_id, type, action_id, body, event_key)
    VALUES (
      v_owner, 'LEFT_CREW', p_action_id, v_reason,
      'LEFT_CREW:' || p_action_id || ':' || v_uid || ':' ||
        extract(epoch FROM now())::BIGINT
    )
    ON CONFLICT (event_key) DO NOTHING;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION leave_action_with_reason(UUID, TEXT) TO authenticated;
