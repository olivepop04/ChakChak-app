-- =============================================================
-- 22_update.sql — 문의·건의하기 (2026-10-02, 실사용자 의견 받기)
--
-- 로그인한 사용자가 관리자에게 문의·건의·오류 신고를 보냅니다.
-- 보낸 글은 **관리자만** 읽습니다. 보낸 사람 본인도 다시 못 읽습니다(이번 범위).
--
-- 관리자 구분 — admins 표 (2026-10-02 지수님 결정)
--   profiles 에 is_admin 칸을 두면, 본인 행을 고칠 수 있는 표라서
--   성별·아바타처럼 따로 잠그지 않으면 누구나 스스로 관리자가 됩니다.
--   그래서 아무도 직접 읽고 쓸 수 없는 별도 표로 둡니다.
--   관리자 지정은 SQL 편집기에서 서비스 롤로만 합니다 (맨 아래 예시).
--   저장소에 관리자 이메일을 적지 않습니다.
--
-- 쓰기 — submit_feedback() 함수로만
--   21 과 같은 방식입니다. feedback 표에는 INSERT 정책을 두지 않아
--   개발자 도구로 직접 넣을 수 없고, 함수가 길이·종류·횟수를 검사합니다.
--
-- 읽기 — is_admin() 이 참인 사람만
--   SELECT 정책 하나뿐입니다. 관리자가 아니면 오류 없이 빈 결과가 옵니다(RLS).
-- =============================================================

BEGIN;

-- ── 1. 관리자 목록 ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admins (
  user_id    UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 정책을 하나도 두지 않습니다 — authenticated · anon 은 읽기·쓰기 모두 막힙니다.
-- 누가 관리자인지도 바깥에서 알 수 없습니다.
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- 지금 요청한 사람이 관리자인지.
-- admins 를 읽어야 하는데 위에서 막았으므로 SECURITY DEFINER 로 돕니다.
-- 돌려주는 것은 참·거짓 하나뿐이라 목록은 새지 않습니다.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid());
$$;

GRANT EXECUTE ON FUNCTION is_admin() TO anon, authenticated;

-- ── 2. 문의·건의 ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feedback (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category   TEXT NOT NULL CHECK (category IN ('INQUIRY', 'SUGGESTION', 'BUG')),
  body       TEXT NOT NULL CHECK (char_length(body) BETWEEN 5 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_created_at_idx ON feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_user_recent_idx ON feedback (user_id, created_at DESC);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- 읽기는 관리자만. INSERT · UPDATE · DELETE 정책은 두지 않습니다.
DROP POLICY IF EXISTS feedback_select_admin ON feedback;
CREATE POLICY feedback_select_admin ON feedback
  FOR SELECT USING (is_admin());

-- ── 3. 보내기 ──────────────────────────────────────────────────
-- 화면의 검사(lib/utils/feedback.ts)와 같은 기준입니다. 숫자를 바꾸면 둘 다 고치세요.
CREATE OR REPLACE FUNCTION submit_feedback(p_category TEXT, p_body TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_body TEXT := btrim(coalesce(p_body, ''));
  v_id   UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '로그인한 뒤에 보낼 수 있어요.';
  END IF;

  IF p_category IS NULL OR p_category NOT IN ('INQUIRY', 'SUGGESTION', 'BUG') THEN
    RAISE EXCEPTION '문의 종류를 골라주세요.';
  END IF;

  IF char_length(v_body) < 5 THEN
    RAISE EXCEPTION '내용을 5자 이상 적어주세요.';
  END IF;

  IF char_length(v_body) > 2000 THEN
    RAISE EXCEPTION '내용은 2000자까지 적을 수 있어요.';
  END IF;

  -- 같은 사람이 짧은 시간에 몰아서 보내지 못하게 합니다 (1시간에 5건).
  IF (
    SELECT count(*) FROM feedback
    WHERE user_id = v_uid AND created_at > now() - interval '1 hour'
  ) >= 5 THEN
    RAISE EXCEPTION '잠시 뒤에 다시 보내주세요. 한 시간에 5건까지 보낼 수 있어요.';
  END IF;

  INSERT INTO feedback (user_id, category, body)
  VALUES (v_uid, p_category, v_body)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION submit_feedback(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_feedback(TEXT, TEXT) TO authenticated;

COMMIT;

-- ── 관리자 지정 (적용 뒤 SQL 편집기에서 한 번) ─────────────────
-- 저장소에는 누구를 관리자로 할지 적지 않습니다. 아래를 이메일만 바꿔 돌리세요.
--
--   INSERT INTO admins (user_id)
--   SELECT id FROM auth.users WHERE email = '관리자이메일@example.com'
--   ON CONFLICT DO NOTHING;
--
-- 해제:
--   DELETE FROM admins WHERE user_id = (SELECT id FROM auth.users WHERE email = '…');
