/**
 * 액션 상세 화면 맨 아래 큰 버튼을 무엇으로 보여줄지 정하는 규칙.
 *
 * 화면에서 if 를 쌓지 말고 이 함수 하나만 부르세요.
 * 「착착 상태별 기능 및 버튼 최종 가이드」와 2026-09-07 회의 결정을 그대로 옮긴 것입니다.
 *
 * ★ 왜 화면 밖으로 뺐나 (2026-09-08)
 *   상세 화면 안에 규칙이 흩어져 있어서, 화면을 고치다가 규칙이 조용히 바뀐 적이 있습니다.
 *   조기 종료된 액션에서 「결과 작성」 버튼이 사라져, 배지는 "결과 작성 필요" 인데
 *   누를 것이 없는 화면이 나왔습니다. 여기 모아두면 tests/action-cta.test.ts 가 막아줍니다.
 *
 * ★ 조기 종료는 예정 종료와 똑같이 흘러갑니다 (CLAUDE.md 규칙 12).
 *   취소(CANCELLED)만 "없던 일" 이고, 조기 종료(ENDED)는 "하긴 했는데 일찍 끝난 것" 이라
 *   호스트가 결과를 써야 합니다. earlyEndReason 이 있다고 갈래를 나누면 안 됩니다.
 */
// node --test 가 그대로 읽을 수 있도록 상대 경로 + .ts 로 씁니다 (profile-validation 과 같은 방식)
import type { ActionStatus, ParticipationStatus } from '../constants/index.ts';

export type ActionCta =
  /** 누를 수 없는 안내 문구 */
  | { type: 'disabled'; label: string }
  /** 버튼 하나 */
  | { type: 'link'; label: string; href: string; isCrewChat?: boolean }
  /** 버튼 둘 — 왼쪽 CREW CHAT, 오른쪽 결과 작성 */
  | { type: 'host_ended_write_result'; chatHref: string; writeHref: string };

export interface ActionCtaInput {
  actionId: string;
  status: ActionStatus;
  isOwner: boolean;
  /** 내 참여 상태. 참여한 적 없으면 null, 나갔으면 'LEFT' */
  myParticipation: ParticipationStatus | null;
  /** 활동 종료 예정 시각 */
  activityEndAt: string | null;
  /** 모집 마감 시각이 지났나 */
  recruitClosed: boolean;
  /** 모집 항목이 전부 찼나 */
  allItemsFull: boolean;
  /** 테스트에서 시각을 고정할 때만 넘깁니다 */
  now?: Date;
}

export function getActionCta({
  actionId,
  status,
  isOwner,
  myParticipation,
  activityEndAt,
  recruitClosed,
  allItemsFull,
  now = new Date(),
}: ActionCtaInput): ActionCta {
  const chatHref = `/action/${actionId}/chat`;
  const crewChat: ActionCta = {
    type: 'link',
    label: '함께하는 크루와 이야기하기',
    href: chatHref,
    isCrewChat: true,
  };

  // 활동 종료 시각이 지났는데 아직 상태가 안 넘어간 사이 (sync_action_status 가 돌기 전)
  const isPastActivityEnd = activityEndAt ? now > new Date(activityEndAt) : false;

  // ① 취소됨 — 호스트도 참여자도 똑같이 막힌다
  if (status === 'CANCELLED') {
    return { type: 'disabled', label: '취소된 액션이에요' };
  }

  // ② 결과가 나옴 — 호스트도 참여자도 결과를 본다
  if (status === 'COMPLETED') {
    return { type: 'link', label: '결과 보기', href: `/action/${actionId}/result` };
  }

  // ③ 호스트
  if (isOwner) {
    // 활동이 끝났다면(조기 종료 포함) 결과를 쓸 길이 반드시 있어야 한다
    if (status === 'ENDED' || isPastActivityEnd) {
      return {
        type: 'host_ended_write_result',
        chatHref,
        writeHref: `/action/${actionId}/result/write`,
      };
    }
    return crewChat;
  }

  // ④ 참여한 크루 — 나간 사람은 제외
  if (myParticipation && myParticipation !== 'LEFT') {
    return crewChat;
  }

  // ⑤ 참여하지 않은 사람
  if (status === 'ENDED' || isPastActivityEnd) {
    return { type: 'disabled', label: '활동이 끝났어요' };
  }
  if (recruitClosed) {
    return { type: 'disabled', label: '모집이 마감되었어요' };
  }
  if (allItemsFull) {
    return { type: 'disabled', label: '모집이 완료되었어요' };
  }

  return { type: 'link', label: '참여하기', href: `/action/${actionId}/join` };
}
