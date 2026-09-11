-- =============================================================
-- 18. 결과를 사진 없이도 임시저장할 수 있게 (2026-09-11)
-- =============================================================
--
-- 회의(슬라이드 13)에서 "결과 작성도 한 번에 끝내지 못하는 경우가 있으니
-- 저장 버튼을 붙이자" 로 정했습니다. 그런데 지금 구조로는 저장이 안 됩니다.
--
--   ① lib/mutations.ts 의 saveActionResult() 가 사진 0장을 거절
--   ② 아래 CHECK 가 사진 0장을 아예 INSERT 못 하게 막음
--
-- 사진 정리가 늦어지는 것이 결과 작성이 밀리는 가장 흔한 이유입니다.
-- 글만 써두고 사진은 저녁에 올리는 것이 안 되면 임시저장의 뜻이 없어집니다.
--
-- 그래서 액션 만들기와 같은 모양으로 바꿉니다.
--
--   저장(DRAFT)        무엇이든 비어 있어도 된다
--   공개(ACTIVE 이상)  빠진 것이 있으면 거절
--
-- 결과도 같습니다 — 임시저장은 비어 있어도 되고, 공개할 때 사진 1장을 봅니다.
-- 「결과 사진 최소 1장」 결정(2026-08-31)은 그대로입니다. 검사하는 시점만 옮깁니다.

-- ─────────────────────────────────────────────────────────────
-- ① 사진 0장을 허용합니다 (최대 5장은 그대로)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE action_results DROP CONSTRAINT IF EXISTS result_images_1_to_5;
ALTER TABLE action_results
  ADD CONSTRAINT result_images_max_5
  CHECK (COALESCE(array_length(image_urls, 1), 0) <= 5);

COMMENT ON CONSTRAINT result_images_max_5 ON action_results IS
  '임시저장은 사진 0장도 됩니다. 사진 1장 이상은 complete_action() 이 공개할 때 봅니다.';

-- ─────────────────────────────────────────────────────────────
-- ② 공개할 때 사진 1장 이상을 봅니다
-- ─────────────────────────────────────────────────────────────
-- 전에는 "action_results 행이 있는가" 만 봤습니다. 행이 있으면 사진도
-- 1장 이상이라는 것이 ① 의 CHECK 로 보장됐기 때문입니다.
-- 이제 0장 행이 존재할 수 있으니, 여기서 직접 세야 합니다.
CREATE OR REPLACE FUNCTION complete_action(p_action_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_action actions%ROWTYPE;
  v_images INT;
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

  SELECT COALESCE(array_length(image_urls, 1), 0) INTO v_images
  FROM action_results WHERE action_id = p_action_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '결과를 먼저 작성해주세요.';
  END IF;
  IF v_images < 1 THEN
    RAISE EXCEPTION '결과 사진을 최소 1장 올려주세요. 활동을 보여주는 사진이 있어야 크루들이 결과를 확인할 수 있어요.';
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

GRANT EXECUTE ON FUNCTION complete_action(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- ③ 임시저장 중인 결과가 남에게 보이지 않게 (이것이 빠지면 새어 나갑니다)
-- ─────────────────────────────────────────────────────────────
-- 전 정책:  is_action_public(action_id) OR is_action_owner(action_id)
--
-- is_action_public 은 ENDED 도 공개로 봅니다(02_rls.sql). 지금까지는
-- "저장하면 곧바로 공개" 라서 문제가 없었지만, 임시저장이 생기면
-- 호스트가 쓰다 만 결과가 ENDED 상태에서 그대로 읽힙니다.
-- 결과 보기(/result)는 비회원도 들어오는 화면이라 더 그렇습니다.
--
-- 그래서 "공개된 결과(COMPLETED)" 와 "내 결과" 만 읽게 좁힙니다.
-- 호스트는 is_action_owner 로 자기 임시저장을 계속 읽을 수 있어서
-- 나갔다 다시 들어와 이어쓰는 데 지장이 없습니다.
DROP POLICY IF EXISTS action_results_select ON action_results;
CREATE POLICY action_results_select ON action_results
  FOR SELECT USING (
    action_status(action_id) = 'COMPLETED'
    OR is_action_owner(action_id)
  );

-- ─────────────────────────────────────────────────────────────
-- 확인용 (직접 돌려볼 때)
-- ─────────────────────────────────────────────────────────────
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint WHERE conrelid = 'action_results'::regclass;
--
-- SELECT polname, pg_get_expr(polqual, polrelid)
-- FROM pg_policy WHERE polrelid = 'action_results'::regclass;
