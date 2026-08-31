/**
 * 모집 항목 진행 상황 표시.
 *
 * 두 가지 모습이 나온다 (팀 합의 D1):
 *
 *  정해진 인원(RANGE) — 목표가 명확하니 프로그레스바 + 퍼센트
 *      요리 담당 · 정확히 3명
 *      3 / 3명   ████████████  모집이 완료되었어요.
 *
 *  최소 인원(MINIMUM) — 퍼센트를 쓰지 않는다. 150% 는 의미가 없다.
 *      일반 Crew · 최소 10명
 *      15명 참여  ████████████  최소 인원이 충족되었어요.
 *
 * 숫자를 직접 조합하지 말고 lib/utils/quota.ts 의 함수를 쓸 것.
 */
import {
  describeTarget,
  getQuotaState,
  type QuotaItem,
} from '@/lib/utils/quota';
import { GENDER_REQUIREMENT_LABEL } from '@/lib/constants';
import { cn } from '@/lib/utils/cn';

interface QuotaProgressProps {
  item: QuotaItem;
  current: number;
  /** 조건·성별 뱃지까지 보여줄지 (Detail·Join 에서 true) */
  detailed?: boolean;
  conditionName?: string | null;
  className?: string;
}

export function QuotaProgress({
  item,
  current,
  detailed = false,
  conditionName,
  className,
}: QuotaProgressProps) {
  const state = getQuotaState(item, current);
  const genderReq = item.gender_requirement ?? 'ANY';

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-sm font-semibold text-neutral-900">
          {item.name}
        </span>
        <span className="text-xs text-neutral-500">{describeTarget(item)}</span>

        {detailed && genderReq !== 'ANY' && (
          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-neutral-600">
            {GENDER_REQUIREMENT_LABEL[genderReq]}
          </span>
        )}
        {detailed && conditionName && (
          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-neutral-600">
            {conditionName}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span
          className={cn(
            'shrink-0 text-sm font-semibold tabular-nums',
            state.isFull ? 'text-neutral-400' : 'text-neutral-900',
          )}
        >
          {state.countLabel}
        </span>

        <div
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200"
          role="progressbar"
          aria-valuenow={Math.round(state.ratio * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${item.name} 모집 현황`}
        >
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-300',
              state.isFull
                ? 'bg-neutral-400'
                : state.isMinMet
                  ? 'bg-emerald-500'
                  : 'bg-neutral-900',
            )}
            style={{ width: `${Math.max(state.ratio * 100, 2)}%` }}
          />
        </div>
      </div>

      <p
        className={cn(
          'text-xs',
          state.isMinMet ? 'text-emerald-700' : 'text-neutral-500',
        )}
      >
        {state.hint}
      </p>
    </div>
  );
}
