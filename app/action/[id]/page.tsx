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
import { getActionCrew } from '@/lib/queries/participations';
import { QuotaProgress } from '@/components/action/QuotaProgress';
import { ActionGallery } from '@/components/action/ActionGallery';
import { AddressBox } from '@/components/action/AddressBox';
import { ActionCrewSection } from '@/components/action/ActionCrewSection';
import { Avatar } from '@/components/ui/Avatar';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { CrewAnchorButton, LikeButton, SaveButton, ShareButton, FollowButton } from '@/components/ui/ToggleButtons';
import { Header } from '@/components/layout/Header';
import {
  formatActivityPeriod,
  formatDateShort,
  timeUntilDeadline,
} from '@/lib/utils/date';
import type { UserSummary, CrewMember } from '@/lib/types/view';

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

  let action = null;
  try {
    action = await getActionDetail(supabase, id, user?.id ?? null);
  } catch {
    notFound();
  }
  if (!action) notFound();

  const isCrewMember =
    action.isOwner ||
    (!!action.myParticipation && action.myParticipation !== 'LEFT');

  let crewOwner: UserSummary | null = null;
  let crew: CrewMember[] = [];

  try {
    const res = await getActionCrew(supabase, id, user?.id ?? null);
    crewOwner = res.owner;
    crew = res.crew;
  } catch {
    // Crew 조회 실패 시 기본값 fallback
  }

  let displayMembers: UserSummary[] = crewOwner ? [crewOwner, ...crew] : crew;
  if (displayMembers.length === 0 && action.owner) {
    displayMembers = [
      {
        id: action.owner.id,
        nickname: action.owner.nickname,
        bio: action.owner.bio ?? null,
        participatedCount: 0,
        ledCount: 0,
        followedByMe: action.followingOwner ?? false,
      },
    ];
  }
  const summaryMembers = displayMembers.slice(0, 4);

  const deadline = timeUntilDeadline(action.recruitEndAt);
  const allFull = action.items.length > 0 && action.items.every((i) => i.isFull);
  const canViewChat =
    action.isOwner ||
    !!(action.myParticipation && action.myParticipation !== 'LEFT');
  const showMessageAccessButton =
    action.isOwner &&
    action.status !== 'CANCELLED' &&
    action.status !== 'COMPLETED';
  const canEditActionText =
    action.isOwner &&
    (action.status === 'ACTIVE' ||
      action.status === 'ENDED' ||
      action.status === 'COMPLETED' ||
      action.status === 'CANCELLED');

  const isPastActivityEnd = action.activityEndAt
    ? new Date() > new Date(action.activityEndAt)
    : false;

  // ── 하단 버튼을 무엇으로 보여줄지 ──────────────────────────
  // 순서가 중요합니다. 위쪽 조건이 먼저 걸립니다.
  type CtaConfig =
    | { type: 'disabled'; label: string }
    | { type: 'link'; label: string; href: string; isCrewChat?: boolean }
    | { type: 'host_ended_write_result'; chatHref: string; writeHref: string };

  const cta: CtaConfig = (() => {
    // 1. 취소됨 (공통: 호스트 & 일반 사용자)
    if (action.status === 'CANCELLED')
      return { type: 'disabled', label: '취소된 액션이에요' };

    // 2. 결과 작성 후 / 완료 (공통: 호스트 & 일반 사용자)
    if (action.status === 'COMPLETED')
      return { type: 'link', label: '결과 보기', href: `/action/${id}/result` };

    // 3. 호스트일 때 (action.isOwner === true)
    if (action.isOwner) {
      // 활동 종료일이 지남 (결과 아직 미작성)
      if (action.status === 'ENDED' || isPastActivityEnd) {
        return {
          type: 'host_ended_write_result',
          chatHref: `/action/${id}/chat`,
          writeHref: `/action/${id}/result/write`,
        };
      }
      // 활동 종료 전 (모집 중 · 마감 · 활동 중 전부)
      return {
        type: 'link',
        label: 'CREW CHAT',
        href: `/action/${id}/chat`,
        isCrewChat: true,
      };
    }

    // 4. 일반 사용자/참여자일 때 (action.isOwner === false)
    if (action.myParticipation && action.myParticipation !== 'LEFT')
      return {
        type: 'link',
        label: '함께하는 크루와 이야기하기',
        href: `/action/${id}/chat`,
        isCrewChat: true,
      };
    if (action.status === 'ENDED' || isPastActivityEnd)
      return { type: 'disabled', label: '활동이 끝났어요' };
    if (action.recruitClosed)
      return { type: 'disabled', label: '모집이 마감되었어요' };
    if (allFull)
      return { type: 'disabled', label: '모집이 완료되었어요' };

    return { type: 'link', label: '참여하기', href: `/action/${id}/join` };
  })();

  return (
    <main className="pb-52">
      <Header
        back
        backHref="/"
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
            <StatusBadge
              status={action.status}
              recruitClosed={action.recruitClosed}
            />
            {deadline && action.status === 'ACTIVE' && (
              <span className="text-[11px] font-medium text-amber-700">
                모집 {deadline}
              </span>
            )}
          </div>

          <h1 className="text-[20px] font-bold leading-snug tracking-tight text-neutral-900">
            {action.title}
          </h1>

          {canEditActionText && (
            <Link
              href={`/action/${id}/edit`}
              className="mt-1 inline-flex self-start rounded-lg border border-neutral-200 px-3 py-2 text-[12px] font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              소개·안내 수정
            </Link>
          )}
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
          <Link href={`/user/${action.owner?.id ?? ''}`} className="flex items-center gap-3">
            <Avatar name={action.owner?.nickname ?? '?'} />
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-neutral-900">
                @{action.owner?.nickname ?? '알 수 없음'}
              </span>
              {action.owner?.bio && (
                <span className="line-clamp-1 text-[12px] text-neutral-500">
                  {action.owner.bio}
                </span>
              )}
            </div>
          </Link>
          {user && !action.isOwner && action.owner?.id && (
            <FollowButton
              targetUserId={action.owner.id}
              initialFollowing={action.followingOwner}
              className="ml-auto"
            />
          )}
        </div>

        {/* 상단 버튼 그룹 (참여인원 · 좋아요 · 저장 · 공유) */}
        <div className="flex items-center justify-start gap-1 border-y border-neutral-100 py-2 text-xs tabular-nums text-neutral-500">
          <CrewAnchorButton
            count={action.crewCount}
            className="px-1 py-0.5 text-xs gap-1"
          />
          <LikeButton
            actionId={action.id}
            initialLiked={action.likedByMe}
            initialCount={action.likeCount}
            className="px-1 py-0.5 text-xs gap-1"
          />
          <SaveButton
            actionId={action.id}
            initialSaved={action.savedByMe}
            initialCount={action.saveCount}
            className="px-1 py-0.5 text-xs gap-1"
          />
          <ShareButton
            actionId={action.id}
            actionTitle={action.title}
            viewerId={user?.id ?? null}
            count={action.shareCount}
            className="px-1 py-0.5 text-xs gap-1"
          />
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

        {/* 활동 일정 */}
        <section className="flex flex-col gap-3">
          <h2 className="text-[15px] font-bold text-neutral-900">활동 일정</h2>
          <div className="flex flex-col gap-1 rounded-xl bg-neutral-50 p-4">
            <p className="text-sm font-medium text-neutral-900">
              {formatActivityPeriod(action.activityStartAt, action.activityEndAt)}
            </p>
            {action.recruitEndAt && (
              <p className="text-[12px] text-neutral-500">
                모집 마감일 : {formatDateShort(action.recruitEndAt)}
              </p>
            )}
          </div>
        </section>

        {/* 활동 장소 */}
        {(action.placeName || action.address) && (
          <section className="flex flex-col gap-3">
            <h2 className="text-[15px] font-bold text-neutral-900">활동 장소</h2>
            <AddressBox
              placeName={action.placeName}
              address={action.address ?? action.placeName ?? ''}
            />
          </section>
        )}

        {/* 안내사항 */}
        {action.notice && (
          <section className="flex flex-col gap-2">
            <h2 className="text-[15px] font-bold text-neutral-900">안내사항</h2>
            <p className="whitespace-pre-wrap rounded-xl bg-amber-50 p-4 text-[13px] leading-relaxed text-amber-900">
              {action.notice}
            </p>
          </section>
        )}

        <ActionCrewSection
          actionId={action.id}
          crewCount={action.crewCount}
          members={summaryMembers}
          canViewCrew={isCrewMember}
        />
      </div>

      {/* 하단 고정 버튼 */}
      {/* bottom-14 = 하단 탭 위로 띄웁니다. 이 화면은 탭이 보입니다 */}
      <div className="fixed inset-x-0 bottom-14 z-30 mx-auto flex max-w-app flex-col gap-2 border-t border-neutral-200 bg-white p-4">
        {cta.type === 'host_ended_write_result' ? (
          <div className="flex w-full items-center gap-2">
            <Link
              href={cta.chatHref}
              className="flex h-13 flex-1 min-w-0 items-center justify-center gap-1.5 rounded-xl border border-neutral-300 bg-white text-[14px] font-bold text-neutral-800 shadow-sm transition-colors active:bg-neutral-50 whitespace-nowrap"
            >
              <svg
                className="h-4.5 w-4.5 flex-none text-neutral-700"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <span>CREW CHAT</span>
            </Link>
            <Link
              href={cta.writeHref}
              className="flex h-13 flex-1 min-w-0 items-center justify-center gap-1.5 rounded-xl bg-neutral-900 text-[14px] font-bold text-white shadow-sm transition-colors active:bg-neutral-800 whitespace-nowrap"
            >
              <span>결과 작성</span>
            </Link>
          </div>
        ) : cta.type === 'link' ? (
          <Link
            href={cta.href}
            className={
              cta.isCrewChat
                ? 'flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 text-[15px] font-bold text-white shadow-sm transition-colors active:bg-neutral-800'
                : 'flex h-13 w-full items-center justify-center rounded-xl bg-neutral-900 text-[15px] font-bold text-white shadow-sm transition-colors active:bg-neutral-800'
            }
          >
            {cta.isCrewChat && (
              <svg
                className="h-5 w-5 flex-none"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            )}
            <span>{cta.label}</span>
          </Link>
        ) : (
          <button
            disabled
            className="flex h-13 w-full items-center justify-center cursor-not-allowed rounded-xl bg-neutral-200 text-[15px] font-semibold text-neutral-400"
          >
            {cta.label}
          </button>
        )}
      </div>
    </main>
  );
}
