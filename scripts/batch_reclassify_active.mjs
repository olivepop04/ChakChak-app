/**
 * 모집 중(ACTIVE) 액션을 지금 판 지시문으로 다시 분류합니다 (민호 담당, 2026-09-29).
 *
 *   npm run reclassify:active                  미리보기 — 목록만 (AI·DB 쓰기 없음)
 *   npm run reclassify:active -- --apply       지금 판이 아닌 것만 다시 분류해서 저장
 *   npm run reclassify:active -- --apply --force  지금 판인 것까지 전부 다시 분류
 *
 * 언제 쓰나 — 분류 지시문을 고치고 판(PROMPT_VERSION)을 올린 뒤, 모집 중 액션을 새 판으로 맞출 때.
 * 이미 지금 판으로 분류된 액션은 **건너뜁니다** (--force 를 붙일 때만 다시 합니다).
 *
 * ⚠️ 이 스크립트는 있던 색인을 새 결과로 **덮어씁니다.** 시연 직전에는 추천 결과가 바뀔 수 있으니
 *    먼저 미리보기로 몇 개가 바뀌는지 보세요.
 *
 * 전에는 모집 중 액션을 조건 없이 전부 다시 분류했고, 결과에 옛 판 이름표(classify-v2)를 붙였습니다.
 */
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { PROMPT_VERSION, classifyMany, parseFlags } from './classify-core.mjs';

const { apply, force } = parseFlags(process.argv);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !serviceKey || (apply && !openaiApiKey)) {
  console.error(
    '.env.local 에 NEXT_PUBLIC_SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY' +
      (apply ? ' · OPENAI_API_KEY' : '') +
      ' 가 있는지 확인하세요. npm run reclassify:active 로 실행하면 자동으로 읽습니다.',
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log(
    `🔁 모집 중 액션을 ${PROMPT_VERSION} 으로 다시 분류${force ? ' (지금 판인 것까지 전부)' : ''}${apply ? '' : ' — 미리보기'}\n`,
  );

  const { data: actions, error } = await supabase
    .from('actions')
    .select('id, title, description, category, address')
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: true });
  if (error) {
    console.error('액션 조회 실패:', error.message);
    process.exit(1);
  }

  const { data: metas, error: metaError } = await supabase
    .from('action_ai_metadata')
    .select('action_id, prompt_version');
  if (metaError) {
    console.error('색인 조회 실패:', metaError.message);
    process.exit(1);
  }
  const versionById = new Map(metas.map((m) => [m.action_id, m.prompt_version]));

  const targets = force
    ? actions
    : actions.filter((a) => versionById.get(a.id) !== PROMPT_VERSION);

  console.log(`모집 중 ${actions.length}개 중 다시 분류할 것 ${targets.length}개`);
  targets.forEach((a, i) => console.log(`  ${i + 1}. [지금 판: ${versionById.get(a.id) ?? '없음'}] ${a.title}`));

  if (targets.length === 0) return;
  if (!apply) {
    console.log('\n미리보기입니다 — 아무것도 바꾸지 않았습니다. 다시 분류하려면: npm run reclassify:active -- --apply');
    return;
  }

  const openai = new OpenAI({ apiKey: openaiApiKey });
  console.log('');
  const { success, fail } = await classifyMany({ supabase, openai, actions: targets });
  console.log(`\n✨ 끝 — 성공 ${success}개 · 실패 ${fail}개`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('실패:', err.message);
  process.exit(1);
});
