/**
 * You're In! — 참여 확정 직후 화면.
 *
 * 라우트 이름이 /joined 가 아니라 /welcome 인 이유:
 * /join 과 접두사가 겹쳐서 middleware 의 보호 경로 판정이 헷갈렸습니다.
 */
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronLeft, MessageSquareQuote } from 'lucide-react';
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
  // 입장권 아래칸 오른쪽 — 아바타 3개 + 「+나머지」 (2026-10-05, 전에는 가운데 5개)
  const shown = everyone.slice(0, 3);
  const rest = everyone.length - shown.length;

  return (
    <main className="min-h-dvh bg-brand pb-32 text-white">
      {/* 이 화면만 전체 초록 배경(팀 확정)이라 공용 Header 대신 직접 그립니다.
          약관 화면(app/(auth)/_legal/LegalDocumentPage.tsx)과 같은 방식 */}
      <header className="flex h-14 items-center gap-2 px-3">
        <Link
          href={`/action/${id}`}
          replace
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

      {/* 2026-10-05 픽셀 포인트 목업 「참여 완료 B-2 (소정 수정본)」 — 체크 원 대신 입장권 카드.
          위 여백 48px(상단 바와 제목 사이). 픽셀(갈무리)은 You're In! · CHAK CHAK · CREW 세 곳만 */}
      <div className="flex flex-col px-6 pt-12">
        <div className="flex flex-col items-center text-center">
          {/* 픽셀 글꼴은 기준 11px 의 배수에서 선명 — 목업 28px 대신 33px */}
          <h2 className="font-pixel text-[33px] leading-tight text-white">You&apos;re In!</h2>
          <p className="mt-2.5 text-body text-white/85">
            좋은 일을 함께 시작하게 되었어요.
          </p>
        </div>

        {/* 입장권 — 위칸(라벨 + 액션 제목) / 점선 + 양옆 홈 / 아래칸(CREW N명 + 아바타).
            카드 전체를 누르면 크루 목록으로 가는 건 그대로 */}
        <Link
          href={`/action/${id}/crew`}
          className="mt-7 flex flex-col overflow-hidden rounded-xl bg-white"
        >
          <div className="flex flex-col gap-1.5 p-5">
            <span className="font-pixel text-caption leading-none tracking-wide text-brand">
              CHAK CHAK
            </span>
            <p className="line-clamp-2 font-paperlogy text-xl font-bold leading-snug text-neutral-900">
              {action.title}
            </p>
          </div>

          {/* 점선 + 양옆 홈 — 홈은 바탕(초록)과 같은 색 원을 카드 가장자리에 반쯤 걸쳐 그림(overflow-hidden 이 반을 자름) */}
          <div className="relative mx-4 border-t-2 border-dashed border-neutral-200" aria-hidden="true">
            <span className="absolute -left-[26px] -top-[11px] h-5 w-5 rounded-full bg-brand" />
            <span className="absolute -right-[26px] -top-[11px] h-5 w-5 rounded-full bg-brand" />
          </div>

          <div className="flex items-center justify-between gap-3 p-5">
            <div className="flex flex-col gap-1.5">
              <span className="font-pixel text-caption leading-none text-neutral-500">CREW</span>
              <span className="text-subtitle font-bold text-neutral-900">{everyone.length}명</span>
            </div>
            <div className="flex items-center">
              {shown.map((p, i) => (
                <span
                  key={p.id}
                  className="relative -ml-2.5 first:ml-0"
                  style={{ zIndex: i + 1 }}
                >
                  <Avatar
                    name={p.nickname}
                    avatar={p.avatar}
                    className="!h-9 !w-9 border-[3px] border-white"
                  />
                </span>
              ))}
              {rest > 0 && (
                <span className="relative -ml-2.5" style={{ zIndex: shown.length + 1 }}>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-white bg-neutral-100 text-caption font-semibold text-neutral-500">
                    +{rest}
                  </span>
                </span>
              )}
            </div>
          </div>
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
