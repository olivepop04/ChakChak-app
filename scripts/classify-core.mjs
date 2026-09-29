/**
 * 「한꺼번에 다시 분류」 스크립트 두 개가 같이 쓰는 부품 (민호 담당, 2026-09-29).
 *
 *   reclassify_all_actions.mjs   아직 제대로 분류 안 된 액션만 채운다
 *   batch_reclassify_active.mjs  모집 중 액션을 지금 판으로 다시 분류한다
 *
 * **분류 규칙(지시문 · 답 검사 · 허용 목록 · 정리)은 lib/ai/classify-spec.ts 에 있습니다.**
 * 공개할 때 분류(app/api/ai/classify/route.ts)와 같은 파일을 import 하므로 둘이 어긋날 수 없습니다.
 * 여기에는 「DB 에서 읽고 → AI 부르고 → 저장하고 → 기록 남기는」 순서만 있습니다.
 *
 * .ts 파일을 바로 import 하므로 node 22.18 이상(또는 --experimental-strip-types)이 필요합니다.
 * package.json 의 npm run reclassify 가 그 옵션을 붙여 줍니다.
 *
 * 이 파일은 DB·OpenAI 연결을 만들지 않습니다. 부르는 쪽이 넘깁니다.
 */
import { z } from 'zod';
import {
  CLASSIFY_MAX_TOKENS,
  CLASSIFY_MODEL,
  CLASSIFY_PROMPT_VERSION,
  CLASSIFY_SYSTEM,
  CLASSIFY_TEMPERATURE,
  ClassifySchema,
  buildClassifyUser,
  classificationGap,
  isEmptyClassification,
  sanitizeClassification,
} from '../lib/ai/classify-spec.ts';

export { CLASSIFY_PROMPT_VERSION as PROMPT_VERSION, classificationGap };

/** 명령줄 옵션 — 기본은 미리보기, --apply 를 붙여야 실제로 저장합니다 */
export function parseFlags(argv) {
  return {
    apply: argv.includes('--apply'),
    force: argv.includes('--force'),
    exportSeed: argv.includes('--export-seed'),
  };
}

/** 로그 실패가 분류를 막으면 안 된다 — lib/openai.ts 의 logRun 과 같은 칸·같은 오류 이름 */
async function logRun(supabase, row) {
  try {
    await supabase.from('ai_runs').insert({
      agent_type: 'CLASSIFY',
      prompt_version: CLASSIFY_PROMPT_VERSION,
      model: CLASSIFY_MODEL,
      output_json: row.output ?? null,
      status: row.status,
      error_code: row.errorCode ?? null,
      latency_ms: row.latency,
      user_id: null,
      action_id: row.actionId,
    });
  } catch {
    // 로그는 부가 기능이다
  }
}

/**
 * 액션 하나를 분류해서 저장합니다. 앱(callStructuredAI)과 같게 —
 * 답을 ClassifySchema 로 검사하고, 틀리거나 비어 있으면 한 번 다시 묻고, 결과를 ai_runs 에 남깁니다.
 * **실패하면 저장하지 않습니다** — 있던 색인을 기본값으로 덮지 않게.
 * @returns {Promise<{ ok: true, meta: object } | { ok: false, error: string }>}
 */
export async function classifyAndSave({ supabase, openai, action }) {
  const { data: items, error: itemsError } = await supabase
    .from('action_items')
    .select('type, name, min_required, max_allowed')
    .eq('action_id', action.id);
  // 모집 항목을 못 읽었는데 분류하면 인원 규모가 빈 채로 저장됩니다 — 부르지 않습니다
  if (itemsError) return { ok: false, error: `모집 항목 조회 실패: ${itemsError.message}` };

  const startedAt = Date.now();
  let answer = null;
  let lastError = null;
  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      const res = await openai.chat.completions.create({
        model: CLASSIFY_MODEL,
        temperature: CLASSIFY_TEMPERATURE,
        max_tokens: CLASSIFY_MAX_TOKENS,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: CLASSIFY_SYSTEM },
          { role: 'user', content: buildClassifyUser(action, items) },
        ],
      });
      const parsed = ClassifySchema.parse(JSON.parse(res.choices[0]?.message?.content ?? ''));
      if (isEmptyClassification(parsed)) throw new SyntaxError('AI 가 빈 분류를 돌려줌');
      answer = parsed;
      await logRun(supabase, {
        status: attempt === 0 ? 'SUCCESS' : 'RETRY_OK',
        output: parsed,
        latency: Date.now() - startedAt,
        actionId: action.id,
      });
      break;
    } catch (err) {
      lastError = err;
      if (attempt === 1) {
        const isSchema = err instanceof z.ZodError || err instanceof SyntaxError;
        await logRun(supabase, {
          status: isSchema ? 'SCHEMA_FAIL' : 'API_FAIL',
          output: null,
          latency: Date.now() - startedAt,
          actionId: action.id,
          errorCode: isSchema ? 'INVALID_JSON' : 'API_ERROR',
        });
      }
    }
  }
  if (answer === null) return { ok: false, error: lastError?.message ?? 'AI 응답 없음' };

  const meta = sanitizeClassification(answer, action);
  const { error } = await supabase.from('action_ai_metadata').upsert(
    {
      action_id: action.id,
      ...meta,
      ai_model: CLASSIFY_MODEL,
      prompt_version: CLASSIFY_PROMPT_VERSION,
      owner_confirmed: false, // 앱과 같게 — 호스트가 확인한 값이 아님
    },
    { onConflict: 'action_id' },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true, meta };
}

/** 여러 개를 5개씩 나눠 처리하고 한 줄씩 결과를 찍습니다 */
export async function classifyMany({ supabase, openai, actions }) {
  const CONCURRENCY = 5;
  let success = 0;
  let fail = 0;
  for (let i = 0; i < actions.length; i += CONCURRENCY) {
    const chunk = actions.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map((action) => classifyAndSave({ supabase, openai, action })),
    );
    results.forEach((r, j) => {
      const a = chunk[j];
      const n = `[${i + j + 1}/${actions.length}]`;
      if (r.ok) {
        success++;
        console.log(
          `${n} ✅ ${a.title} → 환경:${r.meta.activity_types.join(',')} | 성격:${r.meta.target_groups.join(',')} | ` +
            `재능:${r.meta.skills.join(',') || '(없음)'} | 문턱:${r.meta.difficulty}`,
        );
      } else {
        fail++;
        console.log(`${n} ❌ ${a.title} — ${r.error} (있던 색인은 그대로 둠)`);
      }
    });
  }
  return { success, fail };
}

/**
 * 시드가 읽는 JSON(scripts/data/action_ai_metadata_all.json)을 새로 씁니다.
 *
 *   - **시드 액션만** 씁니다. 전에는 DB 전체를 써서 실제 사용자 액션 제목이 저장소에 올라갈 수 있었습니다.
 *   - **제대로 분류된 것만** 씁니다. 시드 기본값·AI 실패 기본값을 쓰면 다음 시드에서
 *     「AI 가 분류한 값」 으로 둔갑해 다시는 분류 대상에 안 잡힙니다.
 *   - 새 내용이 비었거나 기존 파일보다 10% 넘게 줄면 **쓰지 않습니다**(--force 로만).
 *     seed:clean 뒤에 돌리면 빈 파일이 되어, 다음 시드가 전부 기본값이 되기 때문입니다.
 *
 * @returns {Promise<{ written: boolean, count: number, skipped: number, previous: number, reason?: string }>}
 */
export async function exportSeedJson({ supabase, outPath, fs, force = false }) {
  const seedOwners = new Set();
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`계정 목록 조회 실패: ${error.message}`);
    for (const u of data.users) if (u.email?.endsWith('@good.seed')) seedOwners.add(u.id);
    if (data.users.length < 1000) break;
  }

  const { data: rows, error } = await supabase
    .from('action_ai_metadata')
    .select(
      'action_id, categories, activity_types, target_groups, participation_modes, skills, keywords, difficulty, ai_model, prompt_version, actions!inner(title, owner_id)',
    );
  if (error) throw new Error(`색인 조회 실패: ${error.message}`);

  const seedRows = rows.filter((r) => seedOwners.has(r.actions.owner_id));
  const ready = seedRows.filter((r) => classificationGap(r) === null);
  const skipped = seedRows.length - ready.length;
  const out = ready.map(({ actions, ai_model: _model, ...rest }) => ({ ...rest, actions: { title: actions.title } }));

  let previous = 0;
  try {
    previous = JSON.parse(fs.readFileSync(outPath, 'utf-8')).length;
  } catch {
    previous = 0;
  }
  if (!force && (out.length === 0 || out.length < previous * 0.9)) {
    return {
      written: false,
      count: out.length,
      skipped,
      previous,
      reason: `새 내용 ${out.length}개가 기존 ${previous}개보다 너무 적습니다 — 시드를 먼저 돌렸는지 보세요 (그래도 쓰려면 --force)`,
    };
  }

  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf-8');
  return { written: true, count: out.length, skipped, previous };
}
