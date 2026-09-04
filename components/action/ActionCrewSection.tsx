'use client';

import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/ui/Avatar';
import { useToast } from '@/components/ui/Toast';
import type { UserSummary } from '@/lib/types/view';

interface ActionCrewSectionProps {
  actionId: string;
  crewCount: number;
  members: UserSummary[];
  canViewCrew: boolean;
}

export function ActionCrewSection({
  actionId,
  crewCount,
  members,
  canViewCrew,
}: ActionCrewSectionProps) {
  const router = useRouter();
  const toast = useToast();

  function handleClick() {
    if (canViewCrew) {
      router.push(`/action/${actionId}/crew`);
    } else {
      toast('참여 후 전체 크루 목록을 확인할 수 있습니다');
    }
  }

  return (
    <section className="flex flex-col gap-3 pt-2">
      <h2 className="text-[15px] font-bold text-neutral-900">함께하는 크루</h2>
      <button
        type="button"
        onClick={handleClick}
        className="flex w-full items-center justify-between rounded-xl border border-neutral-200 bg-white p-4 text-left transition-colors hover:bg-neutral-50 active:bg-neutral-100"
      >
        <div className="flex items-center gap-3 min-w-0">
          {members.length > 0 && (
            <div className="flex -space-x-2 overflow-hidden shrink-0">
              {members.map((member, idx) => (
                <Avatar
                  key={member.id || idx}
                  name={member.nickname ?? '?'}
                  size="sm"
                  className="ring-2 ring-white"
                />
              ))}
            </div>
          )}
          <span className="truncate text-[14px] font-semibold text-neutral-800">
            {crewCount}명 참여 중
          </span>
        </div>
        <span className="shrink-0 text-[13px] font-medium text-neutral-400 ml-2">
          전체보기 ›
        </span>
      </button>
    </section>
  );
}
