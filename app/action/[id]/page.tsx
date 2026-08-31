/**
 * Action Detail.
 *
 * 비회원도 볼 수 있습니다. 초대 링크로 바로 들어오는 화면이기도 합니다.
 *
 * ★ params 는 Promise 입니다. await 해야 합니다. (Next.js 15)
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActionDetail } from '@/lib/queries/actions';
import { QuotaProgress } from '@/components/action/QuotaProgress';
import { ActionGallery } from '@/components/action/ActionGallery';
import { AddressBox } from '@/components/action/AddressBox';
import { Avatar } from '@/components/ui/Avatar';
import { StatusBadge } from '@/components/ui/Badge';
import { LikeButton, SaveButton, FollowButton } from '@/components/ui/ToggleButtons';
import { Header } from '@/components/layout/Header';
import {
  formatActivityPeriod,
  formatDateShort,
  timeUntilDeadline,
} from '@/lib/utils/date';

export default async function ActionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const action = await getActionDetail(supabase, id, user?.id ?? null);
  if (!action) notFound();

  const deadline = timeUntilDeadline(action.recruitEndAt);
  const allFull = action.items.length > 0 && action.items.every((i) => i.isFull);

  // ── 하단 버튼을 무엇으로 보여줄지 ──────────────────────────
  // 순서가 중요합니다. 위쪽 조건이 먼저 걸립니다.
  const cta = (() => {
    if (action.status === 'CANCELLED')
      return { label: '취소된 액션이에요', disabled: true } as const;
    if (action.isOwner)
      return { label: '내가 만든 액션', href: '/activity?tab=created' } as const;
    if (action.myParticipation && action.myParticipation !== 'LEFT')
      return { label: 'CREW CHAT으로 가기', href: `/action/${id}/chat` } as const;
    if (action.status === 'COMPLETED')
      return { label: '결과 보기', href: `/action/${id}/result` } as const;
    if (action.status === 'ENDED')
      return { label: '활동이 끝났어요', disabled: true } as const;
    if (action.recruitClosed)
      return { label: '모집이 마감되었어요', disabled: true } as const;
    if (allFull)
      return { label: '모집이 완료되었어요', disabled: true } as const;
    return { label: '참여하기', href: `/action/${id}/join` } as const;
  })();

  return (
    <main className="pb-32">
      <Header
        back
        backHref="/"
        right={
          <Link
            href={`/action/${id}/share`}
            aria-label="공유"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-lg hover:bg-neutral-100"
          >
            ↗
          </Link>
        }
      />

      <ActionGallery
        urls={action.imageUrls}
        thumbnailIndex={action.thumbnailIndex}
        alt={action.title}
      />

      <div className="flex flex-col gap-6 px-5 pt-5">
        {/* 제목 영역 */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="rounded bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-600">
              {action.category}
            </span>
            <StatusBadge status={action.status} />
            {deadline && action.status === 'ACTIVE' && (
              <span className="text-[11px] font-medium text-amber-700">
                모집 {deadline}
              </span>
            )}
          </div>

          <h1 className="text-[20px] font-bold leading-snug tracking-tight text-neutral-900">
            {action.title}
          </h1>
        </div>

        {/* 취소 사유 */}
        {action.status === 'CANCELLED' && action.cancelReason && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-800">
              이 액션은 취소되었어요
            </p>
            <p className="mt-1 text-sm leading-relaxed text-red-700">
              {action.cancelReason}
            </p>
          </div>
        )}

        {/* 만든 사람 */}
        <div className="flex items-center gap-3">
          <Link href={`/user/${action.owner.id}`} className="flex items-center gap-3">
            <Avatar name={action.owner.nickname} />
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-neutral-900">
                @{action.owner.nickname}
              </span>
              {action.owner.bio && (
                <span className="line-clamp-1 text-[12px] text-neutral-500">
                  {action.owner.bio}
                </span>
              )}
            </div>
          </Link>
          {user && !action.isOwner && (
            <FollowButton
              targetUserId={action.owner.id}
              initialFollowing={action.followingOwner}
              className="ml-auto"
            />
          )}
        </div>

        {/* 소개 */}
        {action.description && (
          <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-neutral-700">
            {action.description}
          </p>
        )}

        {/* 모집 현황 */}
        <section className="flex flex-col gap-4">
          <h2 className="text-[15px] font-bold text-neutral-900">모집 현황</h2>
          {action.items.length === 0 ? (
            <p className="text-sm text-neutral-400">등록된 모집 항목이 없어요.</p>
          ) : (
            <div className="flex flex-col gap-5 rounded-xl border border-neutral-200 p-4">
              {action.items.map((item) => (
                <QuotaProgress
                  key={item.id}
                  item={item}
                  current={item.currentCount}
                  detailed
                  conditionName={item.conditionName}
                />
              ))}
            </div>
          )}
        </section>

        {/* 일정 & 장소 */}
        <section className="flex flex-col gap-3">
          <h2 className="text-[15px] font-bold text-neutral-900">일정 &amp; 장소</h2>
          <div className="flex flex-col gap-1 rounded-xl bg-neutral-50 p-4">
            <p className="text-sm font-medium text-neutral-900">
              {formatActivityPeriod(action.activityStartAt, action.activityEndAt)}
            </p>
            {action.recruitEndAt && (
              <p className="text-[12px] text-neutral-500">
                모집 마감 · {formatDateShort(action.recruitEndAt)}
              </p>
            )}
          </div>
          {action.address && <AddressBox address={action.address} />}
        </section>

        {/* 안내사항 */}
        {action.notice && (
          <section className="flex flex-col gap-2">
            <h2 className="text-[15px] font-bold text-neutral-900">안내사항</h2>
            <p className="whitespace-pre-wrap rounded-xl bg-amber-50 p-4 text-[13px] leading-relaxed text-amber-900">
              {action.notice}
            </p>
          </section>
        )}

        {/* 좋아요 · 저장 */}
        <div className="flex items-center gap-1 border-t border-neutral-100 pt-4">
          <LikeButton
            actionId={action.id}
            initialLiked={action.likedByMe}
            initialCount={action.likeCount}
          />
          <SaveButton
            actionId={action.id}
            initialSaved={action.savedByMe}
            initialCount={action.saveCount}
          />
          <span className="ml-auto text-[13px] text-neutral-500">
            {action.crewCount}명이 함께해요
          </span>
        </div>
      </div>

      {/* 하단 고정 버튼 */}
      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-app border-t border-neutral-200 bg-white p-4">
        {'href' in cta && cta.href ? (
          <Link
            href={cta.href}
            className="flex h-13 w-full items-center justify-center rounded-xl bg-neutral-900 text-[15px] font-semibold text-white"
          >
            {cta.label}
          </Link>
        ) : (
          <button
            disabled
            className="h-13 w-full cursor-not-allowed rounded-xl bg-neutral-200 text-[15px] font-semibold text-neutral-400"
          >
            {cta.label}
          </button>
        )}
      </div>
    </main>
  );
}
