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
import { UsersRound, Package } from 'lucide-react';
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

  const Icon = item.type === 'PERSON' ? UsersRound : Package;

  // 상단 카운트 표기 — MINIMUM(최소 수량형)도 "현재 / 목표" 분수로 보여준다(2026-09-22).
  // quota.ts 의 countLabel("30개 모였어요")은 다른 화면(Join·Result 등)이 그대로 쓰므로
  // 건드리지 않고, 이 화면 전용 표기만 여기서 새로 만든다.
  // ★ 규칙 위반 아님 — 금지된 건 "퍼센트"(150% 같은 의미 없는 숫자)뿐, 분수 표기는
  //   오히려 분자·분모가 뭔지 명확해서 이전 "30개 모집" 표기의 모호함을 해결한다.
  const topCountLabel =
    item.target_type === 'MINIMUM'
      ? `${current}${item.unit} / ${item.min_required}${item.unit}`
      : state.countLabel;
  // 분모(목표 수)는 항목 아이콘과 같은 색으로 — 채워졌는지 한눈에 보이게 (2026-09-22)
  const [countNumerator, countDenominator] = topCountLabel.split(' / ');

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'flex h-9 w-9 flex-none items-center justify-center rounded-full',
            state.isMinMet ? 'bg-emerald-50' : 'bg-neutral-100',
          )}
        >
          <Icon
            className={cn(
              'h-[18px] w-[18px]',
              state.isMinMet ? 'text-emerald-600' : 'text-neutral-500',
            )}
            aria-hidden="true"
          />
        </div>

        <div className="flex flex-1 flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-sm font-bold text-neutral-900">{item.name}</span>
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

        <span
          className={cn(
            'shrink-0 text-sm font-bold tabular-nums',
            state.isFull ? 'text-neutral-400' : 'text-neutral-900',
          )}
        >
          {countNumerator}
          {countDenominator && (
            <span
              className={cn(
                'font-medium',
                state.isMinMet ? 'text-emerald-600' : 'text-neutral-500',
              )}
            >
              {' '}
              / {countDenominator}
            </span>
          )}
        </span>
      </div>

      <div
        className="h-1.5 overflow-hidden rounded-full bg-neutral-200"
        role="progressbar"
        aria-valuenow={Math.round(state.ratio * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${item.name} 모집 현황`}
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-300',
            state.isMinMet ? 'bg-emerald-500' : 'bg-neutral-400',
          )}
          style={{ width: `${Math.max(state.ratio * 100, 2)}%` }}
        />
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
