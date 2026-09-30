-- =============================================================
-- 21_update.sql — 직접 고치기 막기 (2026-09-30, 배포 전 검수)
--
-- 앱은 참여·나가기·공개·취소·조기 종료·결과 공개·소감·글 삭제를 전부
-- SECURITY DEFINER 함수(RPC)로 합니다. 그런데 표의 UPDATE 정책이 「본인 행이면
-- 어느 칸이든」 열려 있어서, 브라우저 개발자 도구로 공개 anon 키를 쓰면
-- 그 함수들이 지키는 규칙을 건너뛸 수 있었습니다.
--
--   participations  action_id 를 남의 액션으로 바꿔 크루가 되면 비공개 크루챗·명단이 열림
--                   status 를 바꿔 정원·참여 완료 통계를 속임
--   chat_messages   글을 남의 액션 크루챗으로 옮기거나, 지울 수 없는 조기 종료 공지를 지움
--   actions         상태를 직접 바꾸거나 처음부터 ACTIVE 로 넣어 공개 검수를 건너뜀
--   profiles        성별을 바꿔 성별 제한 항목에 참여
--
-- 막는 방법 — 「직접 요청」 만 막고 함수는 그대로 둡니다.
--   직접 요청(PostgREST)은 authenticated 역할로 돌고, SECURITY DEFINER 함수 안에서는
--   함수 주인(postgres) 역할로 돕니다. 그래서 current_user = 'authenticated' 일 때만 막으면
--   앱 기능·서비스 롤(시드·검사 스크립트)은 그대로입니다.
--   (20 의 아바타 잠금은 auth.uid() 로 봤는데, 그건 함수 안에서도 값이 있어서 여기엔 못 씁니다.)
--
-- 앱 코드에서 확인한 것 (2026-09-30):
--   participations · chat_messages 를 직접 UPDATE 하는 곳 0곳 — 전부 RPC
--   actions 를 직접 INSERT 할 때는 늘 status 'DRAFT', UPDATE 에는 status·owner_id·사유가 없음
--   프로필 수정은 gender 를 보내지 않음 (화면에서도 읽기 전용)
-- =============================================================

BEGIN;

-- ── 1. 참여 기록 — 직접 UPDATE 정책을 없앱니다 ─────────────────
-- 나가기(leave_action_with_reason) · 소감(submit_crew_voice) · 상태 동기화 등은
-- 모두 SECURITY DEFINER 라 RLS 를 거치지 않습니다.
DROP POLICY IF EXISTS participations_update ON participations;

-- ── 2. 크루챗 — 직접 UPDATE 정책을 없앱니다 ────────────────────
-- 삭제는 delete_chat_message() 로만 합니다 (본인 글 · 공지는 못 지움 규칙이 거기 있음).
DROP POLICY IF EXISTS chat_update ON chat_messages;

-- ── 3. 액션 — 상태·주인·사유는 함수로만 ───────────────────────
CREATE OR REPLACE FUNCTION guard_action_direct_write()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user <> 'authenticated' THEN
    RETURN NEW;   -- RPC(함수 주인) · 서비스 롤은 통과
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'DRAFT' THEN
      RAISE EXCEPTION '새 액션은 작성 중으로만 만들 수 있어요. 공개는 「공개하기」 로 해주세요.';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status           IS DISTINCT FROM OLD.status
     OR NEW.owner_id         IS DISTINCT FROM OLD.owner_id
     OR NEW.cancel_reason    IS DISTINCT FROM OLD.cancel_reason
     OR NEW.early_end_reason IS DISTINCT FROM OLD.early_end_reason
  THEN
    RAISE EXCEPTION '액션 상태는 공개·취소·조기 종료·결과 공개 버튼으로만 바꿀 수 있어요.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_action_direct_write_trg ON actions;
CREATE TRIGGER guard_action_direct_write_trg
  BEFORE INSERT OR UPDATE ON actions
  FOR EACH ROW EXECUTE FUNCTION guard_action_direct_write();

-- ── 4. 프로필 — 성별은 가입 때 정한 값 그대로 ──────────────────
-- 성별 제한 항목(join_action)이 profiles.gender 를 믿기 때문입니다.
-- 관리자(서비스 롤)는 잘못 고른 경우 고쳐 줄 수 있습니다.
CREATE OR REPLACE FUNCTION lock_profile_gender()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user = 'authenticated'
     AND NEW.gender IS DISTINCT FROM OLD.gender
  THEN
    RAISE EXCEPTION '성별은 가입할 때 한 번만 정할 수 있어요.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lock_profile_gender_trg ON profiles;
CREATE TRIGGER lock_profile_gender_trg
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION lock_profile_gender();

COMMIT;

NOTIFY pgrst, 'reload schema';
