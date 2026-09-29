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
  /** 고른 아바타 (profiles.avatar) */
  avatar: string | null;
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
  avatar,
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
      <section className="flex items-center gap-4 px-6 py-5">
        <Avatar name={nickname} avatar={avatar} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-subtitle font-bold text-neutral-900">
            @{nickname}
          </p>
          {bio && (
            <p className="mt-1 line-clamp-3 text-label leading-relaxed text-neutral-500">
              {bio}
            </p>
          )}
        </div>
        {isMe ? (
          <Link
            href="/my/edit"
            className="inline-flex min-h-9 shrink-0 items-center rounded-full border border-hairline px-3.5 text-label font-semibold text-neutral-800"
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
