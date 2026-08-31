/**
 * 액션 카드. Home · Discover · Activity · 저장목록 · 프로필이 전부 이걸 쓴다.
 *
 * ★ props 는 여러 사람이 함께 쓰는 계약이다. 바꾸기 전에 팀에 알릴 것.
 *   보이는 모습(색·간격·타이포)은 디자이너 담당이라 마음껏 바꿔도 된다.
 *   대신 props 이름과 개수는 그대로 두어야 다른 화면이 안 깨진다.
 *
 * 데이터는 반드시 lib/queries/actions.ts 의 함수로 가져올 것.
 * 화면에서 직접 supabase 를 부르면 카드마다 모양이 달라진다.
 */
import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { ACTION_STATUS_LABEL } from '@/lib/constants';
import type { ActionCardData } from '@/lib/types/view';
import { cn } from '@/lib/utils/cn';

interface ActionCardProps {
  action: ActionCardData;
  /** 카드 우측 하단에 상태 배지를 보여줄지 (Activity 에서 true) */
  showStatus?: boolean;
  /** 카드 아래에 덧붙일 내용. Activity 의 CTA 버튼 등 */
  footer?: React.ReactNode;
  className?: string;
}

function formatDate(iso: string | null): string {
  if (!iso) return '날짜 미정';
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function ActionCard({
  action,
  showStatus = false,
  footer,
  className,
}: ActionCardProps) {
  return (
    <article
      className={cn(
        'overflow-hidden rounded-xl border border-neutral-200 bg-white',
        className,
      )}
    >
      <Link href={`/action/${action.id}`} className="block">
        <div className="relative aspect-[16/10] bg-neutral-100">
          {action.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={action.thumbnailUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-neutral-400">
              이미지 없음
            </div>
          )}
          <span className="absolute left-3 top-3 rounded bg-black/60 px-2 py-1 text-[11px] font-medium text-white">
            {action.category}
          </span>
          {showStatus && (
            <span className="absolute right-3 top-3 rounded bg-white/90 px-2 py-1 text-[11px] font-medium text-neutral-700">
              {ACTION_STATUS_LABEL[action.status]}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2 p-4">
          <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-neutral-900">
            {action.title}
          </h3>

          {action.summary && (
            <p className="line-clamp-2 text-[13px] leading-relaxed text-neutral-500">
              {action.summary}
            </p>
          )}

          <p className="text-xs text-neutral-500">
            {formatDate(action.activityStartAt)}
            {action.address ? ` · ${action.address.split(' ').slice(0, 2).join(' ')}` : ''}
          </p>

          <div className="mt-1 flex items-center gap-2 border-t border-neutral-100 pt-3">
            <Avatar name={action.owner.nickname} size="sm" />
            <span className="flex-1 truncate text-xs text-neutral-600">
              @{action.owner.nickname}
            </span>
            <span className="flex items-center gap-3 text-xs tabular-nums text-neutral-500">
              <span>♥ {action.likeCount}</span>
              <span>🔖 {action.saveCount}</span>
              <span>👥 {action.crewCount}</span>
            </span>
          </div>
        </div>
      </Link>

      {footer && (
        <div className="border-t border-neutral-100 px-4 py-3">{footer}</div>
      )}
    </article>
  );
}
