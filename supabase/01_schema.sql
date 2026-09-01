-- =============================================================
-- 착착(CHAK CHAK) — 스키마
-- 실행 순서: 01_schema.sql → 02_rls.sql → 03_functions.sql → 04_seed.sql
-- Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 실행
--
-- 용어: 서비스 전체에서 "액션(action)"으로 통일. (구 "프로젝트")
-- =============================================================

-- -------------------------------------------------------------
-- profiles — auth.users 와 같은 id 를 쓴다 (별도 UUID 생성 안 함)
-- -------------------------------------------------------------
CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  nickname        TEXT UNIQUE NOT NULL,
  -- 성별: 항목별 성별 제한(action_items.gender_requirement)을 검증하려면 필수
  gender          TEXT NOT NULL CHECK (gender IN ('MALE', 'FEMALE')),
  bio             TEXT,
  categories      TEXT[] NOT NULL DEFAULT '{}',
  available_times TEXT[] NOT NULL DEFAULT '{}',
  regions         TEXT[] NOT NULL DEFAULT '{}',   -- '서울특별시 강남구' 형태, 시·군·구까지만
  terms_agreed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT nickname_len CHECK (char_length(nickname) BETWEEN 2 AND 20)
);

-- -------------------------------------------------------------
-- actions — 액션 본체
-- 날짜 3종: 모집 마감 / 활동 시작 / 활동 종료  (전부 별개 값)
-- -------------------------------------------------------------
CREATE TABLE actions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          UUID NOT NULL REFERENCES profiles(id),
  title             TEXT NOT NULL,
  description       TEXT,
  category          TEXT NOT NULL CHECK (category IN (
                      '동물', '환경', '지역사회', '아동·청소년',
                      '노인', '장애', '교육', '기타')),
  -- 이미지: 최대 3장, thumbnail_index 가 대표 이미지
  image_urls        TEXT[] NOT NULL DEFAULT '{}',
  thumbnail_index   INT NOT NULL DEFAULT 0 CHECK (thumbnail_index >= 0),
  address           TEXT,
  notice            TEXT,
  status            TEXT NOT NULL DEFAULT 'DRAFT'
                      CHECK (status IN ('DRAFT','ACTIVE','ENDED','COMPLETED','CANCELLED')),
  cancel_reason     TEXT,
  recruit_end_at    TIMESTAMPTZ,   -- 이 시각 이후 Join 불가
  activity_start_at TIMESTAMPTZ,   -- 실제로 모이는 일시
  activity_end_at   TIMESTAMPTZ,   -- 활동 종료 → 지나면 ENDED (lazy 체크)
  review_feedback   JSONB,         -- AI 검수 결과 원본
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT images_max_3
    CHECK (COALESCE(array_length(image_urls, 1), 0) <= 3),
  CONSTRAINT thumbnail_in_range
    CHECK (thumbnail_index < GREATEST(COALESCE(array_length(image_urls, 1), 0), 1)),
  CONSTRAINT activity_order
    CHECK (activity_start_at IS NULL OR activity_end_at IS NULL
           OR activity_start_at < activity_end_at),
  CONSTRAINT recruit_before_activity
    CHECK (recruit_end_at IS NULL OR activity_start_at IS NULL
           OR recruit_end_at <= activity_start_at),
  -- 공개(ACTIVE) 이상이면 날짜 3종이 반드시 채워져 있어야 한다.
  -- NULL 비교는 CHECK 를 통과해버리므로(T7) 상태와 함께 묶어서 막는다.
  CONSTRAINT dates_required_when_public
    CHECK (status = 'DRAFT'
           OR (recruit_end_at IS NOT NULL
               AND activity_start_at IS NOT NULL
               AND activity_end_at IS NOT NULL))
);

CREATE INDEX actions_status_idx      ON actions(status);
CREATE INDEX actions_owner_idx       ON actions(owner_id);
CREATE INDEX actions_category_idx    ON actions(category);
CREATE INDEX actions_activity_idx    ON actions(activity_start_at);

-- -------------------------------------------------------------
-- action_items — 모집 항목 (사람 / 물품 공통 구조)
--
--  target_type  min_required  max_allowed   의미
--  RANGE        3             3             정확히 3명
--  RANGE        3             5             3~5명
--  MINIMUM      10            NULL          최소 10명, 계속 모집
--
-- 물품도 같은 구조를 쓴다. 보통 MINIMUM(더 받아도 됨).
-- -------------------------------------------------------------
CREATE TABLE action_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id          UUID NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  type               TEXT NOT NULL CHECK (type IN ('PERSON','GOODS')),
  name               TEXT NOT NULL,             -- '요리 담당' / '분유'
  target_type        TEXT NOT NULL CHECK (target_type IN ('RANGE','MINIMUM')),
  min_required       INT  NOT NULL CHECK (min_required > 0),
  max_allowed        INT,
  unit               TEXT NOT NULL,             -- 사람은 '명', 물품은 자유 입력('통','개','박스')
  -- 항목별 성별 제한. 예) 남성 어르신 목욕 봉사 → 'MALE'
  gender_requirement TEXT NOT NULL DEFAULT 'ANY'
                       CHECK (gender_requirement IN ('MALE','FEMALE','ANY')),
  condition_name     TEXT,                      -- '조리사 자격증 보유'
  condition_desc     TEXT,
  sort_order         INT NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- RANGE 는 max 필수, MINIMUM 은 max 가 반드시 비어 있어야 한다
  CONSTRAINT range_needs_max
    CHECK (target_type <> 'RANGE' OR max_allowed IS NOT NULL),
  CONSTRAINT minimum_has_no_max
    CHECK (target_type <> 'MINIMUM' OR max_allowed IS NULL),
  CONSTRAINT max_gte_min
    CHECK (max_allowed IS NULL OR max_allowed >= min_required),
  -- 사람 항목의 단위는 '명' 으로 고정
  CONSTRAINT person_unit_is_myeong
    CHECK (type <> 'PERSON' OR unit = '명'),
  -- 물품에는 성별 제한을 걸지 않는다
  CONSTRAINT goods_no_gender
    CHECK (type <> 'GOODS' OR gender_requirement = 'ANY')
);

CREATE INDEX action_items_action_idx ON action_items(action_id);

-- -------------------------------------------------------------
-- participations — 액션 1개당 사용자 1명 1행
-- LEFT: 나간 사람. 행은 남기고 집계에서만 제외한다.
-- -------------------------------------------------------------
CREATE TABLE participations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id  UUID NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id),
  status     TEXT NOT NULL DEFAULT 'BEFORE_ACTION'
               CHECK (status IN ('BEFORE_ACTION','AFTER_ACTION','ACTUALLY_PARTICIPATED','LEFT')),
  left_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(action_id, user_id),
  CONSTRAINT left_at_set CHECK ((status = 'LEFT') = (left_at IS NOT NULL))
);

CREATE INDEX participations_user_idx   ON participations(user_id);
CREATE INDEX participations_action_idx ON participations(action_id);

-- -------------------------------------------------------------
-- participation_items — 무엇에 얼마나 참여하는지
-- -------------------------------------------------------------
CREATE TABLE participation_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participation_id UUID NOT NULL REFERENCES participations(id) ON DELETE CASCADE,
  action_item_id   UUID NOT NULL REFERENCES action_items(id) ON DELETE CASCADE,
  quantity         INT NOT NULL CHECK (quantity > 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(participation_id, action_item_id)
);

CREATE INDEX participation_items_item_idx ON participation_items(action_item_id);

-- -------------------------------------------------------------
-- action_results — 결과. 사진 1~5장 필수
-- -------------------------------------------------------------
CREATE TABLE action_results (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id   UUID UNIQUE NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  content     TEXT,
  image_urls  TEXT[] NOT NULL DEFAULT '{}',
  owner_voice TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT result_images_1_to_5
    CHECK (COALESCE(array_length(image_urls, 1), 0) BETWEEN 1 AND 5)
);

-- -------------------------------------------------------------
-- crew_voices — 참여 소감. 작성하면 ACTUALLY_PARTICIPATED
-- -------------------------------------------------------------
CREATE TABLE crew_voices (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id  UUID NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id),
  content    TEXT NOT NULL CHECK (char_length(content) BETWEEN 10 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(action_id, user_id)
);

-- -------------------------------------------------------------
-- 소셜 — follows / saves / likes
-- -------------------------------------------------------------
CREATE TABLE follows (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id <> following_id)
);
CREATE INDEX follows_following_idx ON follows(following_id);

CREATE TABLE saves (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action_id  UUID NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, action_id)
);
CREATE INDEX saves_action_idx ON saves(action_id);

CREATE TABLE likes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action_id  UUID NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, action_id)
);
CREATE INDEX likes_action_idx ON likes(action_id);

-- -------------------------------------------------------------
-- chat_messages — 게시판형. 원글 + 댓글 1단계 (대댓글 없음)
-- 본인 글만 삭제 가능. 원글을 지우면 딸린 댓글도 함께 삭제 처리한다.
-- -------------------------------------------------------------
CREATE TABLE chat_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id  UUID NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id),
  parent_id  UUID REFERENCES chat_messages(id) ON DELETE CASCADE,
  content    TEXT NOT NULL CHECK (char_length(trim(content)) BETWEEN 1 AND 1000),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX chat_action_idx ON chat_messages(action_id, created_at);
CREATE INDEX chat_parent_idx ON chat_messages(parent_id);

-- 대댓글 방지: 부모가 있는 글은 부모가 원글이어야 하고, 같은 액션이어야 한다
CREATE OR REPLACE FUNCTION check_chat_depth() RETURNS TRIGGER AS $$
DECLARE
  parent_parent UUID;
  parent_action UUID;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT parent_id, action_id INTO parent_parent, parent_action
  FROM chat_messages WHERE id = NEW.parent_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '부모 글을 찾을 수 없습니다.';
  END IF;
  IF parent_parent IS NOT NULL THEN
    RAISE EXCEPTION '대댓글은 작성할 수 없습니다.';
  END IF;
  IF parent_action <> NEW.action_id THEN
    RAISE EXCEPTION '다른 액션의 글에는 댓글을 달 수 없습니다.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chat_depth_guard
  BEFORE INSERT ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION check_chat_depth();

-- -------------------------------------------------------------
-- notifications — 6종. event_key UNIQUE 로 중복 생성 방지
-- -------------------------------------------------------------
CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN (
               'SCHEDULE',          -- 활동 전날 (lazy)
               'RESULT_REQUEST',    -- ENDED 전환 → Owner
               'RESULT_PUBLISHED',  -- COMPLETED 전환 → Crew
               'VOICE_REQUEST',     -- COMPLETED + 5일 (lazy)
               'CANCELLED',         -- 취소 → Crew
               'INVITED')),         -- 공유 → 대상 회원
  action_id  UUID REFERENCES actions(id) ON DELETE CASCADE,
  event_key  TEXT UNIQUE NOT NULL,
  is_read    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_idx ON notifications(user_id, created_at DESC);

-- -------------------------------------------------------------
-- action_ai_metadata — AI 자동 분류 결과 (Discover 추천의 색인)
-- -------------------------------------------------------------
CREATE TABLE action_ai_metadata (
  action_id           UUID PRIMARY KEY REFERENCES actions(id) ON DELETE CASCADE,
  categories          TEXT[] NOT NULL DEFAULT '{}',
  activity_types      TEXT[] NOT NULL DEFAULT '{}',
  target_groups       TEXT[] NOT NULL DEFAULT '{}',
  participation_modes TEXT[] NOT NULL DEFAULT '{}',
  skills              TEXT[] NOT NULL DEFAULT '{}',
  keywords            TEXT[] NOT NULL DEFAULT '{}',
  difficulty          TEXT,
  ai_model            TEXT NOT NULL,
  prompt_version      TEXT NOT NULL,
  generated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  owner_confirmed     BOOLEAN NOT NULL DEFAULT false
);

-- -------------------------------------------------------------
-- ai_runs — AI 실행 로그. 발표의 "검증·개선" 근거 자료가 된다.
-- API 키나 비밀번호는 절대 넣지 않는다.
-- -------------------------------------------------------------
CREATE TABLE ai_runs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action_id      UUID REFERENCES actions(id) ON DELETE SET NULL,
  agent_type     TEXT NOT NULL CHECK (agent_type IN ('REVIEW','CLASSIFY','DISCOVER','TRENDS')),
  prompt_version TEXT NOT NULL,
  model          TEXT NOT NULL,
  output_json    JSONB,
  status         TEXT NOT NULL CHECK (status IN ('SUCCESS','SCHEMA_FAIL','API_FAIL','RETRY_OK')),
  error_code     TEXT,
  latency_ms     INT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ai_runs_agent_idx ON ai_runs(agent_type, created_at DESC);

-- -------------------------------------------------------------
-- 진행률 뷰 — 카드마다 합계 쿼리를 돌리지 않기 위해 (N+1 방지)
-- LEFT 상태인 참여는 집계에서 제외한다.
-- -------------------------------------------------------------
CREATE VIEW action_item_progress AS
SELECT
  ai.id           AS action_item_id,
  ai.action_id,
  ai.type,
  ai.name,
  ai.target_type,
  ai.min_required,
  ai.max_allowed,
  ai.unit,
  ai.gender_requirement,
  COALESCE(SUM(pi.quantity) FILTER (WHERE p.status <> 'LEFT'), 0)::INT AS current_count,
  -- 모집 마감 여부: RANGE 이고 max 에 도달했으면 마감
  (ai.max_allowed IS NOT NULL
   AND COALESCE(SUM(pi.quantity) FILTER (WHERE p.status <> 'LEFT'), 0) >= ai.max_allowed) AS is_full,
  -- 최소 인원 충족 여부
  (COALESCE(SUM(pi.quantity) FILTER (WHERE p.status <> 'LEFT'), 0) >= ai.min_required) AS is_min_met
FROM action_items ai
LEFT JOIN participation_items pi ON pi.action_item_id = ai.id
LEFT JOIN participations      p  ON p.id = pi.participation_id
GROUP BY ai.id;

-- -------------------------------------------------------------
-- updated_at 자동 갱신
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_touch       BEFORE UPDATE ON profiles       FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER actions_touch        BEFORE UPDATE ON actions        FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER participations_touch BEFORE UPDATE ON participations FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- -------------------------------------------------------------
-- 회원가입 시 profiles 자동 생성 (T1)
-- RLS 를 켜면 클라이언트에서 profiles INSERT 가 막히므로,
-- auth.users 에 트리거를 걸어 서버 쪽에서 만든다.
-- 화면에서는 signUp 의 options.data 로 값을 넘긴다.
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, nickname, gender, terms_agreed_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', '이름없음'),
    COALESCE(NEW.raw_user_meta_data->>'nickname', 'user_' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'gender', 'MALE'),
    now()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
