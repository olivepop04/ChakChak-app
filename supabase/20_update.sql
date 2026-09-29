-- =============================================================
-- 20. 아바타를 가입할 때 고르게 (2026-09-29)
-- =============================================================
--
-- SQL Editor 에 **통째로** 붙여넣고 실행하세요 (BEGIN … COMMIT 으로 한 번에 적용됩니다).
-- 여러 번 실행해도 안전합니다.
--
-- 조장님 요청 · 9/29 팀 결정 네 가지입니다.
--   ① 가입 2단계(닉네임과 성별 사이)에서 8종 중 하나를 **꼭** 고른다
--   ② 이미 가입한 사람은 8종 중 하나를 골고루 배정한다
--   ③ 지금 쓰던 표정 10종은 새 8종으로 바꾼다 (그림 파일 이름 avatar_01 ~ avatar_08)
--   ④ 한 번 정한 아바타는 **서버에서도** 바꾸지 못하게 막는다
--
-- 전에는 DB 에 아바타 칸이 없고, 화면이 닉네임으로 10종 중 하나를 계산해서 그렸습니다.
--
-- ⚠️ 이 파일은 01_schema.sql 의 handle_new_user() 를 덮어씁니다.
--    01 을 다시 실행했다면 이 파일도 다시 실행하세요.
-- =============================================================


BEGIN;

-- -------------------------------------------------------------
-- ① 8종 목록 — lib/constants 의 AVATAR_KEYS 와 같아야 합니다
--    (tests/avatar.test.ts 가 두 목록을 대조합니다)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_avatar_key(p_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p_key = ANY (ARRAY[
    'avatar_01', 'avatar_02', 'avatar_03', 'avatar_04',
    'avatar_05', 'avatar_06', 'avatar_07', 'avatar_08'
  ]);
$$;

-- 고르지 않은 사람에게 줄 기본값 — 계정 id 로 골라서 사람마다 골고루 나뉘고,
-- 같은 계정은 몇 번을 다시 돌려도 같은 값입니다 (시드를 다시 돌려도 얼굴이 안 바뀜).
-- hashtext 는 int4 라 abs() 가 최솟값에서 넘칩니다 — bigint 로 바꾼 뒤 계산합니다.
CREATE OR REPLACE FUNCTION default_avatar(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT 'avatar_' || lpad((1 + abs(hashtext(p_user_id::text)::bigint) % 8)::text, 2, '0');
$$;


-- -------------------------------------------------------------
-- ② 칸을 만든다 — 채우고 막는 것은 가입 함수를 바꾼 뒤에 (아래 ④)
-- -------------------------------------------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar TEXT;


-- -------------------------------------------------------------
-- ③ 가입할 때 고른 값을 저장 — signUp 의 options.data.avatar
--    값이 없거나 목록 밖이면 기본값을 넣습니다. 화면은 꼭 고르게 막지만,
--    시드·검사 스크립트처럼 화면을 안 거치는 가입도 있어서입니다.
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER AS $$
DECLARE
  v_avatar TEXT := NEW.raw_user_meta_data->>'avatar';
BEGIN
  IF v_avatar IS NULL OR NOT is_avatar_key(v_avatar) THEN
    v_avatar := default_avatar(NEW.id);
  END IF;

  INSERT INTO public.profiles (id, name, nickname, gender, avatar, terms_agreed_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', '이름없음'),
    COALESCE(NEW.raw_user_meta_data->>'nickname', 'user_' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'gender', 'MALE'),
    v_avatar,
    now()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
-- 트리거(on_auth_user_created)는 01 에서 이미 이 함수를 가리키고 있어서 다시 만들 필요가 없습니다.



-- 혹시 빈 값으로 들어오는 가입이 있어도(옛 가입 함수로 이미 시작된 가입 등) 기본값으로 채웁니다
CREATE OR REPLACE FUNCTION fill_profile_avatar()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.avatar IS NULL THEN
    NEW.avatar := default_avatar(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fill_profile_avatar_trg ON profiles;
CREATE TRIGGER fill_profile_avatar_trg
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION fill_profile_avatar();

-- -------------------------------------------------------------
-- ④ 이미 가입한 사람에게 채운 뒤 비지 못하게
--    가입 함수(③)를 먼저 바꿔 둬서, 이 사이에 가입해도 값이 들어갑니다
-- -------------------------------------------------------------
UPDATE profiles SET avatar = default_avatar(id) WHERE avatar IS NULL;

ALTER TABLE profiles ALTER COLUMN avatar SET NOT NULL;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_avatar_valid;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_avatar_valid CHECK (is_avatar_key(avatar));

COMMENT ON COLUMN profiles.avatar IS
  '아바타 8종 중 하나 (avatar_01 ~ avatar_08). 가입 때 고르고 바꿀 수 없다 (20)';


-- -------------------------------------------------------------
-- ⑤ 한 번 정한 아바타는 사용자가 못 바꾼다
--    로그인한 사용자의 요청(auth.uid() 가 있음)만 막습니다.
--    시드·SQL Editor(서비스 롤·관리자)는 통과 — 잘못 골라 곤란할 때 민호가 고쳐 줄 수 있게.
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION lock_profile_avatar()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.avatar IS DISTINCT FROM OLD.avatar AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION '아바타는 가입할 때 한 번만 고를 수 있어요.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lock_profile_avatar_trg ON profiles;
CREATE TRIGGER lock_profile_avatar_trg
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION lock_profile_avatar();

COMMIT;
