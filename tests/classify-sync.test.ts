/**
 * 액션 자동 분류 규칙(lib/ai/classify-spec.ts)을 지킵니다 (2026-09-29).
 *
 * 공개할 때 분류(app/api/ai/classify/route.ts)와 「한꺼번에 다시 분류」 스크립트
 * (scripts/classify-core.mjs)가 **같은 규칙 파일을 import** 하는지부터 봅니다.
 * 전에는 스크립트가 지시문을 복사해 들고 있어서 지시문은 v3 인데 이름표는 v2 였고,
 * 답 검사(zod)도 빠져 있었습니다. 어느 한쪽이 다시 자기 규칙을 들기 시작하면 여기서 깨집니다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CATEGORIES, SKILLS } from '../lib/constants/index.ts';
import {
  ALLOWED_ACTIVITY_TYPES,
  ALLOWED_CATEGORIES,
  ALLOWED_DIFFICULTIES,
  ALLOWED_PARTICIPATION_MODES,
  ALLOWED_SKILLS,
  ALLOWED_TARGET_GROUPS,
  CLASSIFY_MAX_TOKENS,
  CLASSIFY_MODEL,
  CLASSIFY_SYSTEM,
  CLASSIFY_TEMPERATURE,
  ClassifySchema,
  buildClassifyUser,
  classificationGap,
  describeItems,
  isEmptyClassification,
  sanitizeClassification,
} from '../lib/ai/classify-spec.ts';
import { parseFlags } from '../scripts/classify-core.mjs';

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('앱과 스크립트가 같은 규칙 파일을 쓴다 — 어느 쪽도 자기 지시문을 따로 들지 않는다', () => {
  const route = read('../app/api/ai/classify/route.ts');
  assert.match(route, /from '@\/lib\/ai\/classify-spec'/);
  assert.doesNotMatch(route, /const SYSTEM\b|z\.object\(|const ALLOWED_/, '라우트가 규칙을 다시 들고 있음');

  const core = read('../scripts/classify-core.mjs');
  assert.match(core, /from '\.\.\/lib\/ai\/classify-spec\.ts'/);
  assert.doesNotMatch(core, /const SYSTEM\b|z\.object\(|const ALLOWED_/, '스크립트가 규칙을 다시 들고 있음');

  for (const f of ['../scripts/reclassify_all_actions.mjs', '../scripts/batch_reclassify_active.mjs']) {
    assert.doesNotMatch(read(f), /const SYSTEM\b|const ALLOWED_|PROMPT_VERSION = '/, `${f} 가 규칙을 다시 들고 있음`);
  }
});

test('스크립트의 AI 설정이 앱(lib/openai.ts)과 같다', () => {
  const openai = read('../lib/openai.ts');
  assert.equal(openai.match(/export const AI_MODEL = '([^']+)'/)?.[1], CLASSIFY_MODEL);
  assert.equal(Number(openai.match(/CLASSIFY:\s*([\d.]+)/)?.[1]), CLASSIFY_TEMPERATURE);
  assert.equal(Number(openai.match(/maxTokens = (\d+)/)?.[1]), CLASSIFY_MAX_TOKENS);
});

test('허용 목록이 공용 상수와 같고, 지시문에 그대로 적혀 있다', () => {
  assert.deepEqual([...ALLOWED_CATEGORIES], [...CATEGORIES]);
  assert.deepEqual([...ALLOWED_SKILLS], [...SKILLS, '기타']);
  for (const list of [
    ALLOWED_CATEGORIES,
    ALLOWED_ACTIVITY_TYPES,
    ALLOWED_TARGET_GROUPS,
    ALLOWED_PARTICIPATION_MODES,
    ALLOWED_SKILLS,
    ALLOWED_DIFFICULTIES,
  ]) {
    assert.ok(CLASSIFY_SYSTEM.includes(`허용 목록: ${list.join(', ')}`), `지시문에 없는 목록: ${list.join(', ')}`);
  }
});

test('지시문의 출력 예시가 허용 목록 안의 값만 쓴다 — 재능 이름을 바꾸면 여기서 걸린다', () => {
  const example = JSON.parse(CLASSIFY_SYSTEM.slice(CLASSIFY_SYSTEM.lastIndexOf('{')));
  const within = (vals: string[], allowed: readonly string[]) =>
    vals.forEach((v) => assert.ok(allowed.includes(v), `예시 값 ${v} 가 허용 목록 밖`));
  within(example.categories, ALLOWED_CATEGORIES);
  within(example.activity_types, ALLOWED_ACTIVITY_TYPES);
  within(example.target_groups, ALLOWED_TARGET_GROUPS);
  within([example.participation_modes], ALLOWED_PARTICIPATION_MODES);
  within(example.skills, ALLOWED_SKILLS);
  within([example.difficulty], ALLOWED_DIFFICULTIES);
});

test('답 검사 — 칸의 모양이 틀리면 거절한다 (다시 묻게)', () => {
  assert.equal(ClassifySchema.safeParse({ activity_types: '실외 활동' }).success, false);
  assert.equal(ClassifySchema.safeParse({ skills: null }).success, false);
  assert.equal(ClassifySchema.safeParse({ keywords: ['공원', 2024] }).success, false);
  assert.equal(ClassifySchema.safeParse({ participation_modes: '10~20명 중그룹' }).success, true);
});

test('키를 한 겹 감싼 답은 「빈 분류」 로 본다 — 기본값뿐인 색인을 저장하지 않게', () => {
  const wrapped = ClassifySchema.parse({ result: { activity_types: ['실외 활동'] } });
  assert.equal(isEmptyClassification(wrapped), true);
  assert.equal(isEmptyClassification(ClassifySchema.parse({ activity_types: ['실외 활동'] })), false);
});

test('답 정리 — 목록 밖 값은 버리고 빈 칸은 기본값', () => {
  const action = { title: '동네 공원 플로깅 모임', category: '환경' };
  const meta = sanitizeClassification(
    ClassifySchema.parse({
      categories: ['환경', '우주'],
      activity_types: ['실외 활동', '물속'],
      target_groups: [],
      participation_modes: '10~20명 중그룹',
      skills: ['운전', '마법'],
      keywords: ['공원', ' ', '쓰레기', '집게', '봉투', '장갑', '조끼'],
      difficulty: '아무나',
    }),
    action,
  );
  assert.deepEqual(meta, {
    categories: ['환경'],
    activity_types: ['실외 활동'],
    target_groups: ['교류·교육·소통형'],
    participation_modes: ['10~20명 중그룹'],
    skills: ['운전'],
    keywords: ['공원', '쓰레기', '집게', '봉투', '장갑'],
    difficulty: '누구나 참여가능',
  });
});

test('모집 항목 설명 · AI 에게 보내는 메시지 모양', () => {
  assert.deepEqual(
    describeItems([
      { type: 'PERSON', name: '조리', min_required: 4, max_allowed: 6 },
      { type: 'PERSON', name: '운전', min_required: 2, max_allowed: 2 },
      { type: 'GOODS', name: '도시락통', min_required: 50, max_allowed: null },
    ]),
    ['조리 (4~6명)', '운전 (2명)', '도시락통 (50개)'],
  );
  assert.deepEqual(
    JSON.parse(buildClassifyUser({ title: 'T', description: null, category: '환경', address: '서울' }, null)),
    { 제목: 'T', 소개: null, 카테고리: '환경', 장소: '서울', 모집항목: [] },
  );
});

test('이미 AI 가 분류한 액션은 건너뛴다 — 옛 판이어도', () => {
  assert.equal(classificationGap(undefined), '색인 없음');
  assert.equal(classificationGap({ ai_model: 'seed', prompt_version: 'classify-v2' }), '시드 기본값');
  assert.equal(classificationGap({ ai_model: 'gpt-4o-mini', prompt_version: 'classify-v3-fallback' }), 'AI 실패 기본값');
  assert.equal(classificationGap({ ai_model: 'gpt-4o-mini', prompt_version: 'classify-v3' }), null);
  assert.equal(classificationGap({ ai_model: 'gpt-4o-mini', prompt_version: 'classify-v2' }), null);
});

test('스크립트는 기본이 미리보기 — --apply 를 붙여야 저장한다', () => {
  assert.deepEqual(parseFlags(['node', 'x.mjs']), { apply: false, force: false, exportSeed: false });
  assert.equal(parseFlags(['node', 'x.mjs', '--apply']).apply, true);
});
