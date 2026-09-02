/**
 * 사용자 목록. 팔로워 · 팔로잉 · Share 검색 결과가 같은 모양을 씁니다.
 */
import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import type { UserSummary } from '@/lib/types/view';

export function UserList({
  users,
  action,
}: {
  users: UserSummary[];
  /** 오른쪽에 붙일 버튼. 없으면 "프로필 보기" 링크가 들어갑니다. */
  action?: (user: UserSummary) => React.ReactNode;
}) {
  return (
    <ul className="divide-y divide-neutral-100">
      {users.map((u) => (
        <li key={u.id} className="flex items-center gap-3 px-5 py-3.5">
          <Avatar name={u.nickname} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-neutral-900">
              @{u.nickname}
            </p>
            <p className="text-[12px] text-neutral-500">
              참여 {u.participatedCount}개 · 호스트 {u.ledCount}개
            </p>
          </div>
          {action ? (
            action(u)
          ) : (
            <Link
              href={`/user/${u.id}`}
              className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-[12px] font-medium text-neutral-700"
            >
              프로필 보기
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
