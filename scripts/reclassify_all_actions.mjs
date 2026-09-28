import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import fs from 'node:fs';
import path from 'node:path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !serviceKey || !openaiApiKey) {
  console.error('환경 변수(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY)를 확인해주세요.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);
const openai = new OpenAI({ apiKey: openaiApiKey });

const PROMPT_VERSION = 'classify-v2';

const ALLOWED_CATEGORIES = [
  '동물',
  '환경',
  '지역사회',
  '아동·청소년',
  '노인',
  '장애',
  '교육',
  '기타',
];

const ALLOWED_ACTIVITY_TYPES = [
  '실내 활동',
  '실외 활동',
  '실내외 병행',
];

const ALLOWED_TARGET_GROUPS = [
  '교류·교육·소통형',
  '육체·과업·집중형',
];

const ALLOWED_PARTICIPATION_MODES = [
  '10명 이내 소그룹',
  '10~20명 중그룹',
  '20명 이상 대그룹',
];

const ALLOWED_SKILLS = [
  '사진 촬영',
  '영상 촬영·편집',
  '디자인',
  '글쓰기',
  'SNS 홍보',
  '요리',
  '운전',
  '교육·멘토링',
  '통역·번역',
  '컴퓨터·IT',
  '원예·식물관리',
  '청소·정리',
  '미술·공예',
  '음악·공연',
  '수리·시공',
  '기타',
];

const ALLOWED_DIFFICULTIES = [
  '누구나 참여가능',
  '기초 체력 필요',
  '전문지식/자격/재능 활용',
];

const SYSTEM = `당신은 선한 영향력 SNS '착착'의 액션 전문 분석 AI 에이전트입니다.
호스트가 작성한 액션의 제목, 소개글, 카테고리, 장소, 모집 항목들을 분석하여 Discover 맞춤 추천에 사용할 7가지 핵심 색인 메타데이터를 추출해 JSON 형식으로만 답하세요.

[분류 및 색인 상세 규칙]

1. categories (활동 분야):
   - 허용 목록: 동물, 환경, 지역사회, 아동·청소년, 노인, 장애, 교육, 기타
   - 호스트가 선택한 카테고리를 최우선으로 반영하되, 본문 내용상 복합적 성격이 명확하다면 최대 2개까지 복수 선택하세요.
   - 호스트가 '기타'를 선택한 경우, 본문의 제목과 소개글을 분석하여 가장 가까운 카테고리가 명확할 때만 1~2개로 재분류하세요. 특정 카테고리로 단정하기 애매한 경우 억지로 분류하지 말고 '기타'를 그대로 유지하세요.

2. activity_types (활동 환경):
   - 허용 목록: 실내 활동, 실외 활동, 실내외 병행
   - 활동 내용과 진행 장소를 분석하여 가장 적합한 환경을 1~2개 선택하세요.

3. target_groups (모임 성격 및 교류 형태):
   - (※ DB 컬럼명은 target_groups이나, 실제 분류 기준은 모임의 진행 방식과 활동 성격입니다)
   - 허용 목록: 교류·교육·소통형, 육체·과업·집중형
   - 사람 간의 대화, 교육, 가르침, 친목, 정서적 유대가 중심이면 '교류·교육·소통형'을 선택하세요 (예: 말벗, 멘토링, 아이돌봄, 학습/디지털 교육 등).
   - 작업, 땀 흘리기, 육체적 활동, 구체적인 결과물 완성이 중심이면 '육체·과업·집중형'을 선택하세요 (예: 플로깅, 연탄배달, 도시락포장, 시설청소, 이사지원 등).
   - 둘의 성격이 복합적이라면 복수로 선택하세요.

4. participation_modes (모임 인원 규모):
   - 허용 목록: 10명 이내 소그룹, 10~20명 중그룹, 20명 이상 대그룹
   - 모집 항목에 적힌 사람 인원수를 모두 합산하여 해당하는 규모 단 하나만 선택하세요. (인원수가 명시되지 않은 경우 본문 맥락에 따름)

5. skills (이 액션에서 실제로 활용할 수 있는 재능):
   - 허용 목록: 사진 촬영, 영상 촬영·편집, 디자인, 글쓰기, SNS 홍보, 요리, 운전, 교육·멘토링, 통역·번역, 컴퓨터·IT, 원예·식물관리, 청소·정리, 미술·공예, 음악·공연, 수리·시공, 기타
   - "잠재적으로 아무 도움이나 될 수 있는 재능"까지 무분별하게 넣지 마세요.
   - 모집 항목에 명시된 필수 역할/재능이거나, 본문 소개글에 명확한 근거가 있어 활동 수행에 실질적으로 도움이 되는 경우만 정밀하게 선택하세요.
   - 본문에 뚜렷한 근거가 없거나 누구나 할 수 있는 일반 활동인 경우 빈 배열 []로 두세요.

6. keywords (핵심 검색 키워드):
   - 검색 및 시맨틱 매칭에 활용할 가장 핵심적인 고유 명사 3~5개를 배열로 추출하세요.
   - '봉사', '모집', '활동' 같은 지나치게 일반적인 단어는 제외하고, 구체적인 활동 대상, 도구, 장소, 주제어를 추출하세요 (예: ["키오스크", "스마트폰", "디지털교육", "어르신"]).

7. difficulty (참여 문턱 및 요구 수준):
   - 허용 목록: 누구나 참여가능, 기초 체력 필요, 전문지식/자격/재능 활용
   - 사전 경험이나 체력 부담 없이 첫 참여자도 바로 할 수 있으면 '누구나 참여가능'.
   - 무거운 짐 나르기, 장시간 걷기 등 신체적 체력 소모가 있으면 '기초 체력 필요'.
   - 자격증, 전문 지식, 숙련된 기술이 필수적이면 '전문지식/자격/재능 활용' 중 단 하나를 선택하세요.

[출력 형식]
반드시 아래 JSON 스키마를 엄격히 준수하세요:
{
  "categories": ["노인", "교육"],
  "activity_types": ["실내 활동"],
  "target_groups": ["교류·교육·소통형"],
  "participation_modes": "10명 이내 소그룹",
  "skills": ["교육·멘토링", "컴퓨터·IT", "사진 촬영"],
  "keywords": ["키오스크", "스마트폰", "디지털교육", "어르신"],
  "difficulty": "누구나 참여가능"
}`;

async function classifyActionWithAI(action, itemDescriptions) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: JSON.stringify({
          제목: action.title,
          소개: action.description || action.title,
          카테고리: action.category,
          장소: action.address,
          모집항목: itemDescriptions,
        }),
      },
    ],
  });

  const raw = JSON.parse(completion.choices[0].message.content || '{}');

  const categories = Array.isArray(raw.categories)
    ? raw.categories.filter((c) => ALLOWED_CATEGORIES.includes(c))
    : [];

  const activity_types = Array.isArray(raw.activity_types)
    ? raw.activity_types.filter((t) => ALLOWED_ACTIVITY_TYPES.includes(t))
    : [];

  const target_groups = Array.isArray(raw.target_groups)
    ? raw.target_groups.filter((g) => ALLOWED_TARGET_GROUPS.includes(g))
    : [];

  const modes = Array.isArray(raw.participation_modes)
    ? raw.participation_modes
    : [raw.participation_modes].filter(Boolean);
  const participation_modes = modes.filter((m) =>
    ALLOWED_PARTICIPATION_MODES.includes(m),
  );

  const skills = Array.isArray(raw.skills)
    ? raw.skills.filter((s) => ALLOWED_SKILLS.includes(s))
    : [];

  const keywords = Array.isArray(raw.keywords)
    ? raw.keywords.filter((k) => typeof k === 'string' && k.trim().length > 0).slice(0, 5)
    : [];

  const difficulty = ALLOWED_DIFFICULTIES.includes(raw.difficulty)
    ? raw.difficulty
    : '누구나 참여가능';

  return {
    categories: categories.length > 0 ? categories : [action.category],
    activity_types: activity_types.length > 0 ? activity_types : ['실내외 병행'],
    target_groups: target_groups.length > 0 ? target_groups : ['교류·교육·소통형'],
    participation_modes: participation_modes.length > 0 ? participation_modes : ['10명 이내 소그룹'],
    skills,
    keywords: keywords.length > 0 ? keywords : action.title.split(' ').slice(0, 3),
    difficulty,
  };
}

async function processAction(action, total, index) {
  const { data: items } = await supabase
    .from('action_items')
    .select('type, name, condition_name, min_required, max_allowed')
    .eq('action_id', action.id);

  const itemDescriptions = (items ?? []).map((i) => {
    if (i.type === 'PERSON') {
      const quota =
        i.max_allowed && i.max_allowed !== i.min_required
          ? `${i.min_required}~${i.max_allowed}명`
          : i.min_required
            ? `${i.min_required}명`
            : '';
      return quota ? `${i.name} (${quota})` : i.name;
    }
    const quota = i.min_required ? `${i.min_required}개` : '';
    return quota ? `${i.name} (${quota})` : i.name;
  });

  try {
    const ai = await classifyActionWithAI(action, itemDescriptions);

    const { error: upsertError } = await supabase
      .from('action_ai_metadata')
      .upsert(
        {
          action_id: action.id,
          categories: ai.categories,
          activity_types: ai.activity_types,
          target_groups: ai.target_groups,
          participation_modes: ai.participation_modes,
          skills: ai.skills,
          keywords: ai.keywords,
          difficulty: ai.difficulty,
          ai_model: 'gpt-4o-mini',
          prompt_version: PROMPT_VERSION,
          owner_confirmed: true,
        },
        { onConflict: 'action_id' },
      );

    if (upsertError) {
      console.error(`[${index}/${total}] ❌ 저장 오류 (${action.title}):`, upsertError.message);
      return { success: false, title: action.title, error: upsertError.message };
    }

    console.log(
      `[${index}/${total}] ✅ [${action.category}] ${action.title} -> ` +
        `환경:${ai.activity_types.join(',')} | ` +
        `성격:${ai.target_groups.join(',')} | ` +
        `인원:${ai.participation_modes.join(',')} | ` +
        `재능:${ai.skills.length > 0 ? ai.skills.join(',') : '(없음)'} | ` +
        `문턱:${ai.difficulty}`,
    );

    return { success: true, title: action.title, actionId: action.id, ai };
  } catch (err) {
    console.error(`[${index}/${total}] ❌ AI 분석 실패 (${action.title}):`, err.message);
    return { success: false, title: action.title, error: err.message };
  }
}

async function main() {
  console.log('🚀 미분류/구버전 액션 전체 일괄 색인 (classify-v2) 시작...\n');

  const { data: actions, error } = await supabase
    .from('actions')
    .select('id, title, description, category, address')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('액션 조회 실패:', error);
    process.exit(1);
  }

  const { data: existingMeta } = await supabase
    .from('action_ai_metadata')
    .select('action_id, prompt_version');

  const metaMap = new Map((existingMeta || []).map((m) => [m.action_id, m.prompt_version]));
  const targetActions = actions.filter((a) => metaMap.get(a.id) !== PROMPT_VERSION);

  console.log(`총 액션: ${actions.length}개 / classify-v2 대상 액션: ${targetActions.length}개\n`);

  if (targetActions.length === 0) {
    console.log('이미 모든 액션이 classify-v2로 최신화되어 있습니다!');
  } else {
    // 병렬 5개 처리
    const CONCURRENCY = 5;
    const results = [];

    for (let i = 0; i < targetActions.length; i += CONCURRENCY) {
      const chunk = targetActions.slice(i, i + CONCURRENCY);
      const chunkPromises = chunk.map((action, chunkIdx) =>
        processAction(action, targetActions.length, i + chunkIdx + 1),
      );
      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;
    console.log(`\n✨ 일괄 재색인 완료! (성공: ${successCount}개 / 실패: ${failCount}개)`);
  }

  // 전체 액션의 메타데이터를 백업 JSON으로 저장하여 seed.mjs에서 쓸 수 있도록 함
  console.log('\n전체 action_ai_metadata를 JSON 파일로 백업 저장 중...');
  const { data: allMeta, error: metaErr } = await supabase
    .from('action_ai_metadata')
    .select('action_id, categories, activity_types, target_groups, participation_modes, skills, keywords, difficulty, prompt_version, actions(title)');

  if (metaErr) {
    console.error('메타데이터 백업 조회 실패:', metaErr);
  } else {
    const dataDir = path.resolve('scripts/data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const outPath = path.join(dataDir, 'action_ai_metadata_all.json');
    fs.writeFileSync(outPath, JSON.stringify(allMeta, null, 2), 'utf-8');
    console.log(`✅ 저장 완료: ${outPath} (총 ${allMeta.length}건)`);
  }
}

main();
