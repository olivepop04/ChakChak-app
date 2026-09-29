/**
 * AI 자동 분류 — 액션이 공개될 때 색인을 만든다.
 *
 * 왜 미리 만들어 두는가
 *   Discover 추천이 액션을 찾을 때마다 AI 를 부르면 느리고 비쌉니다.
 *   공개 시점에 한 번만 분류해서 action_ai_metadata 에 저장해 두고,
 *   추천은 그 색인을 검색합니다.
 *
 * 이 API 가 실패해도 액션 공개는 유지됩니다. 색인만 비는 것뿐입니다.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { callStructuredAI, AI_MODEL } from '@/lib/openai';
import { CATEGORIES, SKILLS } from '@/lib/constants';

const PROMPT_VERSION = 'classify-v3';

const ClassifySchema = z.object({
  categories: z.array(z.string()).default([]),
  activity_types: z.array(z.string()).default([]),
  target_groups: z.array(z.string()).default([]),
  participation_modes: z.union([z.string(), z.array(z.string())]).default([]),
  skills: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  difficulty: z.string().nullable().default(null),
});

const ALLOWED_ACTIVITY_TYPES = [
  '실내 활동',
  '실외 활동',
  '실내외 병행',
] as const;

const ALLOWED_TARGET_GROUPS = [
  '교류·교육·소통형',
  '육체·과업·집중형',
] as const;

const ALLOWED_PARTICIPATION_MODES = [
  '10명 이내 소그룹',
  '10~20명 중그룹',
  '20명 이상 대그룹',
] as const;

const ALLOWED_SKILLS = [...SKILLS, '기타'] as const;

const ALLOWED_DIFFICULTIES = [
  '누구나 참여가능',
  '기초 체력 필요',
  '전문지식/자격/재능 활용',
] as const;

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
   - 허용 목록: ${ALLOWED_SKILLS.join(', ')}
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

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const { actionId } = (await request.json()) as { actionId?: string };
  if (!actionId) {
    return NextResponse.json({ error: '액션을 찾을 수 없습니다.' }, { status: 400 });
  }

  const { data: action } = await supabase
    .from('actions')
    .select('id, owner_id, title, description, category, address, notice')
    .eq('id', actionId)
    .maybeSingle();

  if (!action || action.owner_id !== user.id) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  const { data: items } = await supabase
    .from('action_items')
    .select('type, name, condition_name, min_required, max_allowed')
    .eq('action_id', actionId);

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
    const ai = await callStructuredAI({
      agent: 'CLASSIFY',
      promptVersion: PROMPT_VERSION,
      system: SYSTEM,
      user: JSON.stringify({
        제목: action.title,
        소개: action.description,
        카테고리: action.category,
        장소: action.address,
        모집항목: itemDescriptions,
      }),
      schema: ClassifySchema,
      userId: user.id,
      actionId,
    });

    // AI 가 허용되지 않은 값을 반환할 경우를 대비하여 명세 체계에 맞춰 정제합니다
    const safeCategories = ai.categories.filter((c) =>
      (CATEGORIES as readonly string[]).includes(c),
    );
    const safeActivityTypes = ai.activity_types.filter((t) =>
      (ALLOWED_ACTIVITY_TYPES as readonly string[]).includes(t),
    );
    const safeTargetGroups = ai.target_groups.filter((g) =>
      (ALLOWED_TARGET_GROUPS as readonly string[]).includes(g),
    );
    const rawModes = Array.isArray(ai.participation_modes)
      ? ai.participation_modes
      : [ai.participation_modes].filter(Boolean);
    const safeModes = rawModes.filter((m) =>
      (ALLOWED_PARTICIPATION_MODES as readonly string[]).includes(m),
    );
    const safeSkills = ai.skills.filter((s) =>
      (ALLOWED_SKILLS as readonly string[]).includes(s),
    );
    const safeDifficulty =
      ai.difficulty && (ALLOWED_DIFFICULTIES as readonly string[]).includes(ai.difficulty)
        ? ai.difficulty
        : '누구나 참여가능';
    const safeKeywords = (ai.keywords ?? [])
      .filter((k) => typeof k === 'string' && k.trim().length > 0)
      .slice(0, 5);

    const { error: saveError } = await supabase.from('action_ai_metadata').upsert({
      action_id: actionId,
      categories: safeCategories.length > 0 ? safeCategories : [action.category],
      activity_types: safeActivityTypes.length > 0 ? safeActivityTypes : ['실내외 병행'],
      target_groups: safeTargetGroups.length > 0 ? safeTargetGroups : ['교류·교육·소통형'],
      participation_modes: safeModes.length > 0 ? safeModes : ['10명 이내 소그룹'],
      skills: safeSkills,
      keywords: safeKeywords.length > 0 ? safeKeywords : action.title.split(' ').slice(0, 3),
      difficulty: safeDifficulty,
      ai_model: AI_MODEL,
      prompt_version: PROMPT_VERSION,
      owner_confirmed: false,
    });

    if (saveError) {
      console.error('[classify] 색인 저장 실패:', saveError.message);
      return NextResponse.json(
        { ok: false, error: '색인 저장에 실패했어요.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    // 색인 실패는 공개를 막지 않습니다. 기본 색인으로 안전하게 채웁니다.
    await supabase.from('action_ai_metadata').upsert({
      action_id: actionId,
      categories: [action.category],
      activity_types: ['실내외 병행'],
      target_groups: ['교류·교육·소통형'],
      participation_modes: ['10명 이내 소그룹'],
      skills: [],
      keywords: action.title.split(' ').slice(0, 3),
      difficulty: '누구나 참여가능',
      ai_model: AI_MODEL,
      prompt_version: `${PROMPT_VERSION}-fallback`,
      owner_confirmed: false,
    });
    return NextResponse.json({ ok: true, fallback: true });
  }
}
