-- =============================================================
-- 10 — 재능 · 공유 수 · 모집 항목 잠금
--
-- SQL Editor 에 통째로 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.
--
-- 2026-09-03 회의 결정 세 가지를 준비합니다.
--   ① 재능(skills)      — 가입 때 고르고 Discover 추천에 씁니다
--   ② 공유 수           — 카드 통계를 4가지로
--   ③ 모집 항목 잠금    — 공개 뒤에는 "추가만" 되게
--
-- ⚠️ 이 파일은 02(action_social_counts 뷰)와 03(notify_invite)이 만든 것을
--    덮어씁니다. 02·03 을 다시 실행했다면 이 파일도 다시 실행하세요.
-- =============================================================


-- -------------------------------------------------------------
-- ① 재능 (skills)
--
-- 자유 입력이 아니라 고정 목록에서 고릅니다.
-- "사진 / 사진 찍기 / 사진 촬영" 을 컴퓨터는 다른 말로 보기 때문입니다.
--
-- ★ NULL 과 빈 배열을 반드시 구분합니다.
--
--     NULL       아직 안 물어봄  → AI 가 물어봐도 됩니다
--     '{}'       없다고 답함     → 다시 묻지 않습니다
--     '{사진}'   있음            → 다시 묻지 않습니다
--
-- 그래서 NOT NULL 도, DEFAULT 도 넣지 않습니다.
-- 기본값을 주면 "안 물어본 사람"과 "없다고 한 사람"이 같아져서,
-- 재능이 없는 사람에게 AI 가 계속 재능을 묻게 됩니다.
-- -------------------------------------------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS skills TEXT[];

COMMENT ON COLUMN profiles.skills IS
  'NULL=아직 안 물어봄, {}=없다고 답함, {...}=있음. 기본값을 주지 말 것';


-- -------------------------------------------------------------
-- ② 공유 수
--
-- 지금은 공유하면 상대에게 알림만 갑니다. 센 적이 없어서 셀 수가 없습니다.
-- 한 사람이 세 명에게 공유하면 3 으로 셉니다 ("3번 공유됨").
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shares (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id  UUID NOT NULL REFERENCES actions(id)  ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_id  UUID          REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shares_action_idx ON shares(action_id);

ALTER TABLE shares ENABLE ROW LEVEL SECURITY;

-- likes / saves 와 같은 방식입니다. 남의 공유 기록은 안 보입니다.
-- 화면에 나오는 "공유 N" 은 아래 뷰가 셉니다.
DROP POLICY IF EXISTS shares_select ON shares;
CREATE POLICY shares_select ON shares
  FOR SELECT USING (auth.uid() = user_id);

-- 직접 INSERT 는 막습니다. notify_invite() 만 기록합니다.
-- 안 그러면 아무나 숫자를 올릴 수 있습니다.


-- notify_invite — 알림을 보내면서 공유 기록도 남깁니다.
-- ⚠️ 03_functions.sql 의 함수를 덮어씁니다.
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

  -- 공유 수 집계용 기록 (10)
  INSERT INTO shares (action_id, user_id, target_id)
  VALUES (p_action_id, auth.uid(), p_target);
END;
$$;


-- 카드 통계에 공유 수를 더합니다.
-- ⚠️ 02_rls.sql 의 뷰를 덮어씁니다. 컬럼은 맨 뒤에만 추가할 수 있습니다.
CREATE OR REPLACE VIEW action_social_counts AS
SELECT
  a.id AS action_id,
  (SELECT COUNT(*) FROM likes  l WHERE l.action_id = a.id)::INT AS like_count,
  (SELECT COUNT(*) FROM saves  s WHERE s.action_id = a.id)::INT AS save_count,
  (SELECT COUNT(*) FROM participations p
     WHERE p.action_id = a.id AND p.status <> 'LEFT')::INT       AS crew_count,
  (SELECT COUNT(*) FROM shares sh WHERE sh.action_id = a.id)::INT AS share_count
FROM actions a;

GRANT SELECT ON action_social_counts TO anon, authenticated;


-- -------------------------------------------------------------
-- ③ 모집 항목 잠금 — 공개 뒤에는 "추가만"
--
-- 지금은 호스트가 공개된 액션의 항목을 고치거나 지울 수 있습니다.
-- 그런데 participation_items 가 ON DELETE CASCADE 라서,
-- 항목을 지우면 그 항목을 고른 사람들의 참여 기록이 조용히 사라집니다.
--
-- 더 위험한 건 saveActionItems() 입니다.
-- 이 함수는 "전부 지우고 다시 넣기" 방식이라, 공개된 액션에 부르면
-- 크루 전원의 항목 선택이 한 번에 날아갑니다. 에러도 안 납니다.
--
-- 그래서 DB 에서 막습니다. 화면에서 조심하는 것으로는 부족합니다.
--
--   DRAFT      무엇이든 가능 (아직 아무도 신청하지 않았습니다)
--   그 외      추가만 가능. 수정·삭제는 거절
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION lock_items_after_publish()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status TEXT;
  v_action UUID := COALESCE(OLD.action_id, NEW.action_id);
BEGIN
  SELECT status INTO v_status FROM actions WHERE id = v_action;

  IF v_status IS NULL OR v_status = 'DRAFT' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION '공개한 뒤에는 모집 항목을 지울 수 없어요. 이미 신청한 크루가 있을 수 있습니다.';
  ELSE
    RAISE EXCEPTION '공개한 뒤에는 모집 항목을 고칠 수 없어요. 새 항목을 추가하는 것은 됩니다.';
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_items_after_publish ON action_items;
CREATE TRIGGER trg_lock_items_after_publish
  BEFORE UPDATE OR DELETE ON action_items
  FOR EACH ROW EXECUTE FUNCTION lock_items_after_publish();


-- =============================================================
-- 확인
--
--   SELECT skills FROM profiles LIMIT 1;             -- NULL 이 나오면 정상
--   SELECT share_count FROM action_social_counts LIMIT 1;
--   -- 공개된 액션의 항목을 지워보면 한국어 에러가 나야 합니다
-- =============================================================
