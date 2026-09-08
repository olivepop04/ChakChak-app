import type { ActionStatus, ParticipationStatus } from '@/lib/constants';

export type CtaConfig =
  | { type: 'disabled'; label: string }
  | { type: 'link'; label: string; href: string; isCrewChat?: boolean }
  | { type: 'host_ended_write_result'; chatHref: string; writeHref: string };

export function getActionCta({
  actionId,
  status,
  isOwner,
  myParticipation,
  activityEndAt,
  recruitClosed,
  allItemsFull,
}: {
  actionId: string;
  status: ActionStatus;
  isOwner: boolean;
  myParticipation?: ParticipationStatus | null;
  activityEndAt?: string | null;
  recruitClosed?: boolean;
  allItemsFull?: boolean;
}): CtaConfig {
  const isPastActivityEnd = activityEndAt
    ? new Date() > new Date(activityEndAt)
    : false;

  // 1. 취소됨 (공통)
  if (status === 'CANCELLED') {
    return { type: 'disabled', label: '취소된 액션이에요' };
  }

  // 2. 결과 작성 후 / 완료 (공통)
  if (status === 'COMPLETED') {
    return { type: 'link', label: '결과 보기', href: `/action/${actionId}/result` };
  }

  // 3. 호스트일 때 (action.isOwner === true)
  if (isOwner) {
    if (status === 'ENDED' || isPastActivityEnd) {
      return {
        type: 'host_ended_write_result',
        chatHref: `/action/${actionId}/chat`,
        writeHref: `/action/${actionId}/result/write`,
      };
    }
    return {
      type: 'link',
      label: '함께하는 크루와 이야기하기',
      href: `/action/${actionId}/chat`,
      isCrewChat: true,
    };
  }

  // 4. 일반 사용자/참여자일 때 (action.isOwner === false)
  if (myParticipation && myParticipation !== 'LEFT') {
    return {
      type: 'link',
      label: '함께하는 크루와 이야기하기',
      href: `/action/${actionId}/chat`,
      isCrewChat: true,
    };
  }

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
