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

  const primaryCategory =
    action.category ||
    (action.categories && action.categories[0]) ||
    '카테고리';
  const allCategories =
    action.categories && action.categories.length > 0
      ? action.categories
      : [primaryCategory];
  const extraCount = allCategories.length - 1;

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
        <div className="relative z-10 flex flex-row gap-3 p-3 w-full pointer-events-none">
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
            <div className="absolute left-1.5 top-1.5 z-10 inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/50 px-2 py-0.5 backdrop-blur-md shrink-0 whitespace-nowrap">
              <span className="text-[10px] font-medium text-white">
                {primaryCategory}
              </span>
              {extraCount > 0 && (
                <>
                  <span className="text-[10px] font-normal text-white/70">
                    +{extraCount}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* 우측 정보 */}
          <div className="flex flex-1 flex-col justify-between min-w-0">
            <div>
              {/* 상태 뱃지 + 제목 수평(인라인) 배치 */}
              <div className="flex items-center gap-2 min-w-0">
                {showStatus && (
                  <div className="shrink-0">
                    <StatusBadge
                      status={action.status}
                      recruitClosed={isRecruitClosed}
                    />
                  </div>
                )}
                <h3 className="flex-1 truncate text-[15px] font-bold leading-snug text-neutral-900 min-w-0">
                  {action.title}
                </h3>
              </div>

              {action.summary && (
                <p className="line-clamp-2 mt-1 text-xs text-neutral-500">
                  {action.summary}
                </p>
              )}
            </div>

            <div className="mt-2 flex flex-col gap-1.5">
              <p className="text-[11px] text-neutral-400">
                {formatDate(action.activityStartAt)}
                {action.address ? ` · ${action.address.split(' ').slice(0, 2).join(' ')}` : ''}
              </p>

              {/* 통계 + 아바타 */}
              <div className="flex items-center justify-between gap-1.5 text-xs text-neutral-500 border-t border-neutral-100 pt-1.5">
                <Link
                  href={action.owner?.id ? `/user/${action.owner.id}` : '#'}
                  onClick={(e) => e.stopPropagation()}
                  className="pointer-events-auto cursor-pointer flex items-center gap-1 min-w-0 flex-1 text-xs text-neutral-600 hover:underline active:opacity-70 transition-opacity"
                >
                  <Avatar name={action.owner?.nickname ?? '호스트'} size="sm" />
                  <span className="text-xs text-neutral-600 truncate min-w-[36px]">
                    @{action.owner?.nickname ?? '호스트'}
                  </span>
                </Link>

                <div className="flex items-center gap-0.5 text-[11px] shrink-0 pointer-events-auto">
                  <CrewAnchorButton
                    count={action.crewCount ?? 0}
                    className="px-0.5 py-0.5 text-[11px] gap-0.5"
                  />
                  <LikeButton
                    actionId={action.id}
                    initialLiked={action.likedByMe}
                    initialCount={action.likeCount ?? 0}
                    className="px-0.5 py-0.5 text-[11px] gap-0.5"
                  />
                  <SaveButton
                    actionId={action.id}
                    initialSaved={action.savedByMe}
                    initialCount={action.saveCount ?? 0}
                    className="px-0.5 py-0.5 text-[11px] gap-0.5"
                  />
                  <ShareButton
                    actionId={action.id}
                    actionTitle={action.title}
                    count={action.shareCount ?? 0}
                    className="px-0.5 py-0.5 text-[11px] gap-0.5"
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
          <div className="absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/50 px-2.5 py-1 backdrop-blur-md shrink-0 whitespace-nowrap">
            <span className="text-xs font-medium text-white">
              {primaryCategory}
            </span>
            {extraCount > 0 && (
              <>
                <span className="text-[11px] font-normal text-white/70">
                  +{extraCount}
                </span>
              </>
            )}
          </div>
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
          <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-neutral-900">
            {action.title}
          </h3>

          {action.summary && (
            <p className="line-clamp-2 text-[13px] leading-relaxed text-neutral-500">
              {action.summary}
            </p>
          )}

          <p className="text-xs text-neutral-500">
            {formatDate(action.activityStartAt)}
            {action.address ? ` · ${action.address.split(' ').slice(0, 2).join(' ')}` : ''}
          </p>

          {/* 3. 인터랙티브 요소들 & 통계 4종 */}
          <div className="pointer-events-auto mt-1 flex items-center justify-between gap-2 border-t border-neutral-100 pt-3">
            {/* 작성자 프로필 링크 */}
            <Link
              href={action.owner?.id ? `/user/${action.owner.id}` : '#'}
              onClick={(e) => e.stopPropagation()}
              className="pointer-events-auto cursor-pointer flex items-center gap-1.5 min-w-0 flex-1 text-xs text-neutral-600 hover:underline active:opacity-70 transition-opacity"
            >
              <Avatar name={action.owner?.nickname ?? '호스트'} size="sm" />
              <span className="truncate text-xs text-neutral-600">
                @{action.owner?.nickname ?? '호스트'}
              </span>
            </Link>

            {/* 통계 4종 (참여인원, 좋아요, 저장, 공유) */}
            <div className="pointer-events-auto flex items-center justify-start gap-1 shrink-0 text-xs tabular-nums text-neutral-500">
              <CrewAnchorButton
                count={action.crewCount ?? 0}
                className="px-1 py-0.5 text-xs gap-1"
              />
              <LikeButton
                actionId={action.id}
                initialLiked={action.likedByMe}
                initialCount={action.likeCount ?? 0}
                className="px-1 py-0.5 text-xs gap-1"
              />
              <SaveButton
                actionId={action.id}
                initialSaved={action.savedByMe}
                initialCount={action.saveCount ?? 0}
                className="px-1 py-0.5 text-xs gap-1"
              />
              <ShareButton
                actionId={action.id}
                actionTitle={action.title}
                count={action.shareCount ?? 0}
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
