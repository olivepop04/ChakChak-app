/**
 * 사용자 목록. 팔로워 · 팔로잉 · Share 검색 결과가 같은 모양을 씁니다.
 */
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import type { UserSummary } from '@/lib/types/view';

export function UserList({
  users,
  action,
}: {
  users: UserSummary[];
  /** 오른쪽에 붙일 버튼. 없으면 줄 전체가 프로필 링크가 됩니다(2026-09-29). */
  action?: (user: UserSummary) => React.ReactNode;
}) {
  // 2026-09-29 프로필군 통일안 — action 을 안 주면 줄 전체가 프로필 링크 + 오른쪽 ›
  // (「프로필 보기」 테두리 버튼 대신, 크루 목록과 같은 모양). action 을 주면 예전 모양 그대로
  if (!action) {
    return (
      <ul className="divide-y divide-neutral-100 border-y border-neutral-100">
        {users.map((u) => (
          <li key={u.id}>
            <Link
              href={`/user/${u.id}`}
              className="flex items-center gap-3 px-6 py-3 hover:bg-neutral-50"
            >
              <Avatar name={u.nickname} avatar={u.avatar} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-body font-semibold text-neutral-900">
                  @{u.nickname}
                </p>
                <p className="text-caption text-neutral-500">
                  참여 {u.participatedCount}개 · 호스트 {u.ledCount}개
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-faint" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="divide-y divide-neutral-100">
      {users.map((u) => (
        <li key={u.id} className="flex items-center gap-3 px-6 py-3.5">
          <Avatar name={u.nickname} avatar={u.avatar} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-neutral-900">
              @{u.nickname}
            </p>
            <p className="text-caption text-neutral-500">
              참여 {u.participatedCount}개 · 호스트 {u.ledCount}개
            </p>
          </div>
          {action(u)}
        </li>
      ))}
    </ul>
  );
}
