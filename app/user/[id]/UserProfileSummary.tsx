'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { FollowButton } from '@/components/ui/ToggleButtons';
import { ProfileStats } from '@/components/my/ProfileStats';
import {
  buildProfileStats,
  getFollowerCountAfterToggle,
} from '@/lib/utils/profile-display';

interface UserProfileSummaryProps {
  id: string;
  nickname: string;
  bio: string | null;
  isMe: boolean;
  canFollow: boolean;
  followedByMe: boolean;
  ledCount: number;
  participatedCount: number;
  initialFollowerCount: number;
  followingCount: number;
}

export function UserProfileSummary({
  id,
  nickname,
  bio,
  isMe,
  canFollow,
  followedByMe,
  ledCount,
  participatedCount,
  initialFollowerCount,
  followingCount,
}: UserProfileSummaryProps) {
  const [followerCount, setFollowerCount] = useState(initialFollowerCount);

  const stats = buildProfileStats({
    ledCount,
    participatedCount,
    followerCount,
    followingCount,
    ledHref: `/user/${id}/created`,
    participatedHref: `/user/${id}/joined`,
    followersHref: `/user/${id}/followers`,
    followingHref: `/user/${id}/following`,
  });

  return (
    <>
      <section className="flex items-center gap-4 px-5 py-5">
        <Avatar name={nickname} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-bold text-neutral-900">
            @{nickname}
          </p>
          {bio && (
            <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed text-neutral-500">
              {bio}
            </p>
          )}
        </div>
        {isMe ? (
          <Link
            href="/my/edit"
            className="shrink-0 rounded-lg border border-neutral-300 px-3 py-2 text-[12px] font-semibold text-neutral-700"
          >
            프로필 수정
          </Link>
        ) : (
          canFollow && (
            <FollowButton
              targetUserId={id}
              initialFollowing={followedByMe}
              className="shrink-0"
              onToggled={(nowFollowing) =>
                setFollowerCount((currentCount) =>
                  getFollowerCountAfterToggle(currentCount, nowFollowing),
                )
              }
            />
          )
        )}
      </section>

      <ProfileStats stats={stats} />
    </>
  );
}
