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

const TONE: Record<Tone, string> = {
  neutral: 'bg-neutral-100 text-neutral-600',
  live: 'bg-emerald-50 text-emerald-700',
  done: 'bg-blue-50 text-blue-700',
  warn: 'bg-amber-50 text-amber-700',
  off: 'bg-neutral-100 text-neutral-400',
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
        'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold',
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
