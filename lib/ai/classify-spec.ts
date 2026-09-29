/**
 * 액션 자동 분류의 규칙 — 한 곳에서만 정합니다 (민호 담당, 2026-09-29).
 *
 *   공개할 때 분류     app/api/ai/classify/route.ts
 *   한꺼번에 다시 분류  scripts/classify-core.mjs (reclassify_all_actions · batch_reclassify_active)
 *
 * 두 곳이 이 파일을 **같이 import** 합니다. 전에는 스크립트가 지시문을 복사해 들고 있어서
 * 지시문은 v3 인데 이름표는 v2 였고, 답 검사(zod)도 빠져 있었습니다.
 *
 * ⚠️ 이 파일은 node 스크립트도 바로 읽습니다. 그래서 값을 `@/` 로 가져오면 안 되고
 *    (스크립트에서 깨집니다) 상대 경로에 `.ts` 를 붙입니다 — lib/utils/scoring.ts 와 같은 방식.
 *    enum 같은 「지워지지 않는 TypeScript 문법」 도 쓰지 마세요 (node 가 타입만 지우고 돌립니다).
 *
 * 지시문을 고치면 PROMPT_VERSION 을 올리세요 (CLAUDE.md 「AI 프롬프트를 고칠 때」).
 */
import { z } from 'zod';
import { CATEGORIES, SKILLS } from '../constants/index.ts';

export const CLASSIFY_PROMPT_VERSION = 'classify-v4';

/** 스크립트용. 앱은 lib/openai.ts 의 AI_MODEL · TEMPERATURE.CLASSIFY 를 씁니다 — 테스트가 같은지 봅니다 */
export const CLASSIFY_MODEL = 'gpt-4o-mini';
export const CLASSIFY_TEMPERATURE = 0.2;
export const CLASSIFY_MAX_TOKENS = 1000;

export const ClassifySchema = z.object({
  categories: z.array(z.string()).default([]),
  activity_types: z.array(z.string()).default([]),
  target_groups: z.array(z.string()).default([]),
  participation_modes: z.union([z.string(), z.array(z.string())]).default([]),
  skills: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  difficulty: z.string().nullable().default(null),
});
export type ClassifyAnswer = z.infer<typeof ClassifySchema>;

export const ALLOWED_CATEGORIES: readonly string[] = CATEGORIES;
export const ALLOWED_ACTIVITY_TYPES = ['실내 활동', '실외 활동', '실내외 병행'] as const;
export const ALLOWED_TARGET_GROUPS = ['교류·교육·소통형', '육체·과업·집중형'] as const;
export const ALLOWED_PARTICIPATION_MODES = [
  '10명 이내 소그룹',
  '10~20명 중그룹',
  '20명 이상 대그룹',
] as const;
export const ALLOWED_SKILLS = [...SKILLS, '기타'] as const;
export const ALLOWED_DIFFICULTIES = [
  '누구나 참여가능',
  '기초 체력 필요',
  '전문지식/자격/재능 활용',
] as const;

/**
 * Discover 대화 인터뷰 선택지 칩 표준 목록 — 단일 소스 원칙 (2026-09-29)
 * app/api/ai/discover/interview.ts 와 분류 색인이 같은 기준을 공유합니다.
 */
export const DISCOVER_ACTIVITY_TYPE_OPTIONS = [
  '실내 활동',
  '실외 활동',
  '상관없음',
] as const;
export const DISCOVER_TARGET_GROUP_OPTIONS = [
  ...ALLOWED_TARGET_GROUPS,
  '상관없음',
] as const;
export const DISCOVER_DIFFICULTY_OPTIONS = [
  ...ALLOWED_DIFFICULTIES,
  '상관없음',
] as const;
export const DISCOVER_PARTICIPATION_MODE_OPTIONS = [
  ...ALLOWED_PARTICIPATION_MODES,
  '상관없음',
] as const;

export const CLASSIFY_SYSTEM = `당신은 선한 영향력 SNS '착착'의 액션 전문 분석 AI 에이전트입니다.
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
     (※ 주의: 가정 방문, 이동, 차 마시기, 안부 묻기, 혈압 체크 등 일상적 돌봄과 대화가 본질인 활동은 육체 노동이 아니므로 절대 '육체·과업·집중형'으로 잘못 분류하지 마세요.)
   - 작업, 땀 흘리기, 육체적 활동, 구체적인 결과물 완성이 중심이면 '육체·과업·집중형'을 선택하세요 (예: 플로깅, 연탄배달, 도시락포장, 시설청소, 이사지원 등).
   - ★ [복합 성격 의무 다중 태깅]: 대화/정서적 교류와 실질적 육체 작업이 30% 이상 공존하거나(예: 어르신과 산책하며 말벗, 멘토와 텃밭 가꾸기 등), 모집 항목에 소통형(사무보조/안내)과 육체형(청소/설치) 역할이 분리·공존하는 경우, 어느 한쪽만 선택하여 참여 기회를 차단하지 말고 반드시 ['교류·교육·소통형', '육체·과업·집중형'] 2가지 모두를 배열에 복수로 태깅하세요.

4. participation_modes (모임 인원 규모):
   - 허용 목록: 10명 이내 소그룹, 10~20명 중그룹, 20명 이상 대그룹
   - 모집 항목에 적힌 사람 인원수를 모두 합산하여 해당하는 규모 단 하나만 선택하세요. (인원수가 명시되지 않은 경우 본문 맥락에 따름)

5. skills (이 액션에서 실제로 활용할 수 있는 재능):
   - 허용 목록: ${ALLOWED_SKILLS.join(', ')}
   - "잠재적으로 아무 도움이나 될 수 있는 재능"까지 무분별하게 넣지 마세요.
   - 모집 항목에 명시된 필수 역할/재능이거나, 본문 소개글에 명확한 근거가 있어 활동 수행에 실질적으로 도움이 되는 경우만 정밀하게 선택하세요.
   - 여러 모집 항목(예: 조리담당, 운전담당, 청소담당 등)이 있는 경우 각 항목에서 요구되는 재능을 빠짐없이 태깅하세요.
   - 본문에 뚜렷한 근거가 없거나 누구나 할 수 있는 일반 활동인 경우 빈 배열 []로 두세요.

6. keywords (핵심 검색 키워드):
   - 검색 및 시맨틱 매칭에 활용할 가장 핵심적인 고유 명사 3~5개를 배열로 추출하세요.
   - '봉사', '모집', '활동' 같은 지나치게 일반적인 단어는 제외하고, 구체적인 활동 대상, 도구, 장소, 주제어를 추출하세요 (예: ["키오스크", "스마트폰", "디지털교육", "어르신"]).

7. difficulty (참여 문턱 및 요구 수준):
   - 허용 목록: 누구나 참여가능, 기초 체력 필요, 전문지식/자격/재능 활용
   - 사전 경험이나 체력 부담 없이 첫 참여자도 바로 할 수 있으면 '누구나 참여가능'.
   - 무거운 짐 나르기, 장시간 걷기 등 신체적 체력 소모가 있으면 '기초 체력 필요'.
   - 자격증, 전문 지식, 숙련된 기술이 필수적이면 '전문지식/자격/재능 활용' 중 단 하나를 선택하세요.
   - ★ [복합 모집 항목 최저 허들 기준]: 전문 자격/기술을 요하는 파트(예: 조리사, 훈련사)와 일반 참여 파트(예: 청소, 안내 보조)가 공존하는 액션의 경우, 대표 난이도는 진입 장벽이 가장 낮은 일반 파트 기준(최저 허들: '누구나 참여가능' 또는 '기초 체력 필요')으로 부여하세요. 소수 전문 파트 때문에 액션 전체를 '전문지식/자격/재능 활용'으로 분류하면 일반 초보 참여자의 진입이 차단됩니다. (전문 역할은 5번 skills에 오픈하여 재능 보유자 매칭에 활용)

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

export interface ClassifyItem {
  type: string;
  name: string;
  min_required: number | null;
  max_allowed: number | null;
}

export interface ClassifyAction {
  title: string;
  description: string | null;
  category: string;
  address: string | null;
}

/** 모집 항목을 AI 에 넘길 문장으로 — 「조리 (4~6명)」 · 「도시락통 (50개)」 */
export function describeItems(items: readonly ClassifyItem[] | null | undefined): string[] {
  return (items ?? []).map((i) => {
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
}

/** AI 에게 보내는 사용자 메시지 */
export function buildClassifyUser(
  action: ClassifyAction,
  items: readonly ClassifyItem[] | null | undefined,
): string {
  return JSON.stringify({
    제목: action.title,
    소개: action.description,
    카테고리: action.category,
    장소: action.address,
    모집항목: describeItems(items),
  });
}

/**
 * 스키마는 통과했는데 **내용이 하나도 없는** 답인가.
 * AI 가 키를 한 겹 감싸서 답하면({"result":{...}}) 스키마 기본값 때문에 빈 답이 통과합니다.
 * 그걸 저장하면 기본값뿐인 색인이 「제대로 분류됨」 으로 남아 다시 잡히지 않습니다.
 */
export function isEmptyClassification(ai: ClassifyAnswer): boolean {
  const modes = Array.isArray(ai.participation_modes)
    ? ai.participation_modes
    : [ai.participation_modes].filter(Boolean);
  return (
    ai.categories.length === 0 &&
    ai.activity_types.length === 0 &&
    ai.target_groups.length === 0 &&
    modes.length === 0 &&
    ai.skills.length === 0 &&
    ai.keywords.length === 0 &&
    !ai.difficulty
  );
}

export interface ClassifyMeta {
  categories: string[];
  activity_types: string[];
  target_groups: string[];
  participation_modes: string[];
  skills: string[];
  keywords: string[];
  difficulty: string;
}

const pick = (values: readonly string[], allowed: readonly string[]) =>
  values.filter((v) => allowed.includes(v));

/** AI 답(스키마 통과)을 허용 목록으로 걸러 저장할 모양으로. 빈 칸은 기본값 */
export function sanitizeClassification(ai: ClassifyAnswer, action: Pick<ClassifyAction, 'title' | 'category'>): ClassifyMeta {
  const categories = pick(ai.categories, ALLOWED_CATEGORIES);
  const activityTypes = pick(ai.activity_types, ALLOWED_ACTIVITY_TYPES);
  const targetGroups = pick(ai.target_groups, ALLOWED_TARGET_GROUPS);
  const rawModes = Array.isArray(ai.participation_modes)
    ? ai.participation_modes
    : [ai.participation_modes].filter(Boolean);
  const modes = pick(rawModes, ALLOWED_PARTICIPATION_MODES);
  const skills = pick(ai.skills, ALLOWED_SKILLS);
  const keywords = ai.keywords.filter((k) => k.trim().length > 0).slice(0, 5);
  const difficulty =
    ai.difficulty && (ALLOWED_DIFFICULTIES as readonly string[]).includes(ai.difficulty)
      ? ai.difficulty
      : '누구나 참여가능';

  return {
    categories: categories.length > 0 ? categories : [action.category],
    activity_types: activityTypes.length > 0 ? activityTypes : ['실내외 병행'],
    target_groups: targetGroups.length > 0 ? targetGroups : ['교류·교육·소통형'],
    participation_modes: modes.length > 0 ? modes : ['10명 이내 소그룹'],
    skills,
    keywords: keywords.length > 0 ? keywords : action.title.split(' ').slice(0, 3),
    difficulty,
  };
}

/** AI 가 실패했을 때 넣는 기본 색인 — 이름표는 `${CLASSIFY_PROMPT_VERSION}-fallback` */
export function fallbackClassification(action: Pick<ClassifyAction, 'title' | 'category'>): ClassifyMeta {
  return {
    categories: [action.category],
    activity_types: ['실내외 병행'],
    target_groups: ['교류·교육·소통형'],
    participation_modes: ['10명 이내 소그룹'],
    skills: [],
    keywords: action.title.split(' ').slice(0, 3),
    difficulty: '누구나 참여가능',
  };
}

/**
 * 아직 제대로 분류 안 된 색인인가 — 이유를 돌려줍니다. 됐으면 null.
 *   없음 · 시드 기본값(ai_model 'seed') · AI 실패 기본값(…-fallback) 은 「아직」
 *   판이 옛것(classify-v2)이어도 AI 가 분류한 것이면 「됐음」
 */
export function classificationGap(
  meta: { ai_model?: string | null; prompt_version?: string | null } | null | undefined,
): string | null {
  if (!meta) return '색인 없음';
  if (meta.ai_model === 'seed') return '시드 기본값';
  if (String(meta.prompt_version ?? '').endsWith('-fallback')) return 'AI 실패 기본값';
  return null;
}
