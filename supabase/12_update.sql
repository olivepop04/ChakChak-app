-- =============================================================
-- 12 — 조기 종료, 그리고 취소는 활동 시작 전까지만
--
-- SQL Editor 에 통째로 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.
--
-- 2026-09-04 「상태별 기능 및 버튼 최종 가이드(조기종료 포함)」 반영입니다.
--
--   취소      활동이 시작되기 전에 없던 일이 됨   → 내가 만든 액션에 안 셈
--   조기 종료  활동은 했는데 예정보다 일찍 끝남    → 내가 만든 액션에 셈
--
-- 카운팅은 손댈 게 없습니다. 취소는 CANCELLED, 조기 종료는 ENDED 이고,
-- 지금 쓰는 집계가 이미 ACTIVE·ENDED·COMPLETED 만 세고 있습니다.
--
-- ⚠️ 이 파일은 03(cancel_action)이 만든 것을 덮어씁니다.
--    03 을 다시 실행했다면 이 파일도 다시 실행하세요.
-- =============================================================


-- -------------------------------------------------------------
-- ① 조기 종료 공지를 담을 채팅 종류                     (06 확장)
--
-- 사유를 어디에 보여줄지 정하면서, 나가기 사유와 같은 방식을 골랐습니다.
-- 새 컬럼도 새 화면도 필요 없고, 크루가 크루챗을 열면 바로 보입니다.
-- 나가기 사유처럼 지울 수 없어야 하므로 11 의 삭제 차단도 함께 넓힙니다.
-- -------------------------------------------------------------
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_kind_check;
ALTER TABLE chat_messages
  ADD CONSTRAINT chat_messages_kind_check
  CHECK (kind IN ('NORMAL', 'LEFT_NOTICE', 'EARLY_END_NOTICE'));


-- -------------------------------------------------------------
-- ② 조기 종료 알림 종류                                 (08 확장)
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
    'SHORTFALL',         -- 모집 마감 + 최소 미달 → 호스트 (lazy)
    'EARLY_END'          -- 호스트가 활동을 일찍 종료 → 크루 (12)
  ));


-- -------------------------------------------------------------
-- ③ 취소는 활동 시작 전까지만                            (가이드)
--
-- 지금까지는 status 만 봤습니다(ACTIVE·ENDED). 시간을 안 봐서,
-- 활동이 이미 시작됐거나 끝난 액션도 취소할 수 있었습니다.
-- 실제로 불러서 확인한 동작입니다.
--
-- 나가기는 09 에서 같은 이유로 이미 고쳤는데 취소를 같이 안 고쳤습니다.
-- 여기서 맞춥니다 — 나가기와 똑같이 시계를 직접 봅니다.
--
-- ⚠️ 이 변경으로 ENDED 액션은 취소할 수 없게 됩니다.
--    활동 날짜가 지났는데 아무도 안 왔다면 호스트는 결과에
--    "참여자가 없었다" 고 적게 됩니다. 지난 날짜를 없던 일로 만드는 것보다
--    기록으로 정확하다고 보고 이렇게 정했습니다.
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION cancel_action(p_action_id UUID, p_reason TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_action actions%ROWTYPE;
BEGIN
  SELECT * INTO v_action FROM actions WHERE id = p_action_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '액션을 찾을 수 없습니다.';
  END IF;
  IF v_action.owner_id <> auth.uid() THEN
    RAISE EXCEPTION '본인이 만든 액션만 취소할 수 있습니다.';
  END IF;
  IF v_action.status <> 'ACTIVE' THEN
    RAISE EXCEPTION '모집 중인 액션만 취소할 수 있습니다.';
  END IF;

  -- 활동 시작 시각을 직접 본다 (09 의 나가기와 같은 방식)
  IF v_action.activity_start_at IS NOT NULL
     AND v_action.activity_start_at <= now() THEN
    RAISE EXCEPTION '활동이 시작된 뒤에는 취소할 수 없어요. 활동 중이라면 조기 종료를 쓰세요.';
  END IF;

  IF char_length(trim(COALESCE(p_reason, ''))) < 5 THEN
    RAISE EXCEPTION '취소 사유를 5자 이상 적어주세요.';
  END IF;

  UPDATE actions
     SET status = 'CANCELLED', cancel_reason = trim(p_reason)
   WHERE id = p_action_id;

  INSERT INTO notifications (user_id, type, action_id, event_key)
  SELECT p.user_id, 'CANCELLED', p_action_id,
         'CANCELLED:' || p_action_id || ':' || p.user_id
  FROM participations p
  WHERE p.action_id = p_action_id AND p.status <> 'LEFT'
  ON CONFLICT (event_key) DO NOTHING;
END;
$$;


-- -------------------------------------------------------------
-- ④ 조기 종료                                            (신규)
--
-- 활동 중에만 쓸 수 있습니다. 하는 일은 sync_action_status 가
-- 예정 종료 시각에 하던 것과 같고, 시각을 앞당기는 것뿐입니다.
--
--   ENDED 로 전환 → 참여자를 AFTER_ACTION 으로 → 호스트에게 결과 작성 알림
--   + 크루챗에 사유 공지, 크루에게 알림
--
-- 사유를 필수로 받는 이유는 크루 입장에서 "왜 일찍 끝났는지" 를
-- 알 수 없으면 참여 기록만 남고 설명이 사라지기 때문입니다.
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

  -- ② 종료
  UPDATE actions SET status = 'ENDED' WHERE id = p_action_id;

  UPDATE participations
     SET status = 'AFTER_ACTION'
   WHERE action_id = p_action_id AND status = 'BEFORE_ACTION';

  -- ③ 호스트에게 결과 작성 요청
  --    sync_action_status 와 같은 event_key 를 씁니다.
  --    예정 종료 시각이 나중에 지나도 알림이 두 번 가지 않습니다.
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

GRANT EXECUTE ON FUNCTION end_action_early(UUID, TEXT) TO authenticated;


-- -------------------------------------------------------------
-- ⑤ 조기 종료 공지도 지울 수 없다                       (11 확장)
--
-- 11 에서 참여 취소 사유(LEFT_NOTICE)를 못 지우게 막았습니다.
-- 조기 종료 공지도 같은 성격입니다 — 크루에게 남기는 기록이고,
-- 호스트가 지우면 "왜 일찍 끝났는지" 가 사라집니다.
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION delete_chat_message(p_message_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_owner UUID;
  v_kind  TEXT;
BEGIN
  SELECT user_id, kind INTO v_owner, v_kind
  FROM chat_messages WHERE id = p_message_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION '글을 찾을 수 없습니다.';
  END IF;
  IF v_owner <> v_uid THEN
    RAISE EXCEPTION '본인이 쓴 글만 삭제할 수 있습니다.';
  END IF;

  IF v_kind = 'LEFT_NOTICE' THEN
    RAISE EXCEPTION '참여 취소 사유는 지울 수 없어요. 크루들에게 남기는 기록입니다.';
  END IF;
  IF v_kind = 'EARLY_END_NOTICE' THEN
    RAISE EXCEPTION '조기 종료 사유는 지울 수 없어요. 크루들에게 남기는 기록입니다.';
  END IF;

  UPDATE chat_messages
     SET deleted_at = now()
   WHERE (id = p_message_id OR parent_id = p_message_id)
     AND deleted_at IS NULL;
END;
$$;


-- =============================================================
-- 확인 — npm run verify:db 가 [17] 구간에서 검사합니다
--
--   활동 시작 뒤 취소 거절 · 시작 전 취소는 허용
--   ENDED 액션 취소 거절
--   활동 전 조기 종료 거절 · 활동 중 조기 종료 허용
--   조기 종료 뒤 상태가 ENDED · 참여자가 AFTER_ACTION
--   조기 종료 공지는 크루챗에 남고 지울 수 없음
--   조기 종료된 액션도 "내가 만든 액션" 에 계속 셈
-- =============================================================
