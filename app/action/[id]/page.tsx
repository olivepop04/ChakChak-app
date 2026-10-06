/**
 * Action Detail.
 *
 * 비회원도 볼 수 있습니다. 초대 링크로 바로 들어오는 화면이기도 합니다.
 *
 * ★ params 는 Promise 입니다. await 해야 합니다. (Next.js 15)
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Calendar, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/server';
import { getActionDetail } from '@/lib/queries/actions';
import { getActionCrew } from '@/lib/queries/participations';
import { QuotaProgress } from '@/components/action/QuotaProgress';
import { ActionGallery } from '@/components/action/ActionGallery';
import { AddressBox } from '@/components/action/AddressBox';
import { ActionCrewSection } from '@/components/action/ActionCrewSection';
import { ActionHostActions } from '@/components/action/ActionHostActions';
import { Avatar } from '@/components/ui/Avatar';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Chip } from '@/components/ui/Chip';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { CrewAnchorButton, LikeButton, SaveButton, ShareButton, FollowButton } from '@/components/ui/ToggleButtons';
import { Header } from '@/components/layout/Header';
import {
  deadlineDDay,
  formatActivityPeriod,
  formatDateShort,
} from '@/lib/utils/date';
import { getActionCta } from '@/lib/utils/action-cta';
import type { CrewMember } from '@/lib/types/view';

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

  let crew: CrewMember[] = [];

  try {
    const res = await getActionCrew(supabase, id, user?.id ?? null);
    crew = res.crew;
  } catch {
    // Crew 조회 실패 시 기본값 fallback
  }

  /**
   * 아이콘 줄에는 **크루만** 넣습니다 (2026-09-10 회의).
   *
   * 전에는 `[호스트, ...크루]` 로 만들었는데 옆의 숫자(`crewCount`)는 크루만 세서,
   * 크루가 2명이면 「아이콘 3개 · 2명 참여 중」 이 되어 헷갈렸습니다.
   * 크루가 없으면 아이콘도 없고 「0명 참여 중」 입니다 — 숫자와 그림이 늘 같습니다.
   *
   * 호스트는 크루 전체 목록(`/action/[id]/crew`)에서 「호스트」로 따로 보여줍니다.
   */
  // 2026-10-06 디자인 패치: 아바타 3개 + 나머지는 「+n」 원 (ActionCrewSection)
  const summaryMembers = crew.slice(0, 3);

  const dday = deadlineDDay(action.recruitEndAt);
  // 모집 중 = 진행 중이면서 모집이 아직 안 닫힘. 이때만 D-day 를 보이고 상태 배지는 숨김 (2026-10-06)
  const isRecruiting = action.status === 'ACTIVE' && !action.recruitClosed;
  const showDDay = isRecruiting && !!dday;
  const allFull = action.items.length > 0 && action.items.every((i) => i.isFull);
  // 취소된 액션은 고칠 수 없다 — 「없던 일」 이라 그 시점 내용이 남아야 한다 (2026-09-29, supabase/19)
  const canEditActionText =
    action.isOwner &&
    (action.status === 'ACTIVE' ||
      action.status === 'ENDED' ||
      action.status === 'COMPLETED');

  const isPastActivityEnd = action.activityEndAt
    ? new Date() > new Date(action.activityEndAt)
    : false;

  const cta = getActionCta({
    actionId: action.id,
    status: action.status,
    isOwner: action.isOwner,
    myParticipation: action.myParticipation,
    activityEndAt: action.activityEndAt,
    recruitClosed: action.recruitClosed,
    allItemsFull: allFull,
  });

  const isParticipant =
    !action.isOwner &&
    !!action.myParticipation &&
    action.myParticipation !== 'LEFT';
  const customStatusLabel =
    action.status === 'ENDED' && isParticipant
      ? '소감 작성 필요'
      : undefined;

  const detailCategories =
    action.categories && action.categories.length > 0
      ? action.categories
      : [action.category];

  // 좋아요·저장: 초안·취소·종료·완료된 액션에서 "새로" 누르는 것을 막는다 (누르면 안내 팝업).
  // 공유: 초안·취소만 막는다 — 종료·완료된 액션도 공유는 가능 (기획 결정 2026-09-10).
  const reactionDisabled =
    action.status === 'DRAFT' ||
    action.status === 'CANCELLED' ||
    action.status === 'ENDED' ||
    action.status === 'COMPLETED';
  const shareDisabled =
    action.status === 'DRAFT' || action.status === 'CANCELLED';
  const reactionDisabledReason =
    action.status === 'DRAFT'
      ? 'draft'
      : action.status === 'CANCELLED'
        ? 'cancelled'
        : 'ended';

  // 이미 누른 것은 풀 수 있어야 합니다 — 막는 것은 새로 누르는 것뿐입니다 (2026-09-10).
  const likeDisabled = reactionDisabled && !action.likedByMe;
  const saveDisabled = reactionDisabled && !action.savedByMe;

  return (
    <main className="pb-52">
      <Header
        title="액션 상세"
        back
        backHref="/"
        asH1={false}
        right={
          action.isOwner ? (
            <ActionHostActions
              actionId={action.id}
              status={action.status}
              activityStartAt={action.activityStartAt}
              activityEndAt={action.activityEndAt}
              variant="header"
            />
          ) : undefined
        }
      />

      <ActionGallery
        urls={action.imageUrls}
        thumbnailIndex={action.thumbnailIndex}
        alt={action.title}
      />

      <div className="flex flex-col gap-6 px-6 pt-5">
        {/* 조기 종료 사유 */}
        {action.earlyEndReason && (
          <div className="rounded-xl border border-danger bg-danger-soft p-4">
            <p className="text-body font-semibold text-charcoal">
              이 액션은 조기 종료되었어요
            </p>
            <p className="mt-1 text-body leading-relaxed text-charcoal break-words whitespace-pre-wrap">
              {action.earlyEndReason}
            </p>
          </div>
        )}

        {/* 취소 사유 */}
        {action.status === 'CANCELLED' && action.cancelReason && (
          <div className="rounded-xl border border-danger bg-danger-soft p-4">
            <p className="text-body font-semibold text-charcoal">
              이 액션은 취소되었어요
            </p>
            <p className="mt-1 text-body leading-relaxed text-charcoal break-words whitespace-pre-wrap">
              {action.cancelReason}
            </p>
          </div>
        )}

        {/* 제목 영역 */}
        <div className="flex flex-col gap-2">
          {/* 2026-10-06 디자인 패치 — 「모집 중」·D-day·마감일이 같은 말이라 한 줄로 정리.
              모집 중이면 상태 배지를 숨기고(D-day 가 그 뜻을 대신함), 다른 상태면 같은 자리에 배지.
              오른쪽은 캡슐 없이 글자 한 줄 「D-1 · 10월 7일 마감」, 13px · 바닥선 정렬 · 오른쪽 끝 맞춤 */}
          <div className="flex flex-wrap items-center gap-1.5">
            {detailCategories.map((cat, i) => (
              <Chip
                key={cat}
                as="span"
                tone="accent"
                size="sm"
                selected={i === 0}
                className="!text-label"
              >
                {cat}
              </Chip>
            ))}
            {!isRecruiting && (
              <StatusBadge
                status={action.status}
                recruitClosed={action.recruitClosed}
                customLabel={customStatusLabel}
                className="!min-w-0 !rounded-full !px-2.5"
              />
            )}
            {(showDDay || action.recruitEndAt) && (
              <p className="ml-auto flex flex-none items-baseline gap-1 text-label">
                {showDDay && <span className="font-bold text-charcoal">{dday}</span>}
                {action.recruitEndAt && (
                  <span className="font-medium text-neutral-500">
                    {showDDay && '· '}
                    {formatDateShort(action.recruitEndAt)} 마감
                  </span>
                )}
              </p>
            )}
          </div>

          <h1 className="font-paperlogy text-2xl font-bold leading-[1.3] tracking-tight text-neutral-900">
            {action.title}
          </h1>

          {canEditActionText && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Button
                href={`/action/${id}/edit`}
                variant="secondary"
                size="sm"
                className="self-start"
              >
                <Pencil className="h-3.5 w-3.5" />
                액션 수정
              </Button>
              {action.isOwner && (
                <ActionHostActions
                  actionId={action.id}
                  status={action.status}
                  activityStartAt={action.activityStartAt}
                  activityEndAt={action.activityEndAt}
                />
              )}
            </div>
          )}
        </div>

        {/* 만든 사람 */}
        <div className="flex items-center gap-3">
          <Link href={`/user/${action.owner?.id ?? ''}`} className="flex items-center gap-3">
            <Avatar name={action.owner?.nickname ?? '?'} avatar={action.owner?.avatar} className="!h-10 !w-10" />
            <div className="flex flex-col">
              <span className="text-label font-semibold text-neutral-900">
                @{action.owner?.nickname ?? '알 수 없음'}
              </span>
              {action.owner?.bio && (
                <span className="line-clamp-1 text-caption text-neutral-500">
                  {action.owner.bio}
                </span>
              )}
            </div>
          </Link>
          {user && !action.isOwner && action.owner?.id && (
            <FollowButton
              targetUserId={action.owner.id}
              initialFollowing={action.followingOwner}
              className="ml-auto shrink-0"
            />
          )}
        </div>

        {/* 상단 버튼 그룹 (참여인원 · 좋아요 · 저장 · 공유) */}
        <div className="flex items-center gap-1 border-y border-neutral-100 py-2 text-label tabular-nums text-neutral-500">
          <CrewAnchorButton
            count={action.crewCount}
            suffixLabel={action.status === 'ACTIVE' ? '명 참여 중' : '명 참여'}
            className="px-1 py-0.5 text-label gap-1"
          />
          <span className="mx-2 h-3.5 w-px flex-none bg-neutral-200" aria-hidden="true" />
          <LikeButton
            actionId={action.id}
            initialLiked={action.likedByMe}
            initialCount={action.likeCount}
            disabled={likeDisabled}
            disabledReason={reactionDisabledReason}
            className="px-1 py-0.5 text-label gap-1"
          />
          <SaveButton
            actionId={action.id}
            initialSaved={action.savedByMe}
            initialCount={action.saveCount}
            disabled={saveDisabled}
            disabledReason={reactionDisabledReason}
            className="px-1 py-0.5 text-label gap-1"
          />
          <ShareButton
            actionId={action.id}
            actionTitle={action.title}
            viewerId={user?.id ?? null}
            count={action.shareCount}
            disabled={shareDisabled}
            disabledReason={reactionDisabledReason}
            className="px-1 py-0.5 text-label gap-1"
          />
        </div>

        {/* 소개 */}
        {action.description && (
          <p className="whitespace-pre-wrap text-body leading-relaxed text-neutral-700">
            {action.description}
          </p>
        )}

        {/* 모집 현황 */}
        <section className="flex flex-col gap-4">
          {/* 마감일은 2026-10-05 제목 영역의 D-day 옆으로 옮김 */}
          <SectionTitle>모집 현황</SectionTitle>
          {action.items.length === 0 ? (
            <p className="text-label text-neutral-400">등록된 모집 항목이 없어요.</p>
          ) : (
            <div className="flex flex-col gap-5 rounded-xl border border-hairline p-4">
              {action.items.flatMap((item, i) => [
                i > 0 && (
                  <div key={`divider-${item.id}`} className="h-px bg-neutral-100" />
                ),
                <QuotaProgress
                  key={item.id}
                  item={item}
                  current={item.currentCount}
                  detailed
                  conditionName={item.conditionName}
                />,
              ])}
            </div>
          )}
        </section>

        {/* 일정 · 장소 — 활동 일정 + 활동 장소 통합 (2026-09-22) */}
        {(action.activityStartAt || action.placeName || action.address) && (
          <section className="flex flex-col gap-3">
            <SectionTitle>일정 · 장소</SectionTitle>
            <div className="flex flex-col gap-3 rounded-xl bg-neutral-50 p-4">
              <div className="flex items-start gap-2">
                <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
                <p className="text-body font-medium text-neutral-900">
                  {formatActivityPeriod(action.activityStartAt, action.activityEndAt)}
                </p>
              </div>
              {(action.placeName || action.address) && (
                <AddressBox
                  placeName={action.placeName}
                  address={action.address ?? action.placeName ?? ''}
                />
              )}
            </div>
          </section>
        )}

        {/* 안내사항 */}
        {action.notice && (
          <section className="flex flex-col gap-2">
            <SectionTitle>안내사항</SectionTitle>
            <p className="whitespace-pre-wrap rounded-xl bg-neutral-50 p-4 text-label leading-relaxed text-neutral-800">
              {action.notice}
            </p>
          </section>
        )}

        <ActionCrewSection
          actionId={action.id}
          crewCount={action.crewCount}
          members={summaryMembers}
          canViewCrew={isCrewMember}
          status={action.status}
        />
      </div>

      {/* 하단 고정 버튼 */}
      {/* 하단 탭 위로 띄웁니다. 이 화면은 탭이 보입니다.
          아이폰 홈 인디케이터(safe-area)만큼 탭이 더 커지므로 그만큼 더해서 띄웁니다.
          ChatBoard.tsx 하단 버튼과 같은 계산입니다.

          ★ 탭 높이는 globals.css 의 --nav-h 변수를 씁니다 (2026-09-18).
            숫자(4rem)를 직접 적지 마세요 — 탭 높이가 바뀌면 여기만 고쳐서는
            안 되고 변수를 쓰는 10곳이 전부 같이 바뀌어야 합니다. */}
      <div className="fixed inset-x-0 bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-app flex-col gap-2 bg-white p-4">
        {cta.type === 'host_ended_write_result' ? (
          <div className="flex w-full items-center gap-2">
            <Button href={cta.chatHref} variant="secondary" size="md" className="flex-1">
              <svg
                className="h-4 w-4 flex-none"
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
            </Button>
            <Button href={cta.writeHref} size="md" className="flex-1">
              결과 작성
            </Button>
          </div>
        ) : cta.type === 'link' ? (
          <Button href={cta.href} size="lg" fullWidth>
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
          </Button>
        ) : (
          <Button size="lg" fullWidth disabled>
            {cta.label}
          </Button>
        )}
      </div>
    </main>
  );
}
