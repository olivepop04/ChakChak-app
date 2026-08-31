/**
 * Home — 액션 피드.
 *
 * 지금은 뼈대 확인용 화면이다.
 * 담당자가 목업(01.good_home_for_you_v02.html)을 보고 실제 피드로 바꾼다.
 *
 * Supabase 연결 전에도 `npm run dev` 가 돌아가도록 만들어 두었다.
 * 환경변수가 없으면 설정 안내를, 있으면 실제 액션 목록을 보여준다.
 */
import { Avatar } from '@/components/ui/Avatar';
import { QuotaProgress } from '@/components/action/QuotaProgress';
import type { QuotaItem } from '@/lib/utils/quota';

const isConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** 모집 방식 3가지가 화면에서 어떻게 다른지 보여주는 예시 */
const SAMPLES: Array<{ item: QuotaItem; current: number }> = [
  {
    item: {
      type: 'PERSON',
      name: '요리 담당',
      target_type: 'RANGE',
      min_required: 3,
      max_allowed: 3,
      unit: '명',
      gender_requirement: 'ANY',
    },
    current: 3,
  },
  {
    item: {
      type: 'PERSON',
      name: '운반 지원',
      target_type: 'RANGE',
      min_required: 3,
      max_allowed: 5,
      unit: '명',
      gender_requirement: 'MALE',
    },
    current: 4,
  },
  {
    item: {
      type: 'PERSON',
      name: '일반 Crew',
      target_type: 'MINIMUM',
      min_required: 10,
      max_allowed: null,
      unit: '명',
      gender_requirement: 'ANY',
    },
    current: 15,
  },
  {
    item: {
      type: 'GOODS',
      name: '분유',
      target_type: 'MINIMUM',
      min_required: 100,
      max_allowed: null,
      unit: '통',
    },
    current: 64,
  },
];

export default function HomePage() {
  return (
    <main className="px-5 pb-24 pt-8">
      <header className="mb-8">
        <p className="text-xs font-semibold tracking-widest text-neutral-400">
          GOOD
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900">
          좋은 일을 찾고,
          <br />
          함께하고, 다시 나누는 곳
        </h1>
      </header>

      {!isConfigured && <SetupNotice />}

      <section className="mt-8">
        <h2 className="mb-1 text-sm font-semibold text-neutral-900">
          모집 표시 규칙 확인용
        </h2>
        <p className="mb-5 text-xs leading-relaxed text-neutral-500">
          정해진 인원(RANGE)은 퍼센트를 쓰고, 최소 인원(MINIMUM)은 쓰지 않습니다.
          아래 네 가지가 각각 어떻게 보이는지 확인하세요.
        </p>

        <div className="flex flex-col gap-5 rounded-xl border border-neutral-200 p-4">
          {SAMPLES.map(({ item, current }) => (
            <QuotaProgress
              key={item.name}
              item={item}
              current={current}
              detailed
              conditionName={
                item.name === '요리 담당' ? '조리사 자격증 보유' : null
              }
            />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-neutral-900">
          이니셜 아바타
        </h2>
        <div className="flex items-center gap-3">
          {['올리브', 'Sarah', 'Jason', '민호', 'Mina'].map((n) => (
            <div key={n} className="flex flex-col items-center gap-1.5">
              <Avatar name={n} />
              <span className="text-[11px] text-neutral-500">{n}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function SetupNotice() {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
      <h2 className="text-sm font-semibold text-amber-900">
        Supabase 연결이 아직 안 되어 있습니다
      </h2>
      <ol className="mt-2 flex list-decimal flex-col gap-1 pl-4 text-xs leading-relaxed text-amber-900/90">
        <li>
          <code className="rounded bg-amber-100 px-1">.env.local.example</code>{' '}
          을 <code className="rounded bg-amber-100 px-1">.env.local</code> 로
          복사합니다.
        </li>
        <li>Supabase 프로젝트의 URL 과 anon key 를 채웁니다.</li>
        <li>
          SQL Editor 에서 <code className="rounded bg-amber-100 px-1">supabase/</code>{' '}
          폴더의 01 → 02 → 03 순서로 실행합니다.
        </li>
        <li>개발 서버를 다시 시작합니다.</li>
      </ol>
    </div>
  );
}
