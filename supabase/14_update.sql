-- =============================================================
-- 14 — 액션에 카테고리를 여러 개
--
-- SQL Editor 에 통째로 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.
--
-- 「UI 및 기획 수정 4」 20쪽 "카테고리 복수선택 가능하도록 변경".
--
-- ─────────────────────────────────────────────────────────────
-- 왜 컬럼을 갈아치우지 않는가
--
-- category 는 24개 파일이 읽고 있습니다. 한 번에 바꾸면 홈 필터·
-- Discover 추천·Trends 통계·카드 배지가 동시에 깨집니다.
--
-- 그래서 categories(복수)를 새로 두고, category(단수)는
-- **트리거가 categories 의 첫 번째 값으로 자동으로 맞춥니다.**
--
--   categories = ['환경','지역사회']  →  category = '환경'  (자동)
--
-- 아직 안 고친 화면은 category 를 읽어 대표 하나를 그대로 보여주고,
-- 고친 화면은 categories 를 읽어 전부 보여줍니다. 둘이 어긋날 수
-- 없습니다 — 사람이 category 를 직접 쓰지 않기 때문입니다.
--
-- 화면 작업이 다 끝나면 그때 category 를 지우면 됩니다.
-- ─────────────────────────────────────────────────────────────
-- =============================================================


-- -------------------------------------------------------------
-- ① 컬럼 추가 + 기존 값 옮기기
-- -------------------------------------------------------------
ALTER TABLE actions
  ADD COLUMN IF NOT EXISTS categories TEXT[];

UPDATE actions
   SET categories = ARRAY[category]
 WHERE categories IS NULL OR array_length(categories, 1) IS NULL;

ALTER TABLE actions
  ALTER COLUMN categories SET NOT NULL;

COMMENT ON COLUMN actions.categories IS
  '카테고리 1~3개. 첫 번째가 대표. category 컬럼은 트리거가 자동으로 맞춥니다 (14)';

COMMENT ON COLUMN actions.category IS
  '대표 카테고리. categories[1] 이 자동으로 들어갑니다. 직접 쓰지 마세요 (14)';


-- -------------------------------------------------------------
-- ② 개수와 값 검사
--
-- 최소 1개, 최대 3개. 넷을 넘으면 카드에 다 못 담습니다.
-- 중복도 막습니다 — ['환경','환경'] 은 통계를 두 번 셉니다.
-- -------------------------------------------------------------
-- 중복 검사는 함수로 뺍니다.
-- CHECK 안에는 하위 질의(SELECT)를 쓸 수 없습니다 — 함수는 됩니다.
CREATE OR REPLACE FUNCTION has_no_duplicate(arr TEXT[])
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT COUNT(*) = COUNT(DISTINCT x) FROM unnest(arr) AS x;
$$;

ALTER TABLE actions DROP CONSTRAINT IF EXISTS actions_categories_check;
ALTER TABLE actions
  ADD CONSTRAINT actions_categories_check CHECK (
    array_length(categories, 1) BETWEEN 1 AND 3
    -- 01_schema.sql 의 category CHECK 와 같은 목록입니다.
    -- 카테고리를 늘리면 두 곳을 같이 고쳐야 합니다.
    AND categories <@ ARRAY['동물','환경','지역사회','아동·청소년','노인','장애','교육','기타']::TEXT[]
    AND has_no_duplicate(categories)
  );


-- -------------------------------------------------------------
-- ③ category 를 자동으로 맞추는 트리거
--
-- 화면이 categories 만 보내면 category 는 여기서 채워집니다.
-- 아직 category 만 보내는 옛 코드도 그대로 돌아갑니다 —
-- categories 가 안 오면 category 로 채웁니다.
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_action_category()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- 옛 코드가 category 만 바꿨다면 categories 를 따라가게 합니다
  IF TG_OP = 'UPDATE'
     AND NEW.category IS DISTINCT FROM OLD.category
     AND NEW.categories IS NOT DISTINCT FROM OLD.categories THEN
    NEW.categories := ARRAY[NEW.category];
  END IF;

  IF NEW.categories IS NULL OR array_length(NEW.categories, 1) IS NULL THEN
    NEW.categories := ARRAY[NEW.category];
  END IF;

  -- 대표는 언제나 첫 번째
  NEW.category := NEW.categories[1];
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_action_category_trg ON actions;
CREATE TRIGGER sync_action_category_trg
  BEFORE INSERT OR UPDATE ON actions
  FOR EACH ROW EXECUTE FUNCTION sync_action_category();


-- -------------------------------------------------------------
-- ④ 공개 뒤 잠금에 categories 도 넣기
--
-- 06 은 category 만 잠갔습니다. categories 를 안 잠그면
-- 공개한 뒤에 카테고리를 몰래 바꿀 수 있습니다.
--
-- ⚠️ 06_update.sql 의 함수를 덮어씁니다.
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
     OR NEW.categories        IS DISTINCT FROM OLD.categories
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

-- 순서가 중요합니다. 이름순으로 도는데 lock_ 이 sync_ 보다 앞이라
-- 잠금이 먼저 돌고 그다음 대표 카테고리가 맞춰집니다. 잠금 검사는
-- 화면이 보낸 값 그대로를 보므로 의도한 대로 동작합니다.


-- -------------------------------------------------------------
-- ⑤ 카테고리로 거르기 위한 색인
--
-- 홈에서 칩을 누르면 "이 카테고리를 하나라도 가진 액션" 을 찾습니다.
-- 배열 검색이라 일반 색인이 안 듣습니다.
-- -------------------------------------------------------------
CREATE INDEX IF NOT EXISTS actions_categories_idx
  ON actions USING GIN (categories);


-- =============================================================
-- 확인 — npm run verify:db 가 [19] 구간에서 검사합니다
--
--   여러 개 저장 · 대표가 첫 번째로 자동 설정됨
--   1~3개만 허용 · 중복 거절 · 없는 카테고리 거절
--   공개한 뒤에는 못 바꿈
--   카테고리 하나로 거르면 그것을 가진 액션이 전부 나옴
-- =============================================================
