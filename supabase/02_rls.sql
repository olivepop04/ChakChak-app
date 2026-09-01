-- =============================================================
-- 착착(CHAK CHAK) — RLS (Row Level Security) 정책
-- 01_schema.sql 다음에 실행한다.
--
-- ⚠️ 단독 재실행 금지 (2026-09-01 추가)
--    이 파일이 만든 participation_items_select 정책을 07_update.sql 이 덮어씁니다.
--    이 파일만 다시 돌리면 크루끼리 서로의 참여 항목을 못 보게 되어
--    The Crew 의 항목별 보기(F45)가 조용히 빈 화면이 됩니다.
--    다시 돌려야 하면 02 뒤에 05 → 06 → 07 → 08 을 순서대로 돌리세요.
--
-- 원칙
--  - AuthGuard 는 UX 보호, RLS 가 실제 보안이다. 둘 다 필요하다.
--  - anon key 는 브라우저에 그대로 노출된다. RLS 가 없으면 누구나 읽고 쓸 수 있다.
--  - 참여자 "명단" 은 비공개, 참여 "합계" 는 공개.  → 뷰로 분리한다.
-- =============================================================

-- -------------------------------------------------------------
-- 헬퍼 함수
-- 정책 안에서 다른 테이블을 조회하면 그 테이블의 RLS 도 다시 걸린다.
-- SECURITY DEFINER 함수로 감싸면 재귀와 성능 문제를 함께 피할 수 있다.
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_action_owner(a UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM actions WHERE id = a AND owner_id = auth.uid());
$$;

-- 나간 사람(LEFT)은 크루가 아니다 → 게시판 접근 차단
CREATE OR REPLACE FUNCTION is_action_crew(a UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM participations
    WHERE action_id = a AND user_id = auth.uid() AND status <> 'LEFT'
  );
$$;

CREATE OR REPLACE FUNCTION is_action_member(a UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT is_action_owner(a) OR is_action_crew(a);
$$;

CREATE OR REPLACE FUNCTION action_status(a UUID)
RETURNS TEXT LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT status FROM actions WHERE id = a;
$$;

-- 액션이 공개 상태인가 (비회원도 볼 수 있는가)
CREATE OR REPLACE FUNCTION is_action_public(a UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM actions
    WHERE id = a AND status IN ('ACTIVE','ENDED','COMPLETED','CANCELLED')
  );
$$;

-- =============================================================
-- profiles
-- =============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 공개 프로필은 누구나 조회 가능 (타인 프로필 화면)
CREATE POLICY profiles_select ON profiles
  FOR SELECT USING (true);

CREATE POLICY profiles_update ON profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- INSERT 정책은 두지 않는다. 가입 시 handle_new_user() 트리거가 만든다.

-- =============================================================
-- actions
-- =============================================================
ALTER TABLE actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY actions_select ON actions
  FOR SELECT USING (
    status IN ('ACTIVE','ENDED','COMPLETED','CANCELLED')
    OR owner_id = auth.uid()
  );

CREATE POLICY actions_insert ON actions
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY actions_update ON actions
  FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- 삭제는 공개된 적 없는 DRAFT 만
CREATE POLICY actions_delete ON actions
  FOR DELETE USING (auth.uid() = owner_id AND status = 'DRAFT');

-- =============================================================
-- action_items
-- =============================================================
ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY action_items_select ON action_items
  FOR SELECT USING (is_action_public(action_id) OR is_action_owner(action_id));

CREATE POLICY action_items_insert ON action_items
  FOR INSERT WITH CHECK (is_action_owner(action_id));

CREATE POLICY action_items_update ON action_items
  FOR UPDATE USING (is_action_owner(action_id)) WITH CHECK (is_action_owner(action_id));

CREATE POLICY action_items_delete ON action_items
  FOR DELETE USING (is_action_owner(action_id));

-- =============================================================
-- participations
--   명세서 초안의 "OR true" 는 넣지 않는다.
--   그게 있으면 누가 어디에 참여했는지 전부 공개된다.
--   Detail 화면의 진행률은 action_item_progress 뷰가 담당한다.
-- =============================================================
ALTER TABLE participations ENABLE ROW LEVEL SECURITY;

CREATE POLICY participations_select ON participations
  FOR SELECT USING (
    auth.uid() = user_id            -- 내 참여
    OR is_action_owner(action_id)   -- Owner 는 참여자 명단 확인 가능
    OR is_action_crew(action_id)    -- 같은 크루는 The Crew 화면에서 서로 확인 가능
  );

-- 참여 생성은 join_action() RPC 를 통해서만 한다 (정원·성별 검증 + 트랜잭션)
-- 직접 INSERT 는 막는다.

-- 나가기: 본인만, 활동 시작 전(BEFORE_ACTION)에만
CREATE POLICY participations_update ON participations
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============================================================
-- participation_items
-- =============================================================
ALTER TABLE participation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY participation_items_select ON participation_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM participations p
      WHERE p.id = participation_items.participation_id
        AND (p.user_id = auth.uid() OR is_action_owner(p.action_id))
    )
  );

-- =============================================================
-- action_results — 결과는 공개
-- =============================================================
ALTER TABLE action_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY action_results_select ON action_results
  FOR SELECT USING (is_action_public(action_id) OR is_action_owner(action_id));

CREATE POLICY action_results_insert ON action_results
  FOR INSERT WITH CHECK (is_action_owner(action_id));

CREATE POLICY action_results_update ON action_results
  FOR UPDATE USING (is_action_owner(action_id)) WITH CHECK (is_action_owner(action_id));

-- =============================================================
-- crew_voices — 소감은 결과 화면에 공개
-- 작성은 submit_crew_voice() RPC 로만 (상태 전환과 한 트랜잭션)
-- =============================================================
ALTER TABLE crew_voices ENABLE ROW LEVEL SECURITY;

CREATE POLICY crew_voices_select ON crew_voices
  FOR SELECT USING (is_action_public(action_id) OR is_action_owner(action_id));

-- =============================================================
-- follows — 팔로워/팔로잉 목록 화면이 있으므로 공개
-- =============================================================
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY follows_select ON follows FOR SELECT USING (true);

CREATE POLICY follows_insert ON follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY follows_delete ON follows
  FOR DELETE USING (auth.uid() = follower_id);

-- =============================================================
-- saves — 저장 목록은 비공개. 본인 것만 조회 가능.
-- 카드에 보이는 "저장 수" 는 action_social_counts 뷰가 담당한다.
-- =============================================================
ALTER TABLE saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY saves_select ON saves FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY saves_insert ON saves
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY saves_delete ON saves
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================
-- likes — 목록 화면이 없다. 본인이 눌렀는지만 알면 된다.
-- 카운트는 뷰에서.
-- =============================================================
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY likes_select ON likes FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY likes_insert ON likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY likes_delete ON likes
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================
-- chat_messages — Owner 와 유효한 Crew 만. 나간 사람은 못 본다.
-- 작성은 ACTIVE / ENDED 에서만. COMPLETED / CANCELLED 는 읽기 전용.
-- =============================================================
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_select ON chat_messages
  FOR SELECT USING (is_action_member(action_id));

CREATE POLICY chat_insert ON chat_messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND is_action_member(action_id)
    AND action_status(action_id) IN ('ACTIVE','ENDED')
  );

-- 삭제는 soft delete(UPDATE deleted_at). 본인 글만, 아직 안 지운 글만.
CREATE POLICY chat_update ON chat_messages
  FOR UPDATE USING (auth.uid() = user_id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = user_id);

-- =============================================================
-- notifications — 본인 것만. 생성은 서버(Service Role)에서만 한다.
-- 알림은 "남에게" 만들어 주는 것이라 auth.uid() 기반 INSERT 정책이 성립하지 않는다.
-- =============================================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_select ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY notifications_update ON notifications
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============================================================
-- action_ai_metadata — 추천 색인. 공개 액션이면 읽기 가능.
-- =============================================================
ALTER TABLE action_ai_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_meta_select ON action_ai_metadata
  FOR SELECT USING (is_action_public(action_id) OR is_action_owner(action_id));

CREATE POLICY ai_meta_update ON action_ai_metadata
  FOR UPDATE USING (is_action_owner(action_id)) WITH CHECK (is_action_owner(action_id));

-- =============================================================
-- ai_runs — 클라이언트 접근 없음. RLS 만 켜고 정책은 두지 않는다.
-- (정책이 없으면 anon/authenticated 는 아무것도 못 한다. 서버만 접근.)
-- =============================================================
ALTER TABLE ai_runs ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- 집계 전용 뷰 — 개인 정보 없이 숫자만 노출한다.
-- 뷰는 기본적으로 security_invoker = off 이므로 밑단 테이블의 RLS 를 우회한다.
-- 여기서는 그게 의도다: 참여자 명단은 막고 합계만 공개한다.
-- =============================================================
CREATE VIEW action_social_counts AS
SELECT
  a.id AS action_id,
  (SELECT COUNT(*) FROM likes  l WHERE l.action_id = a.id)::INT AS like_count,
  (SELECT COUNT(*) FROM saves  s WHERE s.action_id = a.id)::INT AS save_count,
  (SELECT COUNT(*) FROM participations p
     WHERE p.action_id = a.id AND p.status <> 'LEFT')::INT       AS crew_count
FROM actions a;

GRANT SELECT ON action_item_progress  TO anon, authenticated;
GRANT SELECT ON action_social_counts  TO anon, authenticated;

-- =============================================================
-- Storage 버킷과 정책 (T11)
-- 파일 경로 규칙: {action_id}/{uuid}.{확장자}
-- 경로 첫 조각을 action_id 로 보고 그 액션의 Owner 인지 확인한다.
-- =============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('action-images', 'action-images', true),
       ('result-images', 'result-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "action_images_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'action-images');

CREATE POLICY "action_images_write" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'action-images'
    AND is_action_owner(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "action_images_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'action-images'
    AND is_action_owner(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "result_images_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'result-images');

CREATE POLICY "result_images_write" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'result-images'
    AND is_action_owner(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "result_images_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'result-images'
    AND is_action_owner(((storage.foldername(name))[1])::uuid)
  );
