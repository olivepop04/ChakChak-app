-- ⚠️ 사용 중지 (2026-09-01) — 이 파일은 실행하지 마세요.
--    시연 데이터는 `npm run seed` (scripts/seed.mjs) 가 넣습니다. 기록용으로만 남겨둡니다.

-- =============================================================
-- 착착(CHAK CHAK) — 시연용 더미 데이터
--
-- 담당: 조장 (트렌드 Agent #2 의 전제 조건)
-- 목표: 액션 30~50개. 이게 없으면 트렌드 그래프가 빈 채로 발표에 나간다.
--
-- 주의: 사용자(profiles)는 auth.users 를 참조하므로 SQL 로 직접 못 만든다.
--       대시보드 Authentication > Users 에서 테스트 계정을 먼저 몇 개 만들고,
--       그 id 를 아래 v_owner 에 넣어서 실행한다.
-- =============================================================

-- 예시 1개. 이 패턴을 복사해서 늘려간다.
DO $$
DECLARE
  v_owner  UUID := '00000000-0000-0000-0000-000000000000';  -- ← 실제 auth.users.id 로 교체
  v_action UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_owner) THEN
    RAISE NOTICE '시드 건너뜀: v_owner 를 실제 사용자 id 로 바꿔주세요.';
    RETURN;
  END IF;

  INSERT INTO actions (
    owner_id, title, description, category,
    image_urls, thumbnail_index, address, notice, status,
    recruit_end_at, activity_start_at, activity_end_at
  ) VALUES (
    v_owner,
    '우리 동네 보호소를 함께 도와요',
    '유기견 산책과 보호소 청소를 함께할 크루를 찾습니다.',
    '동물',
    ARRAY['https://images.unsplash.com/photo-1559027615-cd4628902d4a'],
    0,
    '서울특별시 성동구 ○○로 12',
    '편한 옷차림으로 와주세요. 물은 준비되어 있습니다.',
    'ACTIVE',
    now() + interval '5 days',
    now() + interval '6 days',
    now() + interval '6 days 3 hours'
  )
  RETURNING id INTO v_action;

  -- 정확히 3명 (조건 있음)
  INSERT INTO action_items
    (action_id, type, name, target_type, min_required, max_allowed, unit,
     gender_requirement, condition_name, sort_order)
  VALUES
    (v_action, 'PERSON', '요리 담당', 'RANGE', 3, 3, '명',
     'ANY', '조리사 자격증 보유', 1);

  -- 3~5명, 남성만
  INSERT INTO action_items
    (action_id, type, name, target_type, min_required, max_allowed, unit,
     gender_requirement, sort_order)
  VALUES
    (v_action, 'PERSON', '운반 지원', 'RANGE', 3, 5, '명', 'MALE', 2);

  -- 최소 10명, 계속 모집
  INSERT INTO action_items
    (action_id, type, name, target_type, min_required, max_allowed, unit, sort_order)
  VALUES
    (v_action, 'PERSON', '일반 Crew', 'MINIMUM', 10, NULL, '명', 3);

  -- 물품 (MINIMUM)
  INSERT INTO action_items
    (action_id, type, name, target_type, min_required, max_allowed, unit, sort_order)
  VALUES
    (v_action, 'GOODS', '분유',   'MINIMUM', 100, NULL, '통', 4),
    (v_action, 'GOODS', '기저귀', 'MINIMUM', 300, NULL, '개', 5);

  RAISE NOTICE '시드 액션 생성 완료: %', v_action;
END $$;
