/**
 * 상태 배지.
 *
 *   <StatusBadge status="ACTIVE" />                → 모집 중
 *   <ParticipationBadge status="AFTER_ACTION" />   → 소감 작성 필요
 *   <Badge tone="warn">마감 임박</Badge>
 *
 * 문구는 lib/constants 의 라벨을 쓰므로 직접 적을 필요가 없습니다.
 */
import {
  ACTION_STATUS_LABEL,
  PARTICIPATION_STATUS_LABEL,
  type ActionStatus,
  type ParticipationStatus,
} from '@/lib/constants';
import { cn } from '@/lib/utils/cn';

type Tone = 'neutral' | 'live' | 'done' | 'warn' | 'off';

/**
 * 2026-09-29 — tailwind 기본색(emerald·blue·amber)을 디자인 가이드 기능색으로 전부 교체.
 * 내 액션 통일안(9/28)에서 정한 톤 규칙 그대로입니다:
 *   모집 중·참여 예정 = 진행중(info) · 결과/소감 작성 필요 = 주의(warning) ·
 *   완료·참여 완료 = 완료(brand) · 작성 중·모집 마감 = 중립 · 취소됨 = 중립(한 단계 옅은 글자)
 * 중립(연한) #F0F0F0 · 중립(진한) #7A7A7A 는 tailwind 토큰이 없어 값으로 적었습니다.
 */
const TONE: Record<Tone, string> = {
  neutral: 'bg-[#F0F0F0] text-[#7A7A7A]',
  live: 'bg-info-soft text-info',
  done: 'bg-brand-soft text-brand',
  warn: 'bg-warning-soft text-warning-ink',
  off: 'bg-[#F0F0F0] text-neutral-400',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center min-w-[5rem] rounded-full px-2 py-0.5 text-caption font-semibold',
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const ACTION_TONE: Record<ActionStatus, Tone> = {
  DRAFT: 'neutral',
  ACTIVE: 'live',
  ENDED: 'warn',
  COMPLETED: 'done',
  CANCELLED: 'off',
};

export function StatusBadge({
  status,
  recruitClosed = false,
  customLabel,
  className,
}: {
  status: ActionStatus;
  recruitClosed?: boolean;
  customLabel?: string;
  className?: string;
}) {
  const isClosed = status === 'ACTIVE' && recruitClosed;
  const tone = isClosed ? 'neutral' : ACTION_TONE[status];
  const label = customLabel ?? (isClosed ? '모집 마감' : ACTION_STATUS_LABEL[status]);

  return (
    <Badge tone={tone} className={className}>
      {label}
    </Badge>
  );
}

const PART_TONE: Record<ParticipationStatus, Tone> = {
  BEFORE_ACTION: 'live',
  AFTER_ACTION: 'warn',
  ACTUALLY_PARTICIPATED: 'done',
  LEFT: 'off',
};

export function ParticipationBadge({
  status,
  className,
}: {
  status: ParticipationStatus;
  className?: string;
}) {
  return (
    <Badge tone={PART_TONE[status]} className={className}>
      {PARTICIPATION_STATUS_LABEL[status]}
    </Badge>
  );
}
