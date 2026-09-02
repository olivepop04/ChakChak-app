-- =============================================================
-- 07 — 크루끼리 "누가 어느 항목에 오는지" 보이게 (F45)
--
-- SQL Editor 에 통째로 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.
-- =============================================================


-- -------------------------------------------------------------
-- participation_items 조회 범위 조정
--
-- 문제
--   The Crew 화면에서 "1일차 배식팀에 누가 오나" 를 보려 했더니
--   크루에게는 자기 것만 보였습니다.
--
--   participations(참여 사실)는 같은 크루끼리 서로 보이는데,
--   participation_items(무엇에 참여했는지)는 본인과 호스트만
--   볼 수 있게 되어 있었습니다.
--
-- 판단
--   두 가지가 성격이 다릅니다.
--
--   · 사람 항목(PERSON)  "1일차 배식팀" · "오전 조"
--     → 같이 가는 사람이 누군지 아는 것은 The Crew 화면의 목적입니다.
--       크루끼리 공개합니다.
--
--   · 물품 항목(GOODS)   "담요 10장" · "사료 50포"
--     → 누가 얼마나 냈는지는 서로 비교하게 되는 정보입니다.
--       본인과 호스트만 볼 수 있게 그대로 둡니다.
--
--   호스트는 둘 다 봅니다. 모집을 관리해야 하기 때문입니다.
--
-- 되돌리려면
--   아래 정책에서 is_action_crew 가 들어간 블록만 지우면
--   06 이전 상태(본인·호스트만)로 돌아갑니다.
-- -------------------------------------------------------------
DROP POLICY IF EXISTS participation_items_select ON participation_items;

CREATE POLICY participation_items_select ON participation_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM participations p
      WHERE p.id = participation_items.participation_id
        AND (
          -- 내 참여 내역
          p.user_id = auth.uid()

          -- 호스트는 전부 본다
          OR is_action_owner(p.action_id)

          -- 같은 크루는 "사람 항목" 만 본다 (누가 어느 조인지)
          OR (
            is_action_crew(p.action_id)
            AND EXISTS (
              SELECT 1 FROM action_items ai
              WHERE ai.id = participation_items.action_item_id
                AND ai.type = 'PERSON'
            )
          )
        )
    )
  );
