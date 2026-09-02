-- =============================================================
-- 착착(CHAK CHAK) — RPC 함수 (비즈니스 규칙)
-- 02_rls.sql 다음에 실행한다.
--
-- ⚠️ 단독 재실행 금지 (2026-09-01 추가)
--    이 파일이 만든 leave_action() 을 09_update.sql 이 덮어씁니다
--    (활동 시작 후 나가기 차단). 이 파일만 다시 돌리면 그 검사가 사라집니다.
--    다시 돌려야 하면 03 뒤에 05 → 06 → 07 → 08 → 09 를 순서대로 돌리세요.
--
-- 왜 함수로 만드는가
--  Supabase 클라이언트로는 트랜잭션을 쓸 수 없다.
--  .insert() 를 여러 번 호출하는 건 트랜잭션이 아니라서
--  중간에 실패하면 앞의 것만 저장된 채로 남는다.
--  Postgres 함수 안은 통째로 하나의 트랜잭션이다.
--
--  정원 초과는 특히 위험하다. "합계 조회 → 확인 → 저장" 을 따로 하면
--  두 사람이 동시에 신청할 때 둘 다 통과한다(race condition).
--  아래 함수는 FOR UPDATE 로 항목 행을 잠가서 순서대로 처리한다.
--
-- 호출: supabase.rpc('join_action', { p_action_id, p_items })
-- =============================================================

-- -------------------------------------------------------------
-- join_action — 참여 확정
--   p_items 형식: [{"action_item_id": "uuid", "quantity": 1}, ...]
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION join_action(p_action_id UUID, p_items JSONB)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid            UUID := auth.uid();
  v_gender         TEXT;
  v_action         actions%ROWTYPE;
  v_item           action_items%ROWTYPE;
  v_participation  UUID;
  v_entry          JSONB;
  v_qty            INT;
  v_current        INT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION '참여할 항목을 하나 이상 선택해주세요.';
  END IF;

  SELECT gender INTO v_gender FROM profiles WHERE id = v_uid;

  -- 액션 확인
  SELECT * INTO v_action FROM actions WHERE id = p_action_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '액션을 찾을 수 없습니다.';
  END IF;
  IF v_action.status <> 'ACTIVE' THEN
    RAISE EXCEPTION '지금은 참여를 신청할 수 없는 액션입니다.';
  END IF;
  IF v_action.recruit_end_at IS NOT NULL AND v_action.recruit_end_at < now() THEN
    RAISE EXCEPTION '모집이 마감되었습니다.';
  END IF;
  IF v_action.owner_id = v_uid THEN
    RAISE EXCEPTION '내가 만든 액션에는 참여할 수 없습니다.';
  END IF;

  -- 기존 참여 확인 (나갔던 사람은 다시 신청할 수 있게 한다)
  SELECT id INTO v_participation
  FROM participations WHERE action_id = p_action_id AND user_id = v_uid;

  IF v_participation IS NOT NULL THEN
    IF (SELECT status FROM participations WHERE id = v_participation) <> 'LEFT' THEN
      RAISE EXCEPTION '이미 참여 중인 액션입니다.';
    END IF;
    -- 재참여: 이전 선택을 지우고 다시 담는다
    DELETE FROM participation_items WHERE participation_id = v_participation;
    UPDATE participations
       SET status = 'BEFORE_ACTION', left_at = NULL
     WHERE id = v_participation;
  ELSE
    INSERT INTO participations (action_id, user_id, status)
    VALUES (p_action_id, v_uid, 'BEFORE_ACTION')
    RETURNING id INTO v_participation;
  END IF;

  -- 항목별 검증
  FOR v_entry IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_entry->>'quantity')::INT;

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION '수량은 1 이상이어야 합니다.';
    END IF;

    -- ★ 여기서 항목 행을 잠근다. 동시 신청이 순서대로 처리된다.
    SELECT * INTO v_item
    FROM action_items
    WHERE id = (v_entry->>'action_item_id')::UUID
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION '모집 항목을 찾을 수 없습니다.';
    END IF;
    IF v_item.action_id <> p_action_id THEN
      RAISE EXCEPTION '이 액션의 항목이 아닙니다.';
    END IF;

    -- 사람 항목은 1명만 신청할 수 있다
    IF v_item.type = 'PERSON' AND v_qty <> 1 THEN
      RAISE EXCEPTION '사람 항목은 1명으로만 신청할 수 있습니다.';
    END IF;

    -- 성별 제한 확인
    IF v_item.gender_requirement <> 'ANY' AND v_item.gender_requirement <> v_gender THEN
      RAISE EXCEPTION '「%」 항목은 성별 조건이 맞지 않아 참여할 수 없습니다.', v_item.name;
    END IF;

    -- 정원 확인 (MINIMUM 은 max 가 NULL 이라 초과 개념이 없다)
    IF v_item.max_allowed IS NOT NULL THEN
      SELECT COALESCE(SUM(pi.quantity), 0) INTO v_current
      FROM participation_items pi
      JOIN participations p ON p.id = pi.participation_id
      WHERE pi.action_item_id = v_item.id AND p.status <> 'LEFT';

      IF v_current + v_qty > v_item.max_allowed THEN
        RAISE EXCEPTION '「%」 모집이 완료되었습니다. (% / %)',
          v_item.name, v_current, v_item.max_allowed;
      END IF;
    END IF;

    INSERT INTO participation_items (participation_id, action_item_id, quantity)
    VALUES (v_participation, v_item.id, v_qty);
  END LOOP;

  RETURN v_participation;
END;
$$;

-- -------------------------------------------------------------
-- leave_action — 나가기
-- 행은 남기고 status 만 LEFT 로. 집계(action_item_progress)에서 자동 제외된다.
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION leave_action(p_action_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_status TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
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

-- -------------------------------------------------------------
-- submit_crew_voice — 소감 저장 + 상태 전환을 한 트랜잭션으로
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION submit_crew_voice(p_action_id UUID, p_content TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_status TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;
  IF char_length(trim(p_content)) < 10 THEN
    RAISE EXCEPTION '소감은 10자 이상 작성해주세요.';
  END IF;

  SELECT status INTO v_status
  FROM participations WHERE action_id = p_action_id AND user_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION '참여하지 않은 액션입니다.';
  END IF;
  IF v_status = 'LEFT' THEN
    RAISE EXCEPTION '참여를 취소한 액션에는 소감을 남길 수 없습니다.';
  END IF;
  IF v_status = 'BEFORE_ACTION' THEN
    RAISE EXCEPTION '활동이 끝난 뒤에 소감을 남길 수 있습니다.';
  END IF;

  INSERT INTO crew_voices (action_id, user_id, content)
  VALUES (p_action_id, v_uid, trim(p_content));

  UPDATE participations
     SET status = 'ACTUALLY_PARTICIPATED'
   WHERE action_id = p_action_id AND user_id = v_uid;
END;
$$;

-- -------------------------------------------------------------
-- delete_chat_message — 본인 글 삭제 (soft delete)
-- 원글을 지우면 딸린 댓글도 함께 지운다.
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION delete_chat_message(p_message_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_owner UUID;
BEGIN
  SELECT user_id INTO v_owner
  FROM chat_messages WHERE id = p_message_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION '글을 찾을 수 없습니다.';
  END IF;
  IF v_owner <> v_uid THEN
    RAISE EXCEPTION '본인이 쓴 글만 삭제할 수 있습니다.';
  END IF;

  UPDATE chat_messages
     SET deleted_at = now()
   WHERE (id = p_message_id OR parent_id = p_message_id)
     AND deleted_at IS NULL;
END;
$$;

-- -------------------------------------------------------------
-- publish_action — DRAFT → ACTIVE
-- AI 검수는 이 함수 밖(API Route)에서 먼저 돌린다.
-- 여기서는 코드가 확인할 수 있는 것만 최종 점검한다.
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION publish_action(p_action_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_action    actions%ROWTYPE;
  v_item_cnt  INT;
BEGIN
  SELECT * INTO v_action FROM actions WHERE id = p_action_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '액션을 찾을 수 없습니다.';
  END IF;
  IF v_action.owner_id <> auth.uid() THEN
    RAISE EXCEPTION '본인이 만든 액션만 공개할 수 있습니다.';
  END IF;
  IF v_action.status <> 'DRAFT' THEN
    RAISE EXCEPTION '이미 공개된 액션입니다.';
  END IF;

  -- 날짜 3종 (CHECK 는 NULL 을 통과시키므로 여기서 확인한다)
  IF v_action.recruit_end_at IS NULL
     OR v_action.activity_start_at IS NULL
     OR v_action.activity_end_at IS NULL THEN
    RAISE EXCEPTION '모집 마감일과 활동 일시를 모두 입력해주세요.';
  END IF;
  IF v_action.activity_end_at < now() THEN
    RAISE EXCEPTION '이미 지난 날짜로는 공개할 수 없습니다.';
  END IF;
  IF COALESCE(array_length(v_action.image_urls, 1), 0) = 0 THEN
    RAISE EXCEPTION '대표 이미지를 1장 이상 등록해주세요.';
  END IF;

  SELECT COUNT(*) INTO v_item_cnt FROM action_items WHERE action_id = p_action_id;
  IF v_item_cnt = 0 THEN
    RAISE EXCEPTION '모집 항목을 하나 이상 추가해주세요.';
  END IF;

  UPDATE actions SET status = 'ACTIVE' WHERE id = p_action_id;
END;
$$;

-- -------------------------------------------------------------
-- sync_action_status — lazy 상태 전환
-- 활동 종료 시각이 지난 ACTIVE 액션을 ENDED 로 바꾸고,
-- 참여자 상태도 AFTER_ACTION 으로 올린다. 알림도 함께 만든다.
-- 액션 상세/목록을 열 때 호출한다.
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_action_status(p_action_id UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_action actions%ROWTYPE;
BEGIN
  SELECT * INTO v_action FROM actions WHERE id = p_action_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_action.status = 'ACTIVE'
     AND v_action.activity_end_at IS NOT NULL
     AND v_action.activity_end_at < now() THEN

    UPDATE actions SET status = 'ENDED' WHERE id = p_action_id;

    UPDATE participations
       SET status = 'AFTER_ACTION'
     WHERE action_id = p_action_id AND status = 'BEFORE_ACTION';

    -- Owner 에게 결과 작성 요청
    INSERT INTO notifications (user_id, type, action_id, event_key)
    VALUES (v_action.owner_id, 'RESULT_REQUEST', p_action_id,
            'RESULT_REQUEST:' || p_action_id)
    ON CONFLICT (event_key) DO NOTHING;

    RETURN 'ENDED';
  END IF;

  RETURN v_action.status;
END;
$$;

-- -------------------------------------------------------------
-- complete_action — ENDED → COMPLETED (결과 공개)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION complete_action(p_action_id UUID)
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
    RAISE EXCEPTION '본인이 만든 액션만 결과를 공개할 수 있습니다.';
  END IF;
  IF v_action.status <> 'ENDED' THEN
    RAISE EXCEPTION '활동이 끝난 액션만 결과를 공개할 수 있습니다.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM action_results WHERE action_id = p_action_id) THEN
    RAISE EXCEPTION '결과를 먼저 작성해주세요.';
  END IF;

  UPDATE actions SET status = 'COMPLETED' WHERE id = p_action_id;

  -- 참여한 Crew 전원에게 결과 공개 + 소감 요청 알림
  INSERT INTO notifications (user_id, type, action_id, event_key)
  SELECT p.user_id, 'RESULT_PUBLISHED', p_action_id,
         'RESULT_PUBLISHED:' || p_action_id || ':' || p.user_id
  FROM participations p
  WHERE p.action_id = p_action_id AND p.status <> 'LEFT'
  ON CONFLICT (event_key) DO NOTHING;
END;
$$;

-- -------------------------------------------------------------
-- cancel_action — 취소
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
  IF v_action.status NOT IN ('ACTIVE','ENDED') THEN
    RAISE EXCEPTION '지금은 취소할 수 없는 상태입니다.';
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
-- notify_invite — 공유(초대) 알림
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

  INSERT INTO notifications (user_id, type, action_id, event_key)
  VALUES (p_target, 'INVITED', p_action_id,
          'INVITED:' || p_action_id || ':' || p_target)
  ON CONFLICT (event_key) DO NOTHING;
END;
$$;

-- -------------------------------------------------------------
-- 실행 권한
-- -------------------------------------------------------------
GRANT EXECUTE ON FUNCTION join_action(UUID, JSONB)        TO authenticated;
GRANT EXECUTE ON FUNCTION leave_action(UUID)              TO authenticated;
GRANT EXECUTE ON FUNCTION submit_crew_voice(UUID, TEXT)   TO authenticated;
GRANT EXECUTE ON FUNCTION delete_chat_message(UUID)       TO authenticated;
GRANT EXECUTE ON FUNCTION publish_action(UUID)            TO authenticated;
GRANT EXECUTE ON FUNCTION complete_action(UUID)           TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_action(UUID, TEXT)       TO authenticated;
GRANT EXECUTE ON FUNCTION notify_invite(UUID, UUID)       TO authenticated;
GRANT EXECUTE ON FUNCTION sync_action_status(UUID)        TO anon, authenticated;
