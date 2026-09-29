-- =============================================================
-- 19. 취소된 액션은 소개·안내도 못 고치게 (2026-09-29)
-- =============================================================
--
-- SQL Editor 에 통째로 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.
--
-- 조장님 검수에서 나왔습니다. 취소된 액션인데 상세에 「액션 수정」 버튼이 있고,
-- 실제로 소개·안내사항을 고쳐 저장할 수 있었습니다.
--
-- 지금 규칙(14)은 「공개한 뒤에는 소개와 안내사항만 고칠 수 있다」 까지만 보고
-- 상태를 가리지 않습니다. 그래서 취소된 액션도 그 두 칸은 열려 있었습니다.
-- 취소는 「없던 일이 된 것」 이라(CLAUDE.md 규칙 12), 취소 사유와 함께
-- 그 시점 내용이 그대로 남아야 합니다.
--
--   화면에서 버튼을 숨기는 것(app/action/[id]/page.tsx)과
--   수정 화면에서 돌려보내는 것(app/action/[id]/edit/page.tsx)은 안내일 뿐이고,
--   규칙은 여기서 지킵니다 — 11 과 같은 원칙입니다.
--
-- 종료(ENDED)·완료(COMPLETED)는 그대로 둡니다. 9/3 F41 에서 일부러 열어 둔 것이고,
-- 이번 검수에서도 취소만 짚었습니다.
--
-- 모집 항목 추가는 이미 11 에서 「모집 중(ACTIVE)일 때만」 으로 막혀 있습니다.
--
-- ⚠️ 이 파일은 14_update.sql 의 lock_published_action() 을 덮어씁니다.
--    14 를 다시 실행했다면 이 파일도 다시 실행하세요.
-- =============================================================

CREATE OR REPLACE FUNCTION lock_published_action()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status = 'DRAFT' THEN
    RETURN NEW;   -- 작성 중에는 무엇이든 고칠 수 있다
  END IF;

  -- 19: 취소된 액션은 소개·안내도 잠근다
  IF OLD.status = 'CANCELLED'
     AND (NEW.description IS DISTINCT FROM OLD.description
          OR NEW.notice   IS DISTINCT FROM OLD.notice)
  THEN
    RAISE EXCEPTION '취소된 액션은 소개와 안내사항도 고칠 수 없어요.';
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

-- 트리거는 14 에서 이미 이 함수를 가리키고 있어서 다시 만들 필요가 없습니다.
-- 함수만 바꾸면 바로 적용됩니다.
