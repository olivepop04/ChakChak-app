'use client';

/**
 * 액션 카드. Home · Discover · Activity · 저장목록 · 프로필이 전부 이걸 쓴다.
 *
 * ★ props 는 여러 사람이 함께 쓰는 계약이다. 바꾸기 전에 팀에 알릴 것.
 *   보이는 모습(색·간격·타이포)은 디자이너 담당이라 마음껏 바꿔도 된다.
 *   대신 props 이름과 개수는 그대로 두어야 다른 화면이 안 깨진다.
 *
 * 데이터는 반드시 lib/queries/actions.ts 의 함수로 가져올 것.
 * 화면에서 직접 supabase 를 부르면 카드마다 모양이 달라진다.
 */
import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { StatusBadge } from '@/components/ui/Badge';
import {
  CrewAnchorButton,
  LikeButton,
  SaveButton,
  ShareButton,
} from '@/components/ui/ToggleButtons';
import type { ActionCardData } from '@/lib/types/view';
import { cn } from '@/lib/utils/cn';

interface ActionCardProps {
  action: ActionCardData;
  /** 카드를 기본 세로형(default)으로 보여줄지, 가로형(horizontal)으로 보여줄지 */
  variant?: 'default' | 'horizontal';
  /** 카드 우측 하단에 상태 배지를 보여줄지 (Activity 에서 true) */
  showStatus?: boolean;
  /** 카드 아래에 덧붙일 내용. Activity 의 CTA 버튼 등 */
  footer?: React.ReactNode;
  className?: string;
}

function formatDate(iso: string | null): string {
  if (!iso) return '날짜 미정';
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function ActionCard({
  action,
  variant = 'default',
  showStatus = false,
  footer,
  className,
}: ActionCardProps) {
  const isRecruitClosed =
    action.recruitClosed ??
    (action.recruitEndAt ? new Date(action.recruitEndAt) < new Date() : false);

  // 좋아요·저장: 초안·취소·종료·완료에서 "새로" 누르는 것을 막는다 (기획 결정 2026-09-10).
  //   이미 누른 것은 풀 수 있어야 한다 — 끝난 액션이 「저장한 액션」에 영영 남아
  //   목록이 정리 안 되던 문제 때문. 막는 것은 새로 누르는 것뿐이다.
  const reactionDisabled =
    action.status === 'DRAFT' ||
    action.status === 'CANCELLED' ||
    action.status === 'ENDED' ||
    action.status === 'COMPLETED';
  // 공유: 초안·취소만 막는다. 종료·완료된 액션도 공유는 가능 (기획 결정 2026-09-10).
  const shareDisabled =
    action.status === 'DRAFT' || action.status === 'CANCELLED';
  const reactionDisabledReason =
    action.status === 'DRAFT'
      ? 'draft'
      : action.status === 'CANCELLED'
        ? 'cancelled'
        : 'ended';

  const likeDisabled = reactionDisabled && !action.likedByMe;
  const saveDisabled = reactionDisabled && !action.savedByMe;

  const primaryCategory =
    action.category ||
    (action.categories && action.categories[0]) ||
    '카테고리';
  const allCategories =
    action.categories && action.categories.length > 0
      ? action.categories
      : [primaryCategory];

  if (variant === 'horizontal') {
    return (
      <article
        className={cn(
          'relative overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md',
          className,
        )}
      >
        {/* 1. 카드 전체 클릭 시 액션 상세로 이동하는 투명 덮개 링크 */}
        <Link href={`/action/${action.id}`} className="absolute inset-0 z-0">
          <span className="sr-only">{action.title}</span>
        </Link>

        {/* 2. 본문 컨텐츠 (덮개 링크 클릭 통과를 위해 pointer-events-none) */}
        <div className="relative z-10 flex flex-row gap-2.5 p-3.5 w-full pointer-events-none">
          {/* 좌측 썸네일 */}
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-neutral-100">
            {action.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={action.thumbnailUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-neutral-400">
                이미지 없음
              </div>
            )}
          </div>

          {/* 우측 정보 */}
          <div className="flex flex-1 flex-col justify-between min-w-0">
            <div>
              {/* 카테고리 1~3개 전부 노출 — 세로형 피드와 동일. 대표(첫 번째)는 채운 칩, 나머지는 외곽선 칩.
                  좁은 폭이면 flex-wrap 으로 다음 줄로 내려간다. (대표+n 표기로 되돌리기 쉬움)
                  썸네일 밖(정보 영역)에 두어 고배율에서도 이미지를 안 벗어난다. 2026-09-10 회의 */}
              <div className="mb-1.5 flex flex-wrap items-center gap-1">
                {allCategories.map((c, i) => (
                  <span
                    key={c}
                    className={cn(
                      'inline-flex items-center whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                      i === 0
                        ? 'bg-neutral-900 text-white'
                        : 'border border-neutral-300 text-neutral-500',
                    )}
                  >
                    {c}
                  </span>
                ))}
              </div>

              {/* 상태 뱃지 + 제목 수평(인라인) 배치.
                  배지가 길어지면(예: "결과 작성 필요") 제목 자리가 모자라 잘리므로,
                  자리가 부족하면 제목이 다음 줄로 내려가게 하고 최소 폭을 보장한다. */}
              <div className="flex flex-wrap items-start gap-x-2 gap-y-1 min-w-0">
                {showStatus && (
                  <div className="shrink-0">
                    <StatusBadge
                      status={action.status}
                      recruitClosed={isRecruitClosed}
                    />
                  </div>
                )}
                <h3 className="flex-1 min-w-[8rem] text-[15px] font-bold leading-snug text-neutral-900 break-keep">
                  {action.title}
                </h3>
              </div>

              {action.summary && (
                // 가로형은 소개글을 2줄까지만, 넘치면 말줄임(…). 전체 내용은 액션 상세에서 본다.
                // (세로형 피드는 말줄임 없이 전체 노출 — 의도적으로 다르다)
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-neutral-500">
                  {action.summary}
                </p>
              )}
            </div>

            <div className="mt-2 flex flex-col gap-1.5">
              <p className="text-[11px] text-neutral-400">
                {formatDate(action.activityStartAt)}
                {action.address ? ` · ${action.address.split(' ').slice(0, 2).join(' ')}` : ''}
              </p>

              {/* 통계 + 아바타 — 고배율에서 한 줄에 못 담으면 통계가 아래로 내려가게 flex-wrap */}
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 w-full min-w-0 pt-2 mt-1.5 border-t border-neutral-100">
                <Link
                  href={action.owner?.id ? `/user/${action.owner.id}` : '#'}
                  onClick={(e) => e.stopPropagation()}
                  className="pointer-events-auto cursor-pointer flex items-center gap-1 shrink-0 min-w-0 text-xs text-neutral-600 hover:underline active:opacity-70 transition-opacity"
                >
                  <Avatar name={action.owner?.nickname ?? '호스트'} size="xs" />
                  <span className="shrink-0 whitespace-nowrap text-[11px] font-medium text-neutral-600">
                    @{action.owner?.nickname ?? '호스트'}
                  </span>
                </Link>

                {/* 메타 4종: 375px에서는 초슬림 밀착, 넓은 화면(sm)에서는 홈피드 규격으로 확장 */}
                <div className="flex items-center gap-0.5 min-[410px]:gap-1 sm:gap-1.5 shrink-0 ml-auto pointer-events-auto text-[10px] min-[410px]:text-[11px] sm:text-xs font-medium text-neutral-500">
                  <CrewAnchorButton
                    count={action.crewCount ?? 0}
                    actionId={action.id}
                    className="!p-0 !px-0.5 min-[410px]:!px-1 sm:!py-0.5 !min-w-0 text-[10px] min-[410px]:text-[11px] sm:text-xs gap-0.5 sm:gap-1 shrink-0 [&_svg]:w-3.5 [&_svg]:h-3.5 sm:[&_svg]:w-4 sm:[&_svg]:h-4"
                    iconClassName="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0"
                  />
                  <LikeButton
                    actionId={action.id}
                    initialLiked={action.likedByMe}
                    initialCount={action.likeCount ?? 0}
                    disabled={likeDisabled}
                    disabledReason={reactionDisabledReason}
                    className="!p-0 !px-0.5 min-[410px]:!px-1 sm:!py-0.5 !min-w-0 text-[10px] min-[410px]:text-[11px] sm:text-xs gap-0.5 sm:gap-1 shrink-0 [&_svg]:w-3.5 [&_svg]:h-3.5 sm:[&_svg]:w-4 sm:[&_svg]:h-4"
                    iconClassName="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0"
                  />
                  <SaveButton
                    actionId={action.id}
                    initialSaved={action.savedByMe}
                    initialCount={action.saveCount ?? 0}
                    disabled={saveDisabled}
                    disabledReason={reactionDisabledReason}
                    className="!p-0 !px-0.5 min-[410px]:!px-1 sm:!py-0.5 !min-w-0 text-[10px] min-[410px]:text-[11px] sm:text-xs gap-0.5 sm:gap-1 shrink-0 [&_svg]:w-3.5 [&_svg]:h-3.5 sm:[&_svg]:w-4 sm:[&_svg]:h-4"
                    iconClassName="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0"
                  />
                  <ShareButton
                    actionId={action.id}
                    actionTitle={action.title}
                    count={action.shareCount ?? 0}
                    disabled={shareDisabled}
                    disabledReason={reactionDisabledReason}
                    className="!p-0 !px-0.5 min-[410px]:!px-1 sm:!py-0.5 !min-w-0 text-[10px] min-[410px]:text-[11px] sm:text-xs gap-0.5 sm:gap-1 shrink-0 [&_svg]:w-3.5 [&_svg]:h-3.5 sm:[&_svg]:w-4 sm:[&_svg]:h-4"
                    iconClassName="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {footer && (
          <div className="relative z-10 border-t border-neutral-100 px-4 py-3 pointer-events-auto">
            {footer}
          </div>
        )}
      </article>
    );
  }

  // 기본 세로형 레이아웃 (variant === 'default')
  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md',
        className,
      )}
    >
      {/* 1. 카드 전체 클릭 시 액션 상세로 이동하는 투명 덮개 링크 */}
      <Link href={`/action/${action.id}`} className="absolute inset-0 z-0">
        <span className="sr-only">{action.title}</span>
      </Link>

      {/* 2. 본문 컨텐츠 (덮개 링크 클릭 통과를 위해 pointer-events-none) */}
      <div className="relative z-10 flex flex-col pointer-events-none">
        <div className="relative w-full aspect-[16/10] overflow-hidden bg-neutral-100">
          {action.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={action.thumbnailUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-neutral-400">
              이미지 없음
            </div>
          )}
          {showStatus && (
            <div className="absolute right-3 top-3 z-10">
              <StatusBadge
                status={action.status}
                recruitClosed={isRecruitClosed}
                className="bg-white/90 shadow-xs"
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 p-4">
          {/* 카테고리 1~3개. 대표(첫 번째)는 채운 칩, 나머지는 외곽선 칩 — 홈 상단 필터 칩과 같은 시각 언어 */}
          <div className="flex flex-wrap gap-1">
            {allCategories.map((c, i) => (
              <span
                key={c}
                className={cn(
                  'inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium',
                  i === 0
                    ? 'bg-neutral-900 text-white'
                    : 'border border-neutral-300 text-neutral-600',
                )}
              >
                {c}
              </span>
            ))}
          </div>

          {/* 고배율에서 잘리지 않게 말줄임 없이 전체 노출. 카드가 길어지는 건 감수 (배율 확대 사용자는 전부 보길 원함) */}
          <h3 className="text-[15px] font-bold leading-snug text-neutral-900 break-keep">
            {action.title}
          </h3>

          {action.summary && (
            <p className="text-[13px] leading-relaxed text-neutral-500">
              {action.summary}
            </p>
          )}

          <p className="text-xs text-neutral-500">
            {formatDate(action.activityStartAt)}
            {action.address ? ` · ${action.address.split(' ').slice(0, 2).join(' ')}` : ''}
          </p>

          {/* 3. 인터랙티브 요소들 & 통계 4종
              고배율에서 작성자 아이디가 잘리지 않게 하고(말줄임 제거), 한 줄에 못 담으면
              flex-wrap 으로 통계 4종이 아래 줄로 내려가게 한다. 배율 감지는 필요 없다 —
              글자가 커지면 자리가 모자라 자동으로 줄바꿈된다. */}
          <div className="pointer-events-auto mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-2 border-t border-neutral-100 pt-3">
            {/* 작성자 프로필 링크 */}
            <Link
              href={action.owner?.id ? `/user/${action.owner.id}` : '#'}
              onClick={(e) => e.stopPropagation()}
              className="pointer-events-auto cursor-pointer flex items-center gap-1.5 min-w-0 flex-1 text-xs text-neutral-600 hover:underline active:opacity-70 transition-opacity"
            >
              <Avatar name={action.owner?.nickname ?? '호스트'} size="sm" />
              <span className="min-w-0 break-all text-xs text-neutral-600">
                @{action.owner?.nickname ?? '호스트'}
              </span>
            </Link>

            {/* 통계 4종 (참여인원, 좋아요, 저장, 공유) */}
            <div className="pointer-events-auto flex items-center justify-start gap-1 shrink-0 text-xs tabular-nums text-neutral-500">
              <CrewAnchorButton
                count={action.crewCount ?? 0}
                actionId={action.id}
                className="px-1 py-0.5 text-xs gap-1"
              />
              <LikeButton
                actionId={action.id}
                initialLiked={action.likedByMe}
                initialCount={action.likeCount ?? 0}
                disabled={likeDisabled}
                disabledReason={reactionDisabledReason}
                className="px-1 py-0.5 text-xs gap-1"
              />
              <SaveButton
                actionId={action.id}
                initialSaved={action.savedByMe}
                initialCount={action.saveCount ?? 0}
                disabled={saveDisabled}
                disabledReason={reactionDisabledReason}
                className="px-1 py-0.5 text-xs gap-1"
              />
              <ShareButton
                actionId={action.id}
                actionTitle={action.title}
                count={action.shareCount ?? 0}
                disabled={shareDisabled}
                disabledReason={reactionDisabledReason}
                className="px-1 py-0.5 text-xs gap-1"
              />
            </div>
          </div>
        </div>
      </div>

      {footer && (
        <div className="relative z-10 border-t border-neutral-100 px-4 py-3 pointer-events-auto">
          {footer}
        </div>
      )}
    </article>
  );
}
