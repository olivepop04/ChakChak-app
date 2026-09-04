-- =============================================================
-- 11 — 화면에서만 막고 있던 것을 서버에서도 막기
--
-- SQL Editor 에 통째로 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.
--
-- 개발 B(재민)가 최종 검수하면서 찾아준 3건입니다.
-- 셋 다 "화면은 막는데 RPC 를 직접 부르면 통과되는" 종류였습니다.
-- 화면의 조건은 사용자를 돕는 안내고, 규칙은 DB 가 지켜야 합니다.
--
-- ⚠️ 이 파일은 03(delete_chat_message · submit_crew_voice)과
--    10(lock_items_after_publish)이 만든 것을 덮어씁니다.
--    03·10 을 다시 실행했다면 이 파일도 다시 실행하세요.
-- =============================================================


-- -------------------------------------------------------------
-- ① 참여 취소 사유(LEFT_NOTICE)는 본인도 지울 수 없다
--
-- 화면에는 삭제 버튼이 안 나오지만, RPC 는 "본인 글인가" 만 봤습니다.
-- LEFT_NOTICE 도 본인이 쓴 글이라 그대로 지워졌습니다.
--
-- 이 글은 "왜 나갔는지" 를 크루에게 남기는 기록입니다.
-- 나가기 창에서도 "한번 보내면 지울 수 없어요" 라고 경고하고 있으니,
-- 서버도 같은 말을 해야 합니다.
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

  -- 참여 취소 사유는 본인도 지울 수 없습니다 (11)
  IF v_kind = 'LEFT_NOTICE' THEN
    RAISE EXCEPTION '참여 취소 사유는 지울 수 없어요. 크루들에게 남기는 기록입니다.';
  END IF;

  UPDATE chat_messages
     SET deleted_at = now()
   WHERE (id = p_message_id OR parent_id = p_message_id)
     AND deleted_at IS NULL;
END;
$$;


-- -------------------------------------------------------------
-- ② 소감은 결과가 공개된 뒤에만 (COMPLETED)
--
-- 지금까지는 participations.status 만 봤습니다.
-- 활동이 끝나서 AFTER_ACTION 이 되면, 호스트가 아직 결과를 안 올렸어도
-- (액션이 ENDED 여도) RPC 를 직접 부르면 소감이 저장됐습니다.
--
-- 소감은 결과를 보고 쓰는 글입니다. 결과보다 먼저 쓰일 수 없습니다.
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION submit_crew_voice(p_action_id UUID, p_content TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_status     TEXT;
  v_act_status TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;
  IF char_length(trim(p_content)) < 10 THEN
    RAISE EXCEPTION '소감은 10자 이상 작성해주세요.';
  END IF;

  -- 액션이 아직 결과를 안 올렸으면 소감도 못 씁니다 (11)
  SELECT status INTO v_act_status FROM actions WHERE id = p_action_id;
  IF v_act_status IS NULL THEN
    RAISE EXCEPTION '액션을 찾을 수 없습니다.';
  END IF;
  IF v_act_status = 'CANCELLED' THEN
    RAISE EXCEPTION '취소된 액션에는 소감을 남길 수 없습니다.';
  END IF;
  IF v_act_status <> 'COMPLETED' THEN
    RAISE EXCEPTION '결과가 올라온 뒤에 소감을 남길 수 있어요.';
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
-- ③ 모집 항목 추가는 "모집 중" 일 때만
--
-- 10 에서는 수정·삭제만 막고 추가는 언제든 열어뒀습니다.
-- 그런데 재민이 지적한 대로,
--
--   모집 마감 뒤에 추가  →  아무도 신청할 수 없습니다
--   COMPLETED 뒤에 추가  →  결과 화면에 0명짜리 항목이 끼어듭니다
--
-- 마감을 미루는 것도 안 됩니다 — 공개 뒤에는 날짜가 잠겨 있습니다(07).
-- 그래서 추가가 의미를 갖는 구간은 ACTIVE + 모집 마감 전 뿐입니다.
-- 개발 B 화면이 이미 그 조건으로 버튼을 보여주고 있어, 서버를 맞춥니다.
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION lock_items_after_publish()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status  TEXT;
  v_recruit TIMESTAMPTZ;
  v_action  UUID := COALESCE(OLD.action_id, NEW.action_id);
BEGIN
  -- 시드·검증 스크립트(service_role)는 통과시킵니다.
  --
  -- 이 트리거가 막으려는 것은 "앱 화면과 RPC 가 실수로 하는 일" 입니다.
  -- saveActionItems() 도 사용자 권한으로 도니 그대로 막힙니다.
  --
  -- 반면 시드는 "모집이 이미 마감된 액션" 같은 상태를 일부러 만들어야 하고,
  -- service_role 은 어차피 RLS 도 통과합니다. 여기만 막으면 앞뒤가 안 맞고,
  -- 실제로 verify-db 의 [14] 검사가 이것 때문에 깨졌습니다.
  IF auth.uid() IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT status, recruit_end_at INTO v_status, v_recruit
  FROM actions WHERE id = v_action;

  -- DRAFT 는 아직 아무도 신청하지 않았으니 무엇이든 가능합니다
  IF v_status IS NULL OR v_status = 'DRAFT' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION '공개한 뒤에는 모집 항목을 지울 수 없어요. 이미 신청한 크루가 있을 수 있습니다.';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION '공개한 뒤에는 모집 항목을 고칠 수 없어요. 새 항목을 추가하는 것은 됩니다.';
  END IF;

  -- 여기부터는 INSERT — 모집 중일 때만 허용합니다 (11)
  IF v_status <> 'ACTIVE' THEN
    RAISE EXCEPTION '모집 중인 액션에만 항목을 추가할 수 있어요.';
  END IF;
  IF v_recruit IS NOT NULL AND v_recruit <= now() THEN
    RAISE EXCEPTION '모집이 마감돼서 항목을 추가할 수 없어요. 추가해도 신청할 수 있는 사람이 없습니다.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_items_after_publish ON action_items;
CREATE TRIGGER trg_lock_items_after_publish
  BEFORE INSERT OR UPDATE OR DELETE ON action_items
  FOR EACH ROW EXECUTE FUNCTION lock_items_after_publish();


-- =============================================================
-- 확인 — npm run verify:db 가 [16] 구간에서 검사합니다
--
--   LEFT_NOTICE 는 본인도 삭제 거절
--   ENDED 액션에 소감 거절 · COMPLETED 는 허용
--   모집 마감 뒤 항목 추가 거절 · 모집 중은 허용
-- =============================================================
