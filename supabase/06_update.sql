-- =============================================================
-- 06 — 2026-09-01 개편 반영
--
-- 스키마를 바꿀 때는 01~05 파일을 고치지 말고 이렇게 새 파일을 쌓습니다.
-- 앞 파일을 고치면 이미 적용한 사람과 새로 받은 사람의 DB가 달라집니다.
--
-- SQL Editor 에 통째로 붙여넣고 실행하세요.
--
-- ⚠️ 단독 재실행 금지
--    이 파일이 만든 notifications_type_check 를 08_update.sql 이 덮어씁니다.
--    이 파일만 다시 돌리면 08 이 추가한 SHORTFALL 종류가 사라지고,
--    모집 미달 알림이 "violates check constraint" 로 실패합니다.
--    다시 돌려야 하면 06 → 07 → 08 을 순서대로 돌리세요.
--
-- 들어 있는 것
--   ① 알림 켜고 끄기 (F25)
--   ② 나가기 알림 7번째 종류 + 알림 본문 (F40)
--   ③ 참여 가능 시간 2단계 구조 (F38)
--   ④ 액션 장소명 (F32)
--   ⑤ 게시판 글 종류 구분 (F40)
--   ⑥ 공개된 액션은 소개·안내사항만 수정 (F41)
--   ⑦ 나가기 + 사유 남기기를 한 번에 처리하는 함수 (F40)
-- =============================================================


-- -------------------------------------------------------------
-- ① 알림 켜고 끄기                                        (F25)
--
-- 끈 종류만 담습니다. 빈 배열 = 전부 켜짐.
-- 이렇게 해야 나중에 알림 종류가 늘어도 기본이 "켜짐" 이 됩니다.
-- -------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notify_off TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN profiles.notify_off IS
  '사용자가 끈 알림 종류. 빈 배열이면 전부 받습니다.';


-- -------------------------------------------------------------
-- ③ 참여 가능 시간 2단계                                  (F38)
--
--   [{"day":"평일","slots":["오전"]},
--    {"day":"주말","slots":["저녁","밤"]}]
--
-- day   : 평일 · 주말 · 상관없음
-- slots : 오전 · 오후 · 저녁 · 밤 · 상관없음  (복수 선택)
--
-- ⚠️ 기존 available_times 는 아직 지우지 않습니다.
--    추천 점수(lib/utils/scoring.ts)가 그 값을 쓰고 있어서,
--    개발 A 가 가입 화면과 점수 계산을 함께 옮긴 뒤에 지웁니다.
--    그때까지는 두 컬럼을 같이 채워주세요.
-- -------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS time_prefs JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN profiles.time_prefs IS
  '참여 가능 시간 2단계. [{"day":"평일","slots":["오전"]}] 형태.';

-- 기존 available_times 를 새 구조로 옮깁니다 (아직 안 옮긴 사람만)
DO $$
DECLARE
  r          RECORD;
  v_days     TEXT[];
  v_slots    TEXT[];
  v_result   JSONB;
  v_day      TEXT;
BEGIN
  FOR r IN
    SELECT id, available_times FROM profiles WHERE time_prefs = '[]'::jsonb
  LOOP
    -- 요일: 평일 / 주말 을 골라내고, 없거나 "시간이 생길 때마다" 면 상관없음
    v_days := ARRAY(
      SELECT t FROM unnest(r.available_times) AS t WHERE t IN ('평일', '주말')
    );
    IF cardinality(v_days) = 0
       OR '시간이 생길 때마다' = ANY(r.available_times) THEN
      v_days := ARRAY['상관없음'];
    END IF;

    -- 시간대: 오전 / 오후 / 저녁 을 골라내고, 없으면 상관없음
    v_slots := ARRAY(
      SELECT t FROM unnest(r.available_times) AS t WHERE t IN ('오전', '오후', '저녁')
    );
    IF cardinality(v_slots) = 0 THEN
      v_slots := ARRAY['상관없음'];
    END IF;

    v_result := '[]'::jsonb;
    FOREACH v_day IN ARRAY v_days LOOP
      v_result := v_result || jsonb_build_array(
        jsonb_build_object('day', v_day, 'slots', to_jsonb(v_slots))
      );
    END LOOP;

    UPDATE profiles SET time_prefs = v_result WHERE id = r.id;
  END LOOP;
END $$;


-- -------------------------------------------------------------
-- ④ 액션 장소명                                           (F32)
--
-- address 는 주소 검색으로 채우고(서울특별시 강동구 …),
-- place_name 은 호스트가 직접 적습니다(신라목욕탕).
-- 지도로는 상호명을 얻을 수 없어서 칸을 따로 뒀습니다.
-- -------------------------------------------------------------
ALTER TABLE actions
  ADD COLUMN IF NOT EXISTS place_name TEXT;

COMMENT ON COLUMN actions.place_name IS
  '장소 이름. 호스트가 직접 입력. 예) 신라목욕탕';


-- -------------------------------------------------------------
-- ⑤ 게시판 글 종류                                        (F40)
--
-- 나가기 사유가 평범한 잡담처럼 섞이면 남은 크루가 헷갈립니다.
-- LEFT_NOTICE 는 화면에서 "참여 취소" 딱지를 붙여 보여주세요.
-- -------------------------------------------------------------
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'NORMAL';

ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_kind_check;
ALTER TABLE chat_messages
  ADD CONSTRAINT chat_messages_kind_check
  CHECK (kind IN ('NORMAL', 'LEFT_NOTICE'));


-- -------------------------------------------------------------
-- ② 알림: 7번째 종류 + 본문                               (F40)
--
-- LEFT_CREW — 크루가 참여를 취소하면 호스트에게.
-- body      — 취소 사유처럼 알림마다 다른 문장을 담습니다.
--             없으면 화면이 템플릿 문구만 보여줍니다.
-- -------------------------------------------------------------
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS body TEXT;

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
    'LEFT_CREW'          -- 크루가 참여 취소 → 호스트
  ));


-- -------------------------------------------------------------
-- ①-2 끈 알림은 아예 만들지 않는다                        (F25)
--
-- 알림을 만드는 곳이 다섯 군데(SQL 함수 4 + lazy.ts)라
-- 각각에 조건을 넣으면 언젠가 하나를 빠뜨립니다.
-- 입구에서 한 번 막는 편이 확실합니다.
--
-- BEFORE INSERT 에서 NULL 을 돌려주면 그 행은 조용히 버려집니다.
-- 기존 ON CONFLICT DO NOTHING 과도 충돌하지 않습니다.
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION skip_muted_notification()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE id = NEW.user_id
      AND NEW.type = ANY(notify_off)
  ) THEN
    RETURN NULL;   -- 이 사람은 이 알림을 껐다
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS skip_muted_notification_trg ON notifications;
CREATE TRIGGER skip_muted_notification_trg
  BEFORE INSERT ON notifications
  FOR EACH ROW EXECUTE FUNCTION skip_muted_notification();


-- -------------------------------------------------------------
-- ⑥ 공개된 액션은 소개·안내사항만 수정                     (F41)
--
-- 모집 인원을 줄이면 이미 참여한 사람이 정원을 넘고,
-- 날짜를 당기면 일정을 잡아둔 크루가 곤란해집니다.
--
-- RLS 로는 "바뀐 컬럼"을 볼 수 없어서(USING 은 이전 행, WITH CHECK 은 새 행)
-- 트리거로 막습니다.
--
-- status · cancel_reason 은 잠그지 않습니다.
-- publish_action / complete_action / cancel_action 이 그것만 바꾸기 때문입니다.
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION lock_published_action()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status = 'DRAFT' THEN
    RETURN NEW;   -- 작성 중에는 무엇이든 고칠 수 있다
  END IF;

  IF NEW.title             IS DISTINCT FROM OLD.title
     OR NEW.category          IS DISTINCT FROM OLD.category
     OR NEW.image_urls        IS DISTINCT FROM OLD.image_urls
     OR NEW.thumbnail_index   IS DISTINCT FROM OLD.thumbnail_index
     OR NEW.address           IS DISTINCT FROM OLD.address
     OR NEW.place_name        IS DISTINCT FROM OLD.place_name
     OR NEW.recruit_end_at    IS DISTINCT FROM OLD.recruit_end_at
     OR NEW.activity_start_at IS DISTINCT FROM OLD.activity_start_at
     OR NEW.activity_end_at   IS DISTINCT FROM OLD.activity_end_at
  THEN
    RAISE EXCEPTION '공개한 뒤에는 소개와 안내사항만 고칠 수 있어요. 제목·날짜·장소·사진을 바꾸려면 액션을 취소하고 새로 만들어주세요.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lock_published_action_trg ON actions;
CREATE TRIGGER lock_published_action_trg
  BEFORE UPDATE ON actions
  FOR EACH ROW EXECUTE FUNCTION lock_published_action();


-- -------------------------------------------------------------
-- ⑦ 나가기 + 사유 남기기를 한 번에                        (F40)
--
-- 순서가 중요합니다. 나가고 나면 게시판에 글을 쓸 권한이 사라져서,
-- 사유를 먼저 올리고 그다음에 나가야 합니다.
-- 화면에서 세 번 나눠 부르면 언젠가 순서가 틀어지므로
-- 한 함수 안에서 처리합니다. 중간에 실패하면 전부 되돌아갑니다.
--
--   ① 사유를 게시판에 올린다 (아직 크루라서 권한이 있다)
--   ② 참여 상태를 LEFT 로
--   ③ 호스트에게 알림
--
-- 기존 leave_action(UUID) 은 그대로 둡니다. 사유 없이 나가는 경우가
-- 남아 있을 수 있어서, 이름을 다르게 해 따로 만듭니다.
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

  SELECT owner_id INTO v_owner FROM actions WHERE id = p_action_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION '없는 액션입니다.';
  END IF;

  -- 나갈 수 있는 조건은 기존 leave_action 과 똑같이 봅니다.
  -- 활동이 시작된 뒤에 빠지면 집계가 이미 확정된 상태라 뺄 수 없습니다.
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
