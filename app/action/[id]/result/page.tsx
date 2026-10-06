/**
 * 결과 보기.
 *
 * 비회원도 볼 수 있습니다. 결과를 공유하는 것이 서비스의 마지막 단계니까요.
 * 참여자에게는 아래에 "소감 남기기" 버튼을 보여줍니다.
 */
import { Fragment } from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActionResult } from '@/lib/queries/participations';
import { UsersRound, Package, FileText } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { CrewVoiceList } from '@/components/action/CrewVoiceList';
import { ArrowScroller } from '@/components/action/ActionGallery';
import { describeResult, describeResultRatio, getQuotaState } from '@/lib/utils/quota';
import { cn } from '@/lib/utils/cn';
import { formatActivityPeriod } from '@/lib/utils/date';

export default async function ResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: action } = await supabase
    .from('actions')
    .select(
      `id, title, status, place_name, address, activity_start_at, activity_end_at,
       owner:profiles!actions_owner_id_fkey ( id, nickname )`,
    )
    .eq('id', id)
    .maybeSingle();
  if (!action) notFound();

  const owner = action.owner as unknown as { id: string; nickname: string } | null;
  const location = action.place_name || action.address;
  const result = await getActionResult(supabase, id);

  // 내 참여 상태 — 소감 버튼을 보여줄지 판단합니다
  let myStatus: string | null = null;
  let iWroteVoice = false;
  if (user) {
    const [{ data: p }, { data: v }] = await Promise.all([
      supabase
        .from('participations')
        .select('status')
        .eq('action_id', id)
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('crew_voices')
        .select('id')
        .eq('action_id', id)
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);
    myStatus = p?.status ?? null;
    iWroteVoice = !!v;
  }

  const canWriteVoice =
    !!user && !!myStatus && myStatus !== 'LEFT' && !iWroteVoice && action.status === 'COMPLETED';

  if (!result) {
    return (
      <main>
        <Header title="액션 결과" back backHref={`/action/${id}`} />
        <EmptyState
          icon={FileText}
          title="아직 결과가 등록되지 않았어요"
          description="호스트가 결과를 정리해서 올리면 이곳에서 확인할 수 있어요."
          action={{ label: '액션 보러 가기', href: `/action/${id}` }}
        />
      </main>
    );
  }

  return (
    <main className={canWriteVoice ? 'pb-52' : 'pb-24'}>
      <Header title="액션 결과" back backHref={`/action/${id}`} sticky asH1={false} />

      <div className="flex flex-col gap-10 px-6 py-6">
        {/* 제목 + 장소 | 일정 — 연한 초록 카드 (2026-10-06 형태 실험).
            상단 바는 흰색 그대로, 큰 구역 초록 칠은 참여 완료 화면만(조장 의견).
            연한 초록 위라 장소·일정 글자는 #737373 → #525252 로 한 단계 진하게(대비) */}
        <div className="rounded-xl bg-brand-soft p-5">
          <h1 className="font-paperlogy text-xl font-bold leading-snug tracking-tight text-brand">
            {action.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-y-1 text-label font-semibold text-neutral-600">
            {location && (
              <>
                <span>{location}</span>
                <span className="mx-2 h-3 w-px flex-none bg-[#BDBDBD]" aria-hidden="true" />
              </>
            )}
            <span>{formatActivityPeriod(action.activity_start_at, action.activity_end_at)}</span>
          </div>
        </div>

        {/* 자동 집계 — 액션 상세 "모집 현황"과 같은 형식(아이콘 원 + 항목 사이 구분선).
            2026-10-06 형태 실험: 상세와 같이 얇은 회색 선 상자로 묶음 */}
        <section className="flex flex-col gap-4">
          <h2 className="text-subtitle font-bold text-neutral-900">함께 모은 것</h2>
          <div className="flex flex-col gap-5 rounded-xl border border-hairline p-4">
            {result.items.map((item, idx) => {
              const { ratio, isMet } = describeResultRatio(item, item.currentCount);
              const Icon = item.type === 'PERSON' ? UsersRound : Package;
              const countLabel =
                item.target_type === 'MINIMUM'
                  ? `${item.currentCount}${item.unit} / ${item.min_required}${item.unit}`
                  : getQuotaState(item, item.currentCount).countLabel;
              const [countNumerator, countDenominator] = countLabel.split(' / ');
              return (
                <Fragment key={item.id}>
                {idx > 0 && <div className="h-px bg-neutral-100" />}
                <div className="flex flex-col gap-2">
                  {/* 상단: 아이콘 + 항목명 + 최종 모집 수 (한 row) */}
                  <div className="flex items-center gap-2">
                    {/* 원 안의 아이콘 (테두리 없음) */}
                    <div
                      className={cn(
                        'flex h-9 w-9 flex-none items-center justify-center rounded-full',
                        isMet ? 'bg-brand-soft' : 'bg-neutral-100',
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-[18px] w-[18px]',
                          isMet ? 'text-brand' : 'text-neutral-500',
                        )}
                        aria-hidden="true"
                      />
                    </div>

                    <span className="flex-1 truncate text-body font-semibold text-neutral-900">
                      {item.name}
                    </span>

                    {/* 최종 수 / 목표 수 — 액션 상세 「모집 현황」(QuotaProgress)과 같은 표기 (2026-09-29, 검수 의견)
                        범위 모집 「4 / 4~6명」 · 최소 모집 「50개 / 50개」, 목표 쪽은 회색으로 얇게 */}
                    <span
                      className={cn(
                        'shrink-0 text-body font-bold tabular-nums',
                        isMet ? 'text-brand' : 'text-neutral-900',
                      )}
                    >
                      {countNumerator}
                      {countDenominator && (
                        <span className="font-medium text-neutral-500"> / {countDenominator}</span>
                      )}
                    </span>
                  </div>

                  {/* 프로그레스바 게이지 (아이콘 앞까지 옴) */}
                  <div
                    className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200"
                    role="progressbar"
                    aria-valuenow={Math.round(ratio * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${item.name} 모집 현황`}
                  >
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-300',
                        isMet ? 'bg-brand' : 'bg-neutral-400',
                      )}
                      style={{ width: `${Math.round(ratio * 100)}%` }}
                    />
                  </div>

                  {/* 상태 안내 문구 */}
                  <p
                    className={cn(
                      'text-caption font-medium',
                      isMet ? 'text-brand' : 'text-neutral-500',
                    )}
                  >
                    {describeResult(item, item.currentCount)}
                  </p>
                </div>
                </Fragment>
              );
            })}
          </div>
        </section>

        {/* 결과 내용 + 사진 + 호스트의 한마디 — 한 덩어리(내부 간격 12px).
            2026-10-06 형태 실험: 덩어리 사이 얇은 구분선 — 섹션 간격 40px 은 그대로 두고 선만 가운데(-my-5) */}
        {(result.content || result.imageUrls.length > 0 || result.ownerVoice) && (
          <div aria-hidden="true" className="-my-5 h-px bg-[#EEEEEE]" />
        )}
        {(result.content || result.imageUrls.length > 0 || result.ownerVoice) && (
          <div className="flex flex-col gap-3">
            {result.content && (
              <section className="flex flex-col gap-2">
                <h2 className="text-subtitle font-bold text-neutral-900">이렇게 마무리했어요</h2>
                <p className="whitespace-pre-wrap text-body leading-relaxed text-neutral-700">
                  {result.content}
                </p>
              </section>
            )}

            {/* 컴퓨터용 좌우 화살표 — 액션 상세·홈 카드 사진과 같은 부품 (2026-09-29, 조장님 의견) */}
            {result.imageUrls.length > 0 && (
              <ArrowScroller
                step="partial"
                className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {result.imageUrls.map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={url}
                    src={url}
                    alt=""
                    className="h-44 w-auto flex-none rounded-xl object-cover"
                  />
                ))}
              </ArrowScroller>
            )}

            {/* 호스트의 한마디 — 2026-10-06 형태 실험: 상자 없이 큰 따옴표 + 옆에 「호스트의 한마디 - @핸들」.
                위 제목 카드와 연한 초록 상자가 겹쳐 둘 다 약해 보여서 상자를 뺌 */}
            {result.ownerVoice && (
              <section className="flex flex-col gap-2 pb-1 pt-2">
                <div className="flex items-start gap-2">
                  <span
                    aria-hidden="true"
                    className="h-6 flex-none font-paperlogy text-[40px] font-extrabold leading-[0.8] text-brand"
                  >
                    “
                  </span>
                  <h2 className="pt-0.5 font-paperlogy text-label font-bold leading-snug text-brand">
                    호스트의 한마디{owner && ` - @${owner.nickname}`}
                  </h2>
                </div>
                <p className="whitespace-pre-wrap break-keep text-body font-medium leading-relaxed text-neutral-900">
                  {result.ownerVoice}
                </p>
              </section>
            )}
          </div>
        )}

        <div aria-hidden="true" className="-my-5 h-px bg-[#EEEEEE]" />

        {/* 크루들의 한마디 */}
        <section className="flex flex-col gap-3">
          <h2 className="text-subtitle font-bold text-neutral-900">
            크루들의 한마디 ({result.crewVoices.length})
          </h2>

          {result.crewVoices.length === 0 ? (
            <p className="rounded-xl bg-neutral-50 px-4 py-6 text-center text-label text-neutral-400">
              아직 남겨진 소감이 없어요.
            </p>
          ) : (
            <CrewVoiceList voices={result.crewVoices} />
          )}
        </section>
      </div>

      {/* 소감 작성하기 — 검정 손코딩 → 공용 Button(그린). 탭 높이는 globals.css 의 --nav-h 변수 (2026-09-18) */}
      {canWriteVoice && (
        <div className="fixed inset-x-0 bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom))] z-30 mx-auto max-w-app bg-white px-6 py-4">
          <Button href={`/action/${id}/voice`} size="lg" fullWidth>
            소감 작성하기
          </Button>
        </div>
      )}
    </main>
  );
}
