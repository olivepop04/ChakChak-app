/**
 * 소감 작성.
 *
 * ★ 저장과 동시에 참여 상태가 ACTUALLY_PARTICIPATED 로 바뀝니다.
 *   submit_crew_voice RPC 안에서 한 트랜잭션으로 처리하므로
 *   화면에서 상태를 따로 바꿀 필요가 없습니다.
 *
 * 이때부터 MY 의 "참여 액션 수" 에 반영됩니다.
 */
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { VoiceForm } from '@/components/action/VoiceForm';
import { Header } from '@/components/layout/Header';
import { EmptyState } from '@/components/ui/EmptyState';

export default async function VoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/action/${id}/voice`);

  const { data: action } = await supabase
    .from('actions')
    .select('id, title, status')
    .eq('id', id)
    .maybeSingle();
  if (!action) notFound();

  const [{ data: participation }, { data: existing }] = await Promise.all([
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

  // 참여하지 않았거나 나간 사람
  if (!participation || participation.status === 'LEFT') {
    return (
      <main>
        <Header title="소감 남기기" back backHref={`/action/${id}`} />
        <EmptyState
          icon="🔒"
          title="참여한 사람만 소감을 남길 수 있어요"
          action={{ label: '액션 보러 가기', href: `/action/${id}` }}
        />
      </main>
    );
  }

  // 이미 썼으면 결과 화면으로
  if (existing) redirect(`/action/${id}/result`);

  // 아직 활동이 안 끝났으면
  if (participation.status === 'BEFORE_ACTION') {
    return (
      <main>
        <Header title="소감 남기기" back backHref={`/action/${id}`} />
        <EmptyState
          icon="⏳"
          title="활동이 끝난 뒤에 남길 수 있어요"
          description="활동일이 지나면 소감을 남길 수 있게 열려요."
          action={{ label: '액션 보러 가기', href: `/action/${id}` }}
        />
      </main>
    );
  }

  // 호스트가 결과를 공개한 뒤에만 소감을 작성할 수 있습니다.
  if (action.status !== 'COMPLETED') {
    return (
      <main>
        <Header title="소감 남기기" back backHref={`/action/${id}`} />
        <EmptyState
          icon="⏳"
          title="결과가 공개된 뒤에 소감을 남길 수 있어요"
          description="호스트가 결과를 공개하면 소감 작성이 열려요."
          action={{ label: '액션 보러 가기', href: `/action/${id}` }}
        />
      </main>
    );
  }

  return (
    <main>
      <Header title="소감 남기기" back backHref={`/action/${id}/result`} sticky />
      <VoiceForm actionId={id} actionTitle={action.title} />
    </main>
  );
}
