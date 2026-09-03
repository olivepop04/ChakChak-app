/**
 * You're In! — 참여 확정 직후 화면.
 *
 * 라우트 이름이 /joined 가 아니라 /welcome 인 이유:
 * /join 과 접두사가 겹쳐서 middleware 의 보호 경로 판정이 헷갈렸습니다.
 */
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActionCrew } from '@/lib/queries/participations';
import { Avatar } from '@/components/ui/Avatar';

export default async function WelcomePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/action/${id}/welcome`);

  const { data: action } = await supabase
    .from('actions')
    .select('id, title')
    .eq('id', id)
    .maybeSingle();
  if (!action) notFound();

  const { owner, crew } = await getActionCrew(supabase, id, user.id);
  const everyone = [...(owner ? [owner] : []), ...crew];
  const shown = everyone.slice(0, 5);
  const rest = everyone.length - shown.length;

  return (
    <main className="flex min-h-dvh flex-col px-6 pb-10 pt-20">
      <div className="flex flex-col items-center text-center">
        <span className="text-5xl" aria-hidden="true">
          🎉
        </span>
        <h1 className="mt-5 text-[26px] font-bold tracking-tight text-neutral-900">
          You&apos;re In!
        </h1>
        <p className="mt-2 text-sm text-neutral-500">
          좋은 일을 함께 시작하게 되었어요.
        </p>
        <p className="mt-4 line-clamp-2 text-[15px] font-semibold text-neutral-800">
          「{action.title}」
        </p>
      </div>

      {/* 함께하는 사람들 */}
      <Link
        href={`/action/${id}/crew`}
        className="mt-10 flex flex-col gap-3 rounded-2xl border border-neutral-200 p-5 transition-colors hover:bg-neutral-50"
      >
        <p className="text-[13px] font-semibold text-neutral-500">
          지금 이 액션을 함께하는 사람들
        </p>
        <div className="flex items-center gap-1.5">
          {shown.map((p) => (
            <Avatar key={p.id} name={p.nickname} />
          ))}
          {rest > 0 && (
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-100 text-[13px] font-semibold text-neutral-500">
              +{rest}
            </span>
          )}
        </div>
        <p className="text-sm text-neutral-700">
          현재 <b className="font-semibold">{everyone.length}명</b>이 함께하고 있어요.
          <span className="ml-1 text-neutral-400">›</span>
        </p>
      </Link>

      <p className="mt-8 text-center text-[13px] leading-relaxed text-neutral-500">
        함께 이야기하고, 서로 힘을 모아
        <br />
        좋은 일을 완성해보세요.
      </p>

      <div className="mt-auto flex flex-col gap-2 pt-10">
        <Link
          href={`/action/${id}/chat`}
          className="flex h-13 items-center justify-center rounded-xl bg-neutral-900 text-[15px] font-semibold text-white"
        >
          💬 함께하는 사람들과 이야기하기
        </Link>
      </div>
    </main>
  );
}
