-- ============================================================
-- 16_update.sql — 남의 참여 통계가 0 으로 보이던 문제
-- 2026-09-08
-- ============================================================
--
-- 결정 사항 표에는 "타인 프로필 = 통계 유지 + 참여 목록은 완료된 것만" 이라고
-- 적혀 있는데, 화면에서는 그렇게 안 나왔습니다.
--
--   올리브의 실제 참여 완료      5 건
--   남이 프로필을 열면           "참여 액션 0", 목록도 "아직 완료한 액션이 없어요"
--
-- 이유는 participations 의 RLS 입니다 (02_rls.sql).
--
--   participations_select: 내 참여 OR 내가 만든 액션 OR 내가 속한 크루
--
-- 화면은 이 테이블을 세서 숫자를 만드니까, 남의 참여는 나와 겹치는 것만
-- 세어집니다. 에러도 안 나고 조용히 작은 숫자가 나옵니다 (규칙 3).
--
-- RLS 를 느슨하게 풀면 "누가 어디에 참여 예정인지" 까지 새어 나갑니다.
-- 그건 사생활이라 공개 대상이 아닙니다. 그래서 정책은 그대로 두고,
-- **공개하기로 정한 것만** 골라 주는 함수 두 개를 만듭니다.
--
--   공개    소감까지 쓴 참여(ACTUALLY_PARTICIPATED)의 개수
--   공개    그 참여가 걸린 액션 중 이미 끝난 것(ENDED · COMPLETED)의 id
--   비공개  참여 예정 · 나간 기록 · 어떤 항목을 골랐는지
--
-- SECURITY DEFINER 라 RLS 를 지나칩니다. 그래서 위 두 가지 말고는
-- 아무것도 돌려주지 않도록 SELECT 목록을 좁게 고정했습니다.

-- ── ① 참여 완료 개수 (여러 명 한 번에) ──────────────────────
CREATE OR REPLACE FUNCTION public_participation_counts(p_user_ids UUID[])
RETURNS TABLE (user_id UUID, participated_count INT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT p.user_id, COUNT(*)::INT
  FROM participations p
  WHERE p.user_id = ANY(p_user_ids)
    AND p.status = 'ACTUALLY_PARTICIPATED'
  GROUP BY p.user_id;
$$;

-- ── ② 참여 완료한 액션의 id (한 사람) ───────────────────────
--    끝난 액션만 돌려줍니다. 진행 중인 것은 "참여 예정" 을 노출하는 셈이라 뺍니다.
CREATE OR REPLACE FUNCTION public_participated_action_ids(p_user_id UUID)
RETURNS TABLE (action_id UUID)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT p.action_id
  FROM participations p
  JOIN actions a ON a.id = p.action_id
  WHERE p.user_id = p_user_id
    AND p.status = 'ACTUALLY_PARTICIPATED'
    AND a.status IN ('ENDED', 'COMPLETED');
$$;

-- 비회원도 프로필을 볼 수 있어야 하므로 anon 에게도 허용합니다.
GRANT EXECUTE ON FUNCTION public_participation_counts(UUID[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public_participated_action_ids(UUID) TO anon, authenticated;
