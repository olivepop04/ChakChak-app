import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function main() {
  const { data: actions, error: actErr } = await supabase
    .from('actions')
    .select('id, title, category, status, address')
    .order('created_at', { ascending: false });

  if (actErr) {
    console.error('Error fetching actions:', actErr);
    return;
  }

  const { data: metas, error: metaErr } = await supabase
    .from('action_ai_metadata')
    .select('*');

  if (metaErr) {
    console.error('Error fetching metadata:', metaErr);
    return;
  }

  const metaByActionId = new Map(metas.map((m) => [m.action_id, m]));

  const versionCounts = {};
  for (const m of metas) {
    versionCounts[m.prompt_version || 'unknown'] = (versionCounts[m.prompt_version || 'unknown'] || 0) + 1;
  }

  const statusCounts = {};
  for (const a of actions) {
    statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
  }

  console.log('=== DB 통계 요약 ===');
  console.log(`총 액션: ${actions.length}개`);
  console.log('액션 상태별:', statusCounts);
  console.log(`action_ai_metadata 행 수: ${metas.length}개`);
  console.log('색인 prompt_version 분포:', versionCounts);

  const activeActions = actions.filter((a) => a.status === 'ACTIVE');
  console.log(`\n=== 현재 모집 중(ACTIVE) 액션 (${activeActions.length}개) 색인 현황 ===`);
  
  const activeTable = activeActions.map((a, i) => {
    const m = metaByActionId.get(a.id);
    return {
      No: i + 1,
      제목: a.title.length > 20 ? a.title.slice(0, 18) + '..' : a.title,
      카테고리: a.category,
      지역: a.address ? a.address.split(' ').slice(0, 2).join(' ') : '미등록',
      색인여부: m ? 'O' : 'X',
      버전: m?.prompt_version ?? '-',
      환경: m?.activity_types?.join(',') ?? '-',
      성격: m?.target_groups?.join(',') ?? '-',
      인원규모: m?.participation_modes?.join(',') ?? '-',
      재능: m?.skills?.join(',') || '(없음)',
      문턱: m?.difficulty ?? '-',
    };
  });

  console.table(activeTable);
}

main();
