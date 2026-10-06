'use client';

import { useRouter } from 'next/navigation';
import { EyeOff } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { useToast } from '@/components/ui/Toast';
import type { ActionStatus } from '@/lib/constants';
import type { UserSummary } from '@/lib/types/view';

interface ActionCrewSectionProps {
  actionId: string;
  crewCount: number;
  members: UserSummary[];
  canViewCrew: boolean;
  /** ACTIVE만 "함께하고 있어요", 그 외(완료·종료·취소)는 "함께했어요". 안 주면 ACTIVE 처럼 */
  status?: ActionStatus;
}

/**
 * 액션 상세 「함께하는 크루」 칸.
 *
 * 2026-10-06 디자인 패치 확정 — 상태 셋:
 *   ① 크루·호스트: 아바타 최대 3개(첫 번째가 맨 뒤) + 나머지 「+n」 원 · 「전체보기 ›」로 크루 목록
 *   ② 크루 아님: 눈 가림 아이콘 + 문장만(아바타 없음) · 누르면 지금처럼 토스트
 *   ③ 0명: 점선 원 3개 + 「첫 번째 크루가 되어 보세요」
 * 문구는 셋 다 문장형으로 맞춤 — 「N명 참여 중」 → 「N명이 함께하고 있어요」.
 */
export function ActionCrewSection({
  actionId,
  crewCount,
  members,
  canViewCrew,
  status,
}: ActionCrewSectionProps) {
  const router = useRouter();
  const toast = useToast();

  function handleClick() {
    if (canViewCrew) {
      router.push(`/action/${actionId}/crew`);
    } else {
      toast('액션에 참여하신 분만 크루 목록을 확인할 수 있어요');
    }
  }

  const isEmpty = crewCount === 0;
  const verb = status === undefined || status === 'ACTIVE' ? '함께하고 있어요' : '함께했어요';
  const shown = canViewCrew ? members : [];
  const rest = crewCount - shown.length;

  return (
    <section id="crew-section" className="flex flex-col gap-3 pt-2">
      <SectionTitle>함께하는 크루</SectionTitle>
      <button
        type="button"
        onClick={handleClick}
        className="flex w-full items-center justify-between rounded-xl border border-neutral-200 bg-white p-4 text-left transition-colors hover:bg-neutral-50 active:bg-neutral-100"
      >
        {isEmpty ? (
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex shrink-0 -space-x-2" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-8 w-8 rounded-full border-[1.5px] border-dashed border-faint bg-white"
                />
              ))}
            </div>
            <span className="truncate text-label font-semibold text-[#333333]">
              첫 번째 크루가 되어 보세요
            </span>
          </div>
        ) : (
          <>
            <div className={canViewCrew ? 'flex min-w-0 items-center gap-3' : 'flex min-w-0 items-center gap-1.5'}>
              {!canViewCrew && (
                // 로그인 비밀번호 칸의 「가림」 아이콘과 같은 모양 — 크루만 볼 수 있다는 뜻 (2026-10-06)
                <EyeOff className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden="true" />
              )}
              {shown.length > 0 && (
                <div className="flex shrink-0 -space-x-2">
                  {/* 첫 번째 아바타가 맨 뒤 — 뒤로 갈수록 위에 쌓이게 z-index 를 키움 */}
                  {shown.map((member, idx) => (
                    <span key={member.id || idx} className="relative" style={{ zIndex: idx + 1 }}>
                      <Avatar
                        name={member.nickname ?? '?'}
                        avatar={member.avatar}
                        size="sm"
                        className="ring-2 ring-white"
                      />
                    </span>
                  ))}
                  {rest > 0 && (
                    <span
                      className="relative flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-label font-semibold text-neutral-600 ring-2 ring-white"
                      style={{ zIndex: shown.length + 1 }}
                    >
                      +{rest}
                    </span>
                  )}
                </div>
              )}
              <span className="truncate text-label font-semibold text-[#333333]">
                {crewCount}명이 {verb}
              </span>
            </div>
            <span className="ml-2 shrink-0 text-label font-medium text-neutral-400">
              전체보기 ›
            </span>
          </>
        )}
      </button>
    </section>
  );
}
