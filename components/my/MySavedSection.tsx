/**
 * MY 페이지 저장한 액션 영역.
 *
 * 가로형(variant="horizontal") 카드 2개를 미리 보여주며,
 * 전체 목록은 별도 화면에서 확인합니다.
 */
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { ActionCard } from '@/components/ui/ActionCard';
import { SectionTitle } from '@/components/ui/SectionTitle';
import type { ActionCardData } from '@/lib/types/view';
import { selectProfileActionPreview } from '@/lib/utils/profile-actions';

export function MySavedSection({ saved }: { saved: ActionCardData[] }) {
  const previewItems = selectProfileActionPreview(saved);

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between px-6 pb-3">
        <SectionTitle>
          내가 저장한 액션{' '}
          <span className="text-neutral-500">{saved.length}</span>
        </SectionTitle>
        <Link
          href="/my/saved"
          className="inline-flex items-center gap-0.5 text-label font-semibold text-neutral-500 hover:text-neutral-900"
        >
          모두 보기
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      {saved.length === 0 ? (
        <p className="mx-6 rounded-xl bg-neutral-100 px-4 py-6 text-center text-label text-neutral-500">
          아직 저장한 액션이 없어요.
        </p>
      ) : (
        <div className="flex flex-col gap-3 px-6">
          {previewItems.map((action) => (
            <ActionCard
              key={action.id}
              action={action}
              variant="horizontal"
              showStatus
            />
          ))}
        </div>
      )}
    </section>
  );
}
