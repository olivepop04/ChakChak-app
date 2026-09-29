/**
 * You're In! — 참여 확정 직후 화면.
 *
 * 라우트 이름이 /joined 가 아니라 /welcome 인 이유:
 * /join 과 접두사가 겹쳐서 middleware 의 보호 경로 판정이 헷갈렸습니다.
 */
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronLeft, Check, MessageSquareQuote } from 'lucide-react';
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
    <main className="min-h-dvh bg-brand pb-32 text-white">
      {/* 이 화면만 전체 초록 배경(팀 확정)이라 공용 Header 대신 직접 그립니다.
          약관 화면(app/(auth)/_legal/LegalDocumentPage.tsx)과 같은 방식 */}
      <header className="flex h-14 items-center gap-2 px-3">
        <Link
          href={`/action/${id}`}
          aria-label="뒤로 가기"
          className="flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 truncate text-body font-bold tracking-normal text-white">
          참여 완료
        </h1>
        <span className="w-9" />
      </header>

      <div className="flex flex-col px-6 pt-6">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white">
            <Check className="h-8 w-8 text-brand" aria-hidden="true" />
          </span>
          <h2 className="mt-5 font-paperlogy text-2xl font-bold leading-snug text-white">
            You&apos;re In!
          </h2>
          <p className="mt-2 text-body text-white/85">
            좋은 일을 함께 시작하게 되었어요.
          </p>
        </div>

        {/* 액션 제목 + 함께하는 크루: 초록 배경 위 흰 카드 */}
        <Link
          href={`/action/${id}/crew`}
          className="mt-8 flex flex-col items-center gap-3.5 rounded-xl bg-white p-5 text-center"
        >
          <p className="line-clamp-2 font-paperlogy text-subtitle font-bold leading-snug text-neutral-900">
            {action.title}
          </p>
          <div className="flex items-center justify-center">
            {shown.map((p, i) => (
              <span
                key={p.id}
                className="relative -ml-3 first:ml-0"
                style={{ zIndex: i + 1 }}
              >
                <Avatar name={p.nickname} avatar={p.avatar} className="border-[3px] border-white" />
              </span>
            ))}
            {rest > 0 && (
              <span
                className="relative -ml-3"
                style={{ zIndex: shown.length + 1 }}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-white bg-neutral-100 text-label font-semibold text-neutral-500">
                  +{rest}
                </span>
              </span>
            )}
          </div>
          <p className="text-body text-neutral-700">
            현재 <b className="font-semibold text-neutral-900">{everyone.length}명</b>이 함께하고 있어요.
          </p>
        </Link>

        <p className="mt-10 text-center text-label leading-relaxed text-white/75">
          함께 이야기하고, 서로 힘을 모아
          <br />
          좋은 일을 완성해보세요.
        </p>
      </div>

      {/* 하단 고정 버튼 (action/[id]/page.tsx의 크루 챗 버튼과 같은 위치 및 간격).
          탭 높이는 globals.css 의 --nav-h 변수 (2026-09-18) */}
      <div className="fixed inset-x-0 bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-app flex-col gap-2 px-6 py-4">
        <Link
          href={`/action/${id}/chat`}
          className="flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-brand-soft text-body font-semibold text-brand transition-colors active:bg-white"
        >
          <MessageSquareQuote className="h-5 w-5 flex-none" aria-hidden="true" />
          <span>함께하는 크루와 이야기하기</span>
        </Link>
      </div>
    </main>
  );
}
