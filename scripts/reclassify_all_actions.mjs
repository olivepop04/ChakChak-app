/**
 * 아직 제대로 분류 안 된 액션만 AI 로 분류합니다 (민호 담당, 2026-09-29).
 *
 *   npm run reclassify                  미리보기 — 무엇을 분류할지 목록만 보여줍니다 (AI·DB 쓰기 없음)
 *   npm run reclassify -- --apply       실제로 분류해서 저장합니다
 *   npm run reclassify -- --export-seed 시드용 JSON 을 새로 씁니다 — 시드 액션 중 제대로 분류된 것만
 *                                       (--apply 와 같이 써도 됨. 내용이 크게 줄면 멈추고, --force 로만 씀)
 *
 * 「제대로 분류 안 된」 것 — 색인이 없거나, 시드가 대충 채운 기본값이거나,
 * 공개 때 AI 가 실패해서 들어간 기본값인 것. 이미 AI 가 분류한 액션은 **건너뜁니다.**
 * 작성 중(DRAFT) 액션은 공개할 때 앱이 분류하므로 건너뜁니다.
 *
 * 언제 쓰나 — 시드 목록 끝에 액션을 새로 붙였을 때, 공개 때 AI 가 실패한 액션을 다시 채울 때.
 * 모집 중 액션 전체를 지금 판으로 다시 분류하려면 batch_reclassify_active.mjs 를 쓰세요.
 *
 * 전에는 「classify-v2 가 아닌 것」 을 골라서, 앱에서 제대로 분류한 v3 액션을 전부
 * 덮어쓰고 시드 기본값은 건너뛰었습니다. 조건을 「제대로 분류됐는가」 로 바꿨습니다.
 */
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import fs from 'node:fs';
import path from 'node:path';
import {
  PROMPT_VERSION,
  classificationGap,
  classifyMany,
  exportSeedJson,
  parseFlags,
} from './classify-core.mjs';

const { apply, exportSeed, force } = parseFlags(process.argv);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !serviceKey || (apply && !openaiApiKey)) {
  console.error(
    '.env.local 에 NEXT_PUBLIC_SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY' +
      (apply ? ' · OPENAI_API_KEY' : '') +
      ' 가 있는지 확인하세요. npm run reclassify 로 실행하면 자동으로 읽습니다.',
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log(`🔎 아직 제대로 분류 안 된 액션 찾기 (${PROMPT_VERSION})${apply ? '' : ' — 미리보기'}\n`);

  const { data: actions, error } = await supabase
    .from('actions')
    .select('id, title, description, category, address, status')
    .neq('status', 'DRAFT')
    .order('created_at', { ascending: true });
  if (error) {
    console.error('액션 조회 실패:', error.message);
    process.exit(1);
  }

  const { data: metas, error: metaError } = await supabase
    .from('action_ai_metadata')
    .select('action_id, ai_model, prompt_version');
  if (metaError) {
    console.error('색인 조회 실패:', metaError.message);
    process.exit(1);
  }
  const metaById = new Map(metas.map((m) => [m.action_id, m]));

  const targets = actions
    .map((a) => ({ action: a, gap: classificationGap(metaById.get(a.id)) }))
    .filter((t) => t.gap !== null);

  console.log(`공개된 액션 ${actions.length}개 중 분류할 것 ${targets.length}개`);
  targets.forEach((t, i) => console.log(`  ${i + 1}. [${t.gap}] ${t.action.title} (${t.action.status})`));

  if (targets.length > 0 && !apply) {
    console.log('\n미리보기입니다 — 분류는 하지 않았습니다. 분류하려면: npm run reclassify -- --apply');
  }

  if (targets.length > 0 && apply) {
    const openai = new OpenAI({ apiKey: openaiApiKey });
    console.log('');
    const { success, fail } = await classifyMany({
      supabase,
      openai,
      actions: targets.map((t) => t.action),
    });
    console.log(`\n✨ 끝 — 성공 ${success}개 · 실패 ${fail}개`);
    if (fail > 0) process.exitCode = 1;
  }

  if (exportSeed) {
    const outPath = path.resolve('scripts/data/action_ai_metadata_all.json');
    const r = await exportSeedJson({ supabase, outPath, fs, force });
    if (!r.written) {
      console.log(`\n⛔ 시드용 JSON 을 쓰지 않았습니다 — ${r.reason}`);
      process.exitCode = 1;
    } else {
      console.log(`\n💾 시드용 JSON 저장 — 시드 액션 ${r.count}개 (전 파일 ${r.previous}개) · ${outPath}`);
    }
    if (r.skipped > 0) {
      console.log(
        `   아직 제대로 분류 안 된 시드 액션 ${r.skipped}개는 뺐습니다 — 다음 시드에서도 다시 분류 대상으로 남습니다.`,
      );
    }
  }
}

main().catch((err) => {
  console.error('실패:', err.message);
  process.exit(1);
});
