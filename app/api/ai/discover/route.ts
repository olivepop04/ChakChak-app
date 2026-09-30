/**
 * AI Agent #3 — 대화형 맞춤 추천.
 *
 * AI가 하는 일
 *   1) 다섯 답변에서 허용된 추천 조건만 뽑는다
 *   2) 코드가 고른 후보를 설명하는 이유를 쓴다
 *
 * 코드가 하는 일
 *   1) 사용자 선택에 맞춰 다섯 질문과 자연스러운 연결 문장을 고른다
 *   2) 마감·내 액션·이미 참여한 액션을 제외한다
 *   3) 지역과 카테고리를 단계적으로 완화한다
 *   4) 고정 점수로 상위 3개를 고른다
 *
 * AI가 실패해도 고정 질문과 코드 추천은 계속 동작합니다.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { callStructuredAI } from '@/lib/openai';
import { getRecommendCandidates, getMyCreatedActions } from '@/lib/queries/actions';
import {
  getFollowing,
  getParticipatedActions,
  getProfile,
} from '@/lib/queries/profiles';
import {
  rankActions,
  scoreAction,
  fallbackReason,
  type ScoringProfile,
  type ActionScoringMetadata,
  type ScoringAnswers,
  type ScoredAction,
} from '@/lib/utils/scoring';
import { sameProvince, totalGroupSize } from '@/lib/utils/discover-ranking';
import {
  extractRegionFromText,
  getQuestionOptions,
  getQuestionReply,
  getRecommendationReply,
  getRemainingQuestionKeys,
  shouldRecommendNow,
  analyzeUserContext,
  validateHarmfulSkillInput,
  formatSummaryChips,
  resolveUnifiedCategories,
  ALL_15_SKILLS,
  CHEERING_OR_CASUAL_REGEX,
  type QuestionKey,
  type UserStateCategory,
  type AdaptiveAnswers,
} from '@/app/api/ai/discover/interview';
import { CATEGORIES, SKILLS, type Category } from '@/lib/constants';
import { matchesRegion, NATIONWIDE } from '@/lib/constants/regions';
import { isWeekend } from '@/lib/utils/date';
import type { ActionCardData } from '@/lib/types/view';

const CHAT_PROMPT_VERSION = 'discover-chat-v12-no-double-ack';
const RECOMMEND_PROMPT_VERSION = 'discover-recommend-v14-category-guard';
const MAX_USER_TURNS = 15;
const PARTICIPATION_MODES = [
  '시간을 내서',
  '물건으로',
  '직접 행동으로',
  '내 재능으로',
] as const;

const ChatMessageSchema = z.object({
  role: z.enum(['assistant', 'user']),
  content: z.string().trim().min(1).max(300),
});

const ChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).max(MAX_USER_TURNS * 2).default([]),
});

/**
 * 다음 질문 축은 getRemainingQuestionKeys() 가 이미 결정한다 (interview.ts, 수정하지 않음).
 * AI 에게는 축 선택도 질문 문구도 맡기지 않는다 — 직전 답변에 대한 짧은 공감 한 줄만 받는다.
 * 질문 본문·선택지는 항상 getQuestionReply()/getQuestionOptions() 템플릿을 쓴다.
 */
const AcknowledgmentSchema = z.object({
  acknowledgment: z.string().trim().max(200).catch('').default(''),
});

const RecommendationSchema = z.object({
  topActionIds: z.array(z.string()).max(3).default([]),
  reasons: z.record(z.string(), z.string()).catch({}).default({}),
});

type ChatMessage = z.infer<typeof ChatMessageSchema>;

const CHAT_SYSTEM = `당신은 선한 영향력 SNS '착착'의 액션 추천 전문 AI 에이전트 '착착 Discover'입니다.
모든 사용자는 로그인된 정회원입니다.
반드시 JSON 형식으로만 답하세요.

[당신이 할 일 — 딱 하나]
다음 질문은 시스템이 이미 정해서 화면에 별도로 보여줍니다. 당신은 사용자의 직전 답변에 대한
짧은 공감·확인 한 줄(acknowledgment)만 씁니다. 질문을 새로 하지 마세요. 선택지를 언급하거나
나열하지 마세요. 굳이 덧붙일 말이 없으면 빈 문자열("")을 반환해도 됩니다.

[절대 규칙]
1. 영어 'Action'을 쓰지 말고 반드시 한글 '액션'으로 표기하세요.
2. '봉사', '봉사활동', '봉사자', '수혜자' 단어를 쓰지 마세요. (나눔, 함께하기, 활동, 크루 등으로 순화)
3. 없는 사실이나 사용자 정보를 추측하거나 지어내지 마세요 (재능, 최근 방문 여부, 과거 활동에 대한
   사적인 감상 등). 프로필에 재능이 없는 사용자에게 "재능이 있다"고 말하지 마세요.
4. 지역·시간대·실내외·인원 규모 같은 물리적/객관적 조건 선택에는 "정말 좋은 선택이에요!" 같은
   상투적 칭찬을 하지 말고, 담백하게 접수하는 한 줄만 쓰세요.
     - 좋은 예: "서울특별시 지역으로 찾아볼게요. 📍", "주말 시간대로 체크해둘게요. ⏰"
     - 나쁜 예: "서울특별시에서 활동하신다니 정말 좋은 선택이에요! 😊"
5. 분야·활동 분위기 같은 주관적 성향에는 자연스러운 공감을 짧게 담아도 됩니다.
     - 예: "동물들과 교감하는 시간을 좋아하시는군요! 🐾"
6. '이제', '자 그럼', '보통' 같은 번역투 접두사를 쓰지 마세요.
7. 당신의 한 줄 뒤에는 시스템이 정한 다음 질문이 곧바로 이어 붙습니다. 그 질문 문구가
   이미 방금 답변을 언급하며 시작할 수도 있습니다(예: 재능을 고른 직후 "알려주신 재능을
   살릴 수 있는 액션으로 찾아볼게요!"로 시작하는 질문). 같은 내용을 당신이 또 한 번
   말하면 앞뒤로 두 번 반복하는 것처럼 보이니, 짧고 담백하게만 접수하세요. 무슨 말을
   덧붙여야 할지 애매하면 망설이지 말고 빈 문자열("")을 반환하세요.

[응답 형식 (반드시 JSON)]
{"acknowledgment":"직전 답변에 대한 담백한 확인/공감 한 줄, 또는 빈 문자열"}`;

const RECOMMEND_SYSTEM = `당신은 선한 영향력 SNS '착착'의 액션 추천 전문 AI 에이전트입니다.
프로젝트의 '콘텐츠 자동 분류·색인 시스템'에 의해 생성된 각 액션의 7대 AI 색인 메타데이터와 사용자의 대화 및 성향을 비교하여 가장 부합하는 최적의 액션 3개를 선정합니다.
반드시 JSON 형식으로만 답하세요.

핵심 규칙:
1. 영어 'Action' 단어를 절대 쓰지 말고 한글 '액션'으로 표현하세요. '봉사', '봉사활동', '봉사자', '수혜자' 단어를 일체 사용하지 마세요.
2. 주어진 후보 목록의 actionId 중에서만 topActionIds로 최대 3개를 선정하세요.
3. 없는 사실이나 사용자가 말하지 않은 취향을 추측하거나 지어내지 마세요.

형식:
{"topActionIds":["actionId1", "actionId2", "actionId3"]}`;

function extractSkillsAnswer(messages: ChatMessage[]): string[] | null {
  const userText = messages
    .filter((message) => message.role === 'user')
    .map((message) => message.content)
    .join(' ');

  if (userText.includes('재능 없음')) return [];
  if (userText.includes('아직 모르겠음')) return null;

  const cleanText = userText
    .replace(/교류·교육·소통형/g, '')
    .replace(/전문지식\/자격\/재능 활용/g, '');

  const selected = ALL_15_SKILLS.filter((skill) => {
    if (skill === '기타') return false;
    const words = skill.split(/[·\s]+/).filter((word) => word.length >= 2);
    return words.some((word) => cleanText.includes(word));
  });
  return selected.length > 0 ? [...selected] : null;
}

/**
 * 대화에서 명시적으로 뽑히지 않은 관심 분야·참여 방식을 자유 텍스트에서 보조로 추정한다.
 * adaptiveAnswers(interview.ts)가 못 잡은 경우에만 쓰이는 마지막 보조 수단이다.
 */
function deriveConditionsFromText({
  messages,
  fieldReferenceCategories,
  profileCategories,
}: {
  messages: ChatMessage[];
  fieldReferenceCategories: Category[];
  profileCategories: string[];
}): {
  categories: string[];
  participationMode: (typeof PARTICIPATION_MODES)[number] | null;
} {
  const userText = messages
    .filter((message) => message.role === 'user')
    .map((message) => message.content)
    .join(' ');

  const mentionedCategories = CATEGORIES.filter((category) =>
    userText.includes(category),
  );
  let categories: string[] = mentionedCategories;
  if (categories.length === 0 && userText.includes('비슷')) {
    categories = fieldReferenceCategories;
  } else if (categories.length === 0 && userText.includes('새로운')) {
    categories = CATEGORIES.filter(
      (category) => !fieldReferenceCategories.includes(category),
    );
  } else if (categories.length === 0) {
    categories = profileCategories.filter((category) => category !== '전체');
  }

  let participationMode: (typeof PARTICIPATION_MODES)[number] | null = null;
  if (userText.includes('물품') || userText.includes('물건')) {
    participationMode = '물건으로';
  } else if (userText.includes('몸') || userText.includes('움직')) {
    participationMode = '직접 행동으로';
  } else if (userText.includes('시간')) {
    participationMode = '시간을 내서';
  } else if (/재능.*활용|내 재능으로/.test(userText)) {
    participationMode = '내 재능으로';
  }

  return { categories, participationMode };
}

type ReplayContext = {
  userState: UserStateCategory;
  hasRegionAndTime: boolean;
  hasHistory: boolean;
  profileSkills: readonly string[];
};

/**
 * 사용자 답변 하나하나가 "어느 질문 축에 대한 답인지"를 추측하지 않고 확정적으로 계산한다.
 *
 * 예전에는 AI가 만든 질문 문구(공감 한 줄 포함)를 정규식으로 훑어서 "이게 시간 질문에
 * 대한 답인가? 카테고리 질문에 대한 답인가?"를 추측했다. 그런데 공감 문장이 직전 축의
 * 내용을 되짚어 말하다 보니(예: "시간에 구애받지 않으신다니 좋습니다") 그 안에 든 단어가
 * 전혀 다른 축의 판정 키워드와 겹쳐서, 이미 답한 카테고리 질문이 통째로 다시 나오는 등의
 * 버그가 반복됐다 (2026-09-30, 팀 테스트 피드백).
 *
 * 다음 질문 축이 항상 getRemainingQuestionKeys() 로 결정되는 것과 같은 이유로,
 * "직전 답변이 어느 축의 답인지"도 추측할 필요가 없다 — i번째 사용자 답변은 항상
 * "그 답이 나오기 직전까지의 답변만으로 계산한 getRemainingQuestionKeys() 의
 * 첫 번째 축"에 대한 답이다. 순서대로 재생하면 매번 확정적으로 알 수 있다.
 */
function replayAnswers(
  userAnswerTexts: readonly string[],
  ctx: ReplayContext,
): { answers: AdaptiveAnswers; axisPerTurn: QuestionKey[] } {
  let answers: AdaptiveAnswers = {};
  const axisPerTurn: QuestionKey[] = [];

  for (let i = 0; i < userAnswerTexts.length; i++) {
    const axis: QuestionKey =
      i === 0
        ? 'opening'
        : (getRemainingQuestionKeys({ answers, ...ctx })[0] ?? 'categories');
    axisPerTurn.push(axis);
    answers = interpretAnswerForAxis(axis, userAnswerTexts[i], answers, ctx);
  }

  return { answers, axisPerTurn };
}

/**
 * 축이 이미 확정된 상태에서 답변 텍스트 하나를 해석한다. 어느 축인지 확신하고 시작하므로
 * 다른 축과 헷갈릴 여지가 없다 — "지금 이 질문을 묻고 있나?"를 되짚어 추측하는 정규식이
 * 필요 없다. 버튼 기반 UI라 각 축의 답은 정해진 몇 개 문자열(또는 그 조합) 중 하나뿐이다.
 */
function interpretAnswerForAxis(
  axis: QuestionKey,
  a: string,
  prev: AdaptiveAnswers,
  ctx: ReplayContext,
): AdaptiveAnswers {
  const next: AdaptiveAnswers = { ...prev };

  switch (axis) {
    case 'opening': {
      if (ctx.hasRegionAndTime) {
        next.openingDecision = /다른 조건/.test(a) ? 'change' : 'confirm';
      } else {
        next.openingDecision = 'change';
        const region = extractRegionFromText(a);
        if (region.selectedRegion) next.selectedRegion = region.selectedRegion;
        if (region.travelRange) next.travelRange = region.travelRange;
      }
      break;
    }

    case 'travel_range': {
      const region = extractRegionFromText(a);
      if (region.selectedRegion) next.selectedRegion = region.selectedRegion;
      if (region.travelRange) next.travelRange = region.travelRange;
      break;
    }

    case 'time_pref': {
      const prefs = new Set<string>();
      if (/상관없/.test(a)) prefs.add('시간 상관없음');
      if (/주말 오전/.test(a)) prefs.add('주말 오전');
      if (/주말 오후/.test(a)) prefs.add('주말 오후');
      if (/평일 낮/.test(a)) prefs.add('평일 낮');
      if (/평일 저녁/.test(a)) prefs.add('평일 저녁');
      next.timePreferences = prefs.size > 0 ? Array.from(prefs) : ['시간 상관없음'];
      break;
    }

    case 'categories':
    case 'field_preference': {
      if (/상관없/.test(a)) {
        next.fieldPreference = 'any';
        next.selectedCategory = '상관없음';
        next.selectedCategories = ['상관없음'];
      } else if (/같은 분야|네,\s*이 분야로|이 분야로/.test(a)) {
        next.fieldPreference = 'familiar';
      } else if (/새로운|다른 분야/.test(a)) {
        next.fieldPreference = 'new';
      } else {
        const matched = CATEGORIES.filter((c) => a.includes(c));
        if (matched.length > 0) {
          next.selectedCategories = matched;
          next.selectedCategory = matched[0];
          next.fieldPreference = 'selected';
        }
      }
      break;
    }

    case 'target_groups':
    case 'vibe_preference': {
      if (/상관없/.test(a)) next.vibePreference = 'any';
      else if (/교류|소통/.test(a)) next.vibePreference = 'social';
      else if (/과업|육체|집중/.test(a)) next.vibePreference = 'task';
      break;
    }

    case 'difficulty': {
      if (/상관없/.test(a)) next.difficultyPreference = 'any';
      else if (/누구나/.test(a)) next.difficultyPreference = 'easy';
      else if (/기초 체력/.test(a)) next.difficultyPreference = 'physical';
      else if (/전문지식/.test(a)) next.difficultyPreference = 'expert';
      break;
    }

    case 'skills': {
      if (/그대로|프로필|예.*그럴|그럴게/.test(a)) {
        next.selectedSkill = 'profile';
        next.selectedSkills = [...ctx.profileSkills];
        next.talentPreference = 'use';
      } else if (/다른 재능|새로운 재능/.test(a)) {
        next.talentPreference = 'new_skill';
      } else {
        const matched = ALL_15_SKILLS.filter((s) => s !== '기타' && a.includes(s));
        if (matched.length > 0) {
          next.selectedSkill = matched[0];
          next.selectedSkills = matched;
          next.talentPreference = 'use';
        } else if (a.includes('기타')) {
          next.selectedSkill = '기타';
          next.selectedSkills = ['기타'];
          next.talentPreference = 'any';
        } else if (/상관없|부담 없/.test(a)) {
          next.talentPreference = 'any';
        }
      }
      break;
    }

    case 'activity_type':
    case 'activity_types': {
      if (/상관없/.test(a)) next.activityType = 'any';
      else if (/병행/.test(a)) next.activityType = 'both';
      else if (/실내/.test(a)) next.activityType = 'indoor';
      else if (/실외|야외/.test(a)) next.activityType = 'outdoor';
      break;
    }

    case 'group_size':
    case 'participation_modes': {
      if (/상관없/.test(a)) next.groupSizePreference = 'any';
      else if (/소규모|10명 안팎|10명 이내|소그룹/.test(a)) next.groupSizePreference = 'small';
      else if (/중규모|10-20|10~20|중그룹/.test(a)) next.groupSizePreference = 'medium';
      else if (/대규모|20명 이상|대그룹/.test(a)) next.groupSizePreference = 'large';
      break;
    }

    default:
      break;
  }

  return next;
}

function allowedCategories(values: string[]): Category[] {
  return values.filter((value): value is Category =>
    (CATEGORIES as readonly string[]).includes(value),
  );
}

function filterRecommendationReason({
  reason,
  item,
  meta,
  userSelectedSkills = [],
  scoringAnswers,
  mismatchNotes = [],
  positiveHighlights = [],
}: {
  reason: string;
  item: ScoredAction;
  meta?: {
    activity_types?: string[];
    target_groups?: string[];
    skills?: string[];
  } | null;
  userSelectedSkills?: string[];
  scoringAnswers: ScoringAnswers;
  /** buildMismatchNotes()가 미리 골라준, 정직하게 언급해도 되는 불일치 사실 (없으면 날조 검증을 그대로 적용) */
  mismatchNotes?: string[];
  /** buildPositiveHighlights()가 미리 골라준, 실제로 사용자와 매칭된 사실 (카테고리 날조 검증에 씀) */
  positiveHighlights?: string[];
}): string {
  let cleaned = reason.trim();
  if (!cleaned) return fallbackReason(item);

  const targetGroups = meta?.target_groups ?? [];
  const isSocial = targetGroups.some((g: string) => /교류|교육|소통/.test(g));
  const isTask = targetGroups.some((g: string) => /과업|육체|집중/.test(g));
  const matchedSkills = (meta?.skills ?? []).filter((s: string) => userSelectedSkills.includes(s));
  const actTypes = meta?.activity_types ?? [];
  const isIndoorOnly =
    actTypes.length > 0 &&
    actTypes.every(
      (t: string) => t.includes('실내') && !t.includes('실외') && !t.includes('야외') && !t.includes('병행'),
    );
  const isOutdoorOnly =
    actTypes.length > 0 &&
    actTypes.every(
      (t: string) =>
        (t.includes('실외') || t.includes('야외')) &&
        !t.includes('실내') &&
        !t.includes('병행'),
    );

  const userTimes = scoringAnswers.userTimePreferences ?? [];
  const userWantsWeekendOnly =
    userTimes.length > 0 &&
    userTimes.every((t) => t.includes('주말')) &&
    !userTimes.includes('시간 상관없음');
  const userWantsWeekdayOnly =
    userTimes.length > 0 &&
    userTimes.every((t) => t.includes('평일')) &&
    !userTimes.includes('시간 상관없음');

  // 1) '육체적인 재능', '집중적인 재능' 같은 해괴한 합성어 감지 시 fallbackReason으로 대체
  if (/육체적.*재능|집중적.*재능/.test(cleaned)) {
    return fallbackReason(item);
  }

  // 2) 순수 소통형 액션인데 '육체적', '몸 쓰는' 단어가 들어간 거짓말 감지 시 fallbackReason으로 대체
  if (isSocial && !isTask && /육체|몸\s*쓰는|땀\s*흘리는/.test(cleaned)) {
    return fallbackReason(item);
  }

  // 3) 액션 환경(실내/실외) 왜곡 및 날조 감지 — 단, mismatchNotes에 이미 담긴 정직한 환경
  // 불일치 언급은 예외로 허용한다 (7번과 같은 이유, 2026-09-30).
  const hasEnvironmentMismatchNote = mismatchNotes.some((n) => n.includes('활동과는 달라요'));
  if (!hasEnvironmentMismatchNote) {
    // - 순수 실내 활동인데 '실외', '야외', '밖에서' 또는 '땀 흘리며'가 들어간 경우
    if (isIndoorOnly && /실외|야외|밖에서|땀\s*흘리/.test(cleaned)) {
      return fallbackReason(item);
    }
    // - 순수 실외 활동인데 '실내'가 들어간 경우
    if (isOutdoorOnly && /실내/.test(cleaned)) {
      return fallbackReason(item);
    }
  }

  // 4) 사용자가 선택하지 않은 다른 재능을 사용자가 발휘한다고 날조한 경우 감지 시 fallbackReason으로 대체
  if (userSelectedSkills.length > 0 && matchedSkills.length === 0) {
    const unownedSkills = ALL_15_SKILLS.filter((s) => !userSelectedSkills.includes(s) && s !== '기타');
    const hasUnownedSkillMention = unownedSkills.some((s) => cleaned.includes(s) && cleaned.includes('재능'));
    if (hasUnownedSkillMention || /재능을\s*(활용|발휘|살려)/.test(cleaned)) {
      return fallbackReason(item);
    }
  }

  // 5) 사용자 희망 시간대와 액션 실제 일정 불일치 시 '시간도 잘 맞을 것' 등 억지 칭찬/날조 감지
  if (item.action.activityStartAt) {
    const isWk = isWeekend(item.action.activityStartAt);
    // 사용자는 주말만 원했는데 액션은 평일인 경우
    if (userWantsWeekendOnly && !isWk) {
      if (/(평일|시간|오전|오후|저녁).*(잘\s*맞|좋|편하|어울|딱)/.test(cleaned)) {
        return fallbackReason(item);
      }
    }
    // 사용자는 평일만 원했는데 액션은 주말인 경우
    if (userWantsWeekdayOnly && isWk) {
      if (/(주말|시간|오전|오후|저녁).*(잘\s*맞|좋|편하|어울|딱)/.test(cleaned)) {
        return fallbackReason(item);
      }
    }
  }

  // 6) 사용자가 활동 환경을 '상관없음'으로 선택했거나 환경 제약이 없는 경우, 불필요한 변명 멘트 제거
  if (scoringAnswers.activityTypePreference === 'any' || !scoringAnswers.activityTypePreference) {
    cleaned = cleaned
      .replace(/(실내|야외|실외)에서\s*진행되지만,?\s*/g, '')
      .replace(/원하시던\s*(실내|실외|야외)[^,]*아니지만,?\s*/g, '')
      .replace(/비록\s*(실내|실외|야외)[^,]*지만,?\s*/g, '')
      .trim();
  }

  // 7) 일정 사실 날조 검증 — 단, mismatchNotes에 이미 담긴 정직한 시간대 불일치 언급은 예외로 허용한다.
  // (2026-09-30: 오프너-불일치-클로징 구조를 도입하면서, buildMismatchNotes()가 미리 승인한
  // "평일에 진행되어 희망하신 주말과는 다르지만" 같은 정직한 문장까지 이 검사가 날조로 오판해서
  // 통째로 fallbackReason으로 갈아치우는 문제가 있었다. 거짓 긍정 포장은 5)번이 이미 따로 막는다.)
  const hasTimeMismatchNote = mismatchNotes.some((n) => n.includes('시간대'));
  if (!hasTimeMismatchNote) {
    if (item.action.activityStartAt) {
      const isWk = isWeekend(item.action.activityStartAt);
      // 평일 액션인데 주말을 지어낸 경우
      if (!isWk && (cleaned.includes('주말') || cleaned.includes('토요일') || cleaned.includes('일요일'))) {
        return fallbackReason(item);
      }
      // 주말 액션인데 평일을 지어낸 경우
      if (isWk && (cleaned.includes('평일') || /월요일|화요일|수요일|목요일|금요일/.test(cleaned))) {
        return fallbackReason(item);
      }
    } else {
      // 일정이 미정인 액션인데 특정 요일/주말을 지어낸 경우
      if (cleaned.includes('주말') || cleaned.includes('평일') || /월요일|화요일|수요일|목요일|금요일|토요일|일요일/.test(cleaned)) {
        return fallbackReason(item);
      }
    }
  }

  // 8) 카테고리 날조 검증 — positiveHighlights에 실제로 매칭된 카테고리가 없는데
  // "관심있어 하는 OO 분야"처럼 사용자 관심사와 엮어 서술하는 경우 감지한다.
  // (2026-09-30, 팀 테스트 피드백: 사용자가 카테고리를 '상관없음'으로 골랐는데도, AI가
  // 액션 제목에 있는 단어("청소년 연극 캠프"의 "청소년")를 보고 "관심있어 하는 아동·청소년
  // 분야"라고 지어낸 사례. positiveHighlights에 카테고리 항목이 없다는 건 코드가 실제로는
  // 그 카테고리를 사용자 관심사로 매칭하지 않았다는 뜻이므로, "관심있어/관심이 많다"는
  // 표현과 함께 다른 카테고리 이름이 나오면 날조로 본다.)
  const matchedCategory = positiveHighlights
    .find((h) => h.startsWith('관심 분야('))
    ?.match(/관심 분야\((.+)\)/)?.[1];
  const mentionedOtherCategory = CATEGORIES.some(
    (c) => c !== matchedCategory && cleaned.includes(c),
  );
  if (
    mentionedOtherCategory &&
    /관심\s*있어|관심\s*있는|관심이\s*많|관심을\s*가지/.test(cleaned)
  ) {
    return fallbackReason(item);
  }

  // 9) 추천 이유는 반드시 긍정적으로 끝나야 한다 — 불일치를 정직하게 한 번 언급하는 것은
  // 괜찮지만, 마지막 문장이 그 불일치로 끝나면 안 된다. AI가 클로징 지시를 안 지켰을 때의
  // 안전장치로, 억지로 문장을 이어붙이지 않고 통째로 fallbackReason으로 교체한다.
  // (2026-09-30, 팀 피드백: "~와는 맞지 않아요"로 끝나는 추천 이유가 불쾌감을 줄 수 있다)
  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
  const lastSentence = sentences[sentences.length - 1] ?? '';
  if (/맞지\s*않|와는?\s*달라|다른\s*점이|아쉽|어려울\s*수|부족할\s*수/.test(lastSentence)) {
    return fallbackReason(item);
  }

  return cleaned || fallbackReason(item);
}

/**
 * item.matched(코드가 계산한 사실)에서 "왜 이 액션이 이 사람과 잘 맞는지"를
 * 우선순위 순(관심 분야 → 활동 성격 → 재능 → 모임 규모)으로 최대 4개 뽑는다.
 * '상관없음'류(사용자가 선호가 없던 축)는 애초에 이 라벨들과 문자열이 달라 자동으로 빠진다.
 */
function buildPositiveHighlights(matched: string[]): string[] {
  const highlights: string[] = [];

  const category = matched.find((m) => m.startsWith('관심 분야('));
  if (category) highlights.push(category);

  const vibe = matched.find((m) => m === '교류·소통형 활동' || m === '과업·집중형 활동');
  if (vibe) highlights.push(vibe);

  const skill = matched.find((m) => m.endsWith(' 재능 활용'));
  if (skill) highlights.push(skill);

  const groupSize = matched.find(
    (m) => m === '10명 이내 소규모' || m === '10~20명 중그룹' || m === '20명 이상 대그룹',
  );
  if (groupSize) highlights.push(groupSize);

  return highlights;
}

/**
 * 사용자가 실제로 뚜렷한 선호를 밝혔는데(상관없음이 아님) 이 액션이 거기 맞지 않는 축을
 * 정직하게 담을 사실 0~2개. 여기 없는 불일치는 AI가 새로 지어내면 안 된다 (프롬프트에서 강제).
 */
function buildMismatchNotes({
  action,
  meta,
  scoringAnswers,
}: {
  action: ActionCardData;
  meta?: { activity_types?: string[] } | null;
  scoringAnswers: ScoringAnswers;
}): string[] {
  const notes: string[] = [];

  const userTimes = scoringAnswers.userTimePreferences ?? [];
  const userWantsWeekendOnly =
    userTimes.length > 0 &&
    userTimes.every((t) => t.includes('주말')) &&
    !userTimes.includes('시간 상관없음');
  const userWantsWeekdayOnly =
    userTimes.length > 0 &&
    userTimes.every((t) => t.includes('평일')) &&
    !userTimes.includes('시간 상관없음');

  if (action.activityStartAt) {
    const isWk = isWeekend(action.activityStartAt);
    if (userWantsWeekendOnly && !isWk) {
      notes.push('평일에 진행되어 희망하신 주말 시간대와는 달라요');
    }
    if (userWantsWeekdayOnly && isWk) {
      notes.push('주말에 진행되어 희망하신 평일 시간대와는 달라요');
    }
  }

  const actTypes = meta?.activity_types ?? [];
  const isIndoorOnly =
    actTypes.length > 0 &&
    actTypes.every(
      (t) => t.includes('실내') && !t.includes('실외') && !t.includes('야외') && !t.includes('병행'),
    );
  const isOutdoorOnly =
    actTypes.length > 0 &&
    actTypes.every((t) => (t.includes('실외') || t.includes('야외')) && !t.includes('실내') && !t.includes('병행'));

  if (scoringAnswers.activityTypePreference === 'outdoor' && isIndoorOnly) {
    notes.push('실내에서 진행되어 희망하신 야외 활동과는 달라요');
  }
  if (scoringAnswers.activityTypePreference === 'indoor' && isOutdoorOnly) {
    notes.push('실외에서 진행되어 희망하신 실내 활동과는 달라요');
  }

  return notes.slice(0, 2);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const parsed = ChatRequestSchema.safeParse(
    await request.json().catch(() => ({})),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: '대화 내용을 확인해주세요.' },
      { status: 400 },
    );
  }

  const messages = parsed.data.messages;
  const userTurnCount = messages.filter(
    (message) => message.role === 'user',
  ).length;

  const [profile, participatedHistory, createdActions, following] = await Promise.all([
    getProfile(supabase, user.id, user.id),
    getParticipatedActions(supabase, user.id, user.id),
    getMyCreatedActions(supabase, user.id),
    getFollowing(supabase, user.id, user.id),
  ]);

  if (!profile) {
    return NextResponse.json(
      { error: '프로필을 먼저 완성해주세요.' },
      { status: 400 },
    );
  }

  // 호스트한 액션 중 DRAFT나 CANCELLED가 아닌 활동 포함
  const validCreatedActions = createdActions.filter(
    (a) => a.status !== 'DRAFT' && a.status !== 'CANCELLED',
  );
  // 전체 과거 활동 (참여 + 호스트)
  const allPastActions = [...participatedHistory, ...validCreatedActions];

  // {통합분야} 도출: 프로필 관심분야와 과거 활동 빈도 패턴 분석
  const { unifiedCategories, hasHistory } = resolveUnifiedCategories({
    profileCategories: profile.categories,
    pastActions: allPastActions,
    maxCount: 3,
  });

  const fieldReferenceCategories = allowedCategories(unifiedCategories);
  const history = allPastActions;

  const historyActionIds = history.map((action) => action.id);
  const { data: pastMetasData } = historyActionIds.length > 0
    ? await supabase
        .from('action_ai_metadata')
        .select('action_id, categories, activity_types, target_groups, participation_modes, skills, keywords, difficulty')
        .in('action_id', historyActionIds)
    : { data: [] };

  const pastMetaMap = new Map((pastMetasData ?? []).map((m) => [m.action_id, m]));

  const userContext = analyzeUserContext({
    profile,
    history,
    pastMetas: pastMetasData ?? [],
  });

  const userAnswers = messages
    .filter((message) => message.role === 'user')
    .map((message) => message.content);
  const replayContext: ReplayContext = {
    userState: userContext.state,
    hasRegionAndTime: userContext.hasRegionAndTime,
    hasHistory,
    profileSkills: profile.skills ?? [],
  };
  const { answers: adaptiveAnswers, axisPerTurn } = replayAnswers(userAnswers, replayContext);
  const inferredSkills = extractSkillsAnswer(messages);
  const effectiveSkills = inferredSkills ?? profile.skills;
  const selectedSkills =
    adaptiveAnswers.talentPreference === 'use'
      ? (inferredSkills ?? profile.skills ?? [])
      : [];
  const remainingQuestionKeys = getRemainingQuestionKeys({
    answers: adaptiveAnswers,
    ...replayContext,
  });
  const fallbackQuestionKey = remainingQuestionKeys[0] ?? null;

  // Turn 0: 첫 진입 시 프로필 기본 조건(지역 1곳, 선호 시간대 복수) 상시 확인 (Zero-Assumption)
  if (userTurnCount === 0) {
    const openingKey: QuestionKey = 'opening';
    const openingReply = getQuestionReply(openingKey, {
      nickname: profile.nickname,
      answers: adaptiveAnswers,
      profileSkills: profile.skills ?? [],
      selectedSkills,
      fieldReferenceCategories,
      hasHistory,
      userState: userContext.state,
      knownFacts: userContext.knownFacts,
      pastActivitySummary: userContext.pastActivitySummary,
      profileRegion: userContext.profileRegion,
      profileTimesSummary: userContext.profileTimesSummary,
      hasRegionAndTime: userContext.hasRegionAndTime,
    });
    const openingOptions = getQuestionOptions(
      openingKey,
      SKILLS,
      userContext.state,
      userContext.hasRegionAndTime,
    );

    return NextResponse.json({
      done: false,
      reply: openingReply,
      options: openingOptions,
      relaxation: [],
      items: null,
      isLastQuestion: false,
    });
  }

  const lastUserMsg = userAnswers[userAnswers.length - 1] ?? '';
  const assistantMessages = messages.filter((m) => m.role === 'assistant');
  const lastAssistantMsg = assistantMessages[assistantMessages.length - 1]?.content ?? '';

  // 직전 답변(lastUserMsg)이 실제로 어느 축에 대한 것이었는지는 replayAnswers()가 재생하며
  // 이미 확정적으로 계산해뒀다 — axisPerTurn의 마지막 값이 바로 그것이다.
  const isSkillContext = axisPerTurn[axisPerTurn.length - 1] === 'skills';

  if (isSkillContext && lastUserMsg) {
    const harmfulCheck = validateHarmfulSkillInput(lastUserMsg);
    if (harmfulCheck.isHarmful) {
      return NextResponse.json({
        done: false,
        reply: harmfulCheck.reason,
        options: getQuestionOptions('skills', SKILLS, userContext.state, userContext.hasRegionAndTime, {
          hasHistory,
          hasRegionAndTime: userContext.hasRegionAndTime,
          answers: adaptiveAnswers,
          profileSkills: profile.skills ?? [],
        }),
        questionKey: 'skills',
        answeredCount: userTurnCount,
        maxQuestions: MAX_USER_TURNS,
      });
    }

    const isProfileConfirm = /예.*그럴|그럴게|그럴께|네.*그럴|그대로 살릴|그대로 활용|프로필 재능|기존 재능/.test(lastUserMsg);
    const isNewSkillRequest = /아니요|다른 재능|새로운 재능|새 재능/.test(lastUserMsg);
    const isSkipSkill = /특별한 재능 없이|재능.*상관|부담 없이|상관없음/.test(lastUserMsg);
    const isKnownSkill = ALL_15_SKILLS.some((s) => lastUserMsg.includes(s));

    if (isProfileConfirm) {
      // 프로필 재능 그대로 활용 확정 — adaptiveAnswers는 이미 replayAnswers() 단계에서
      // 이 축(skills)을 'profile'로 해석해뒀으므로 여기서 더 손댈 게 없다. 다음 질문으로 진행.
    } else if (isNewSkillRequest) {
      // 새로운 재능 선택 요청 ➔ 16종 선택지 노출
      return NextResponse.json({
        done: false,
        reply: `새로운 재능을 펼치고 싶으시군요! 멋져요 ✨\n${profile.nickname}님이 활용할 수 있는 재능을 아래 선택지에서 골라주세요!`,
        options: [...ALL_15_SKILLS],
        questionKey: 'skills',
        answeredCount: userTurnCount,
        maxQuestions: MAX_USER_TURNS,
      });
    } else if (!isKnownSkill && !isSkipSkill) {
      const isCheering = /파이팅|화이팅|힘내|응원/.test(lastUserMsg);
      const promptLead = isCheering
        ? `'${lastUserMsg.trim()}' 응원 말씀 정말 감사해요! 힘이 팍팍 나네요! 💪😊`
        : `말씀해 주셔서 감사해요! 😊`;
      return NextResponse.json({
        done: false,
        reply: `${promptLead}\n이번 액션에서 ${profile.nickname}님이 활용할 수 있는 재능을 아래 선택지에서 골라주세요! 특정 재능에 상관없이 참여하고 싶으시다면 '기타'를 선택해주시면 됩니다.`,
        options: [...ALL_15_SKILLS],
        questionKey: 'skills',
        answeredCount: userTurnCount,
        maxQuestions: MAX_USER_TURNS,
      });
    }
  }

  const recommendNow = shouldRecommendNow({
    userTurnCount,
    enough: false,
    remainingKeysCount: remainingQuestionKeys.length,
  });

  if (!recommendNow) {
    const nextAxis: QuestionKey = fallbackQuestionKey ?? 'categories';

    // AI의 역할은 딱 하나 — 직전 답변에 대한 짧은 공감 한 줄. 질문 축과 질문 본문·선택지는
    // getRemainingQuestionKeys()/getQuestionReply()/getQuestionOptions() (interview.ts, 무변경)가
    // 이미 결정하므로, AI 응답과 코드 기대값이 어긋날 여지 자체가 없다.
    let acknowledgment = '';
    try {
      const ackResult = await callStructuredAI({
        agent: 'DISCOVER',
        promptVersion: CHAT_PROMPT_VERSION,
        system: CHAT_SYSTEM,
        temperature: 0.5,
        user: JSON.stringify({
          사용자: profile.nickname,
          직전질문: lastAssistantMsg,
          사용자의답변: lastUserMsg,
        }),
        schema: AcknowledgmentSchema,
        userId: user.id,
      });
      acknowledgment = ackResult.acknowledgment
        .split(/\n\s*[-•*]\s*|\n\s*\d+[.)]\s*/)[0]
        .trim();
    } catch {
      acknowledgment = '';
    }

    const templateReply = getQuestionReply(nextAxis, {
      nickname: profile.nickname,
      answers: adaptiveAnswers,
      profileSkills: profile.skills ?? [],
      selectedSkills,
      fieldReferenceCategories,
      hasHistory,
      userState: userContext.state,
      knownFacts: userContext.knownFacts,
      pastActivitySummary: userContext.pastActivitySummary,
      profileCategories: profile.categories ?? [],
    });
    const reply = acknowledgment ? `${acknowledgment}\n${templateReply}` : templateReply;

    const options = getQuestionOptions(
      nextAxis,
      SKILLS,
      userContext.state,
      userContext.hasRegionAndTime,
      {
        hasHistory,
        hasRegionAndTime: userContext.hasRegionAndTime,
        answers: adaptiveAnswers,
        profileSkills: profile.skills ?? [],
        profileCategories: profile.categories ?? [],
      },
    );

    const isLastQuestion = remainingQuestionKeys.length === 1;
    return NextResponse.json({
      done: false,
      reply,
      options,
      questionKey: nextAxis,
      answeredCount: userTurnCount,
      maxQuestions: MAX_USER_TURNS,
      isLastQuestion,
    });
  }

  const targetRegions = adaptiveAnswers.selectedRegion
    ? [adaptiveAnswers.selectedRegion]
    : profile.regions;

  const scoringProfile: ScoringProfile = {
    categories: profile.categories,
    skills: effectiveSkills ?? [],
    historyCategories: fieldReferenceCategories,
    timePrefs: profile.timePrefs,
    availableTimes: profile.availableTimes,
    regions: targetRegions,
    followingIds: following.map((person) => person.id),
  };

  const finalReply = getRecommendationReply({
    nickname: profile.nickname,
    answers: adaptiveAnswers,
    selectedSkills,
    fieldReferenceCategories,
  });

  // 사용자가 대화에서 '같은 분야' 또는 프로필 관심 분야를 확인하고 수락한 경우 (familiar) 카테고리 자동 설정
  if (
    adaptiveAnswers.fieldPreference === 'familiar' &&
    (!adaptiveAnswers.selectedCategories ||
      adaptiveAnswers.selectedCategories.length === 0 ||
      adaptiveAnswers.selectedCategories.includes('상관없음'))
  ) {
    if (fieldReferenceCategories && fieldReferenceCategories.length > 0) {
      adaptiveAnswers.selectedCategories = [...fieldReferenceCategories];
      adaptiveAnswers.selectedCategory = fieldReferenceCategories[0];
    } else {
      const validCats = (profile.categories ?? []).filter((c) => c !== '전체');
      if (validCats.length > 0) {
        adaptiveAnswers.selectedCategories = validCats;
        adaptiveAnswers.selectedCategory = validCats[0];
      }
    }
  }

  // adaptiveAnswers(interview.ts)가 못 잡은 경우에만 쓰는 텍스트 휴리스틱 보조 수단
  const conditionsFromText = deriveConditionsFromText({
    messages,
    fieldReferenceCategories,
    profileCategories: profile.categories ?? [],
  });

  // 사용자가 대화에서 명시적으로 카테고리를 선택한 경우 이를 최우선으로 반영 (복수 카테고리 지원)
  let filterCategories: string[] = [];
  if (adaptiveAnswers.selectedCategories && adaptiveAnswers.selectedCategories.length > 0) {
    filterCategories = adaptiveAnswers.selectedCategories.filter((c) => c !== '상관없음');
  } else if (adaptiveAnswers.selectedCategory && adaptiveAnswers.selectedCategory !== '상관없음') {
    filterCategories = [adaptiveAnswers.selectedCategory];
  } else {
    filterCategories = allowedCategories(conditionsFromText.categories);
  }

  const allCandidates = await getRecommendCandidates(supabase, user.id, {});
  const categoryCandidates =
    filterCategories.length > 0
      ? allCandidates.filter((action) => {
          const actionCats = [action.category, ...(action.categories ?? [])];
          return filterCategories.some((c) => (actionCats as string[]).includes(c));
        })
      : allCandidates;

  const hasRegionFilter =
    targetRegions.length > 0 &&
    !targetRegions.includes(NATIONWIDE) &&
    adaptiveAnswers.travelRange !== 'any';
  let candidates = categoryCandidates;
  if (hasRegionFilter) {
    candidates = categoryCandidates.filter((action) =>
      adaptiveAnswers.travelRange === 'province'
        ? sameProvince(action.address, targetRegions)
        : matchesRegion(action.address, targetRegions),
    );
  }
  const relaxation: string[] = [];
  const RELAXATION_MESSAGE =
    '원하시는 조건에 딱 맞는 액션이 많지 않아, 조건을 넓혀 가장 가까운 액션으로 추천해 드렸어요.';

  if (candidates.length === 0 && hasRegionFilter) {
    candidates = categoryCandidates;
    relaxation.push(RELAXATION_MESSAGE);
  }

  if (candidates.length === 0 && filterCategories.length > 0) {
    candidates = allCandidates;
    relaxation.push(RELAXATION_MESSAGE);
  }

  if (candidates.length === 0) {
    return NextResponse.json({
      done: true,
      reply: finalReply,
      options: [],
      relaxation,
      items: [],
    });
  }

  const candidateIds = candidates.map((candidate) => candidate.id);
  const metadataByAction: Record<string, ActionScoringMetadata> = {};
  const [{ data: metas }, { data: actionItems }] = await Promise.all([
    supabase
      .from('action_ai_metadata')
      .select(
        'action_id, categories, activity_types, target_groups, participation_modes, skills, keywords, difficulty',
      )
      .in('action_id', candidateIds),
    supabase
      .from('action_items')
      .select('action_id, type, name, min_required, max_allowed, gender_requirement')
      .in('action_id', candidateIds),
  ]);

  const itemsByAction = new Map<
    string,
    Array<{ type: string; name?: string; min_required: number; max_allowed: number | null; gender_requirement?: string }>
  >();
  for (const item of actionItems ?? []) {
    const items = itemsByAction.get(item.action_id) ?? [];
    items.push(item);
    itemsByAction.set(item.action_id, items);
  }

  // 0순위 성별 하드 필터링: 사용자 성별과 모집 성별 검증
  const userGender = profile.gender;
  if (userGender) {
    const genderFiltered = candidates.filter((action) => {
      const items = itemsByAction.get(action.id) ?? [];
      const personItems = items.filter((it) => it.type === 'PERSON');
      if (personItems.length === 0) return true;
      return personItems.some(
        (it) => !it.gender_requirement || it.gender_requirement === 'ANY' || it.gender_requirement === userGender,
      );
    });
    if (genderFiltered.length > 0) {
      candidates = genderFiltered;
    }
  }

  type MetaRecord = NonNullable<typeof metas>[number];
  const metasById = new Map<string, MetaRecord>();
  for (const metadata of metas ?? []) {
    metasById.set(metadata.action_id, metadata);
    metadataByAction[metadata.action_id] = {
      categories: metadata.categories ?? [],
      participationModes: metadata.participation_modes ?? [],
      skills: metadata.skills ?? [],
      groupSize: totalGroupSize(itemsByAction.get(metadata.action_id) ?? []),
      targetGroups: metadata.target_groups ?? [],
      difficulty: metadata.difficulty ?? null,
      activityTypes: metadata.activity_types ?? [],
      keywords: metadata.keywords ?? [],
    };
  }
  for (const candidateId of candidateIds) {
    metadataByAction[candidateId] ??= {
      categories: [],
      participationModes: [],
      skills: [],
      groupSize: totalGroupSize(itemsByAction.get(candidateId) ?? []),
      targetGroups: [],
      difficulty: null,
      activityTypes: [],
      keywords: [],
    };
  }

  const participationMode = conditionsFromText.participationMode;
  const resolvedSkills =
    adaptiveAnswers.selectedSkills && adaptiveAnswers.selectedSkills.length > 0
      ? adaptiveAnswers.selectedSkills
      : (adaptiveAnswers.selectedSkill === 'profile'
          ? (profile.skills ?? [])
          : (adaptiveAnswers.selectedSkill ? [adaptiveAnswers.selectedSkill] : selectedSkills));
  const resolvedSkill = resolvedSkills[0] ?? null;
  const resolvedCategory =
    adaptiveAnswers.selectedCategory === '상관없음'
      ? '상관없음'
      : adaptiveAnswers.selectedCategory
        ? adaptiveAnswers.selectedCategory
        : (filterCategories.length === 1 ? filterCategories[0] : null);

  // scoreAction()은 category/categories에 '상관없음'이 그대로 들어와야 "카테고리 전체
  // 허용"(wantsAll)으로 인식한다. filterCategories는 후보 필터링용으로 '상관없음'을 미리
  // 걸러낸 배열이라, 그걸 그대로 스코어링에 넘기면 "사용자가 상관없다고 골랐다"와 "아직
  // 안 답했다"가 똑같이 빈 배열이 되어 구분이 안 된다 — scoreAction이 이걸 "응답 없음"으로
  // 보고 조용히 프로필 관심분야로 대신 매칭해버린다 (2026-09-30, 팀 테스트 피드백:
  // 카테고리를 '상관없음'으로 골랐는데도 추천 이유가 "선택하신 OO 분야"라며 사용자가
  // 고르지 않은 특정 분야를 골랐다는 듯이 서술한 사례).
  const scoringCategories =
    adaptiveAnswers.selectedCategories && adaptiveAnswers.selectedCategories.length > 0
      ? adaptiveAnswers.selectedCategories
      : filterCategories;

  const scoringAnswers: ScoringAnswers = {
    participationMode,
    category: resolvedCategory,
    categories: scoringCategories,
    range: relaxation.length > 0 ? 'any' : null,
    talentPreference:
      adaptiveAnswers.talentPreference === 'new_skill'
        ? 'use'
        : (adaptiveAnswers.talentPreference ?? null),
    groupSizePreference: adaptiveAnswers.groupSizePreference ?? null,
    fieldPreference: null,
    travelRange: adaptiveAnswers.travelRange ?? null,
    targetGroupPreference: adaptiveAnswers.vibePreference ?? null,
    difficultyPreference: adaptiveAnswers.difficultyPreference ?? null,
    activityTypePreference: adaptiveAnswers.activityType ?? null,
    selectedSkill: resolvedSkill,
    selectedSkills: resolvedSkills,
    userKeywords: adaptiveAnswers.userKeywords ?? [],
    userTimePreferences: adaptiveAnswers.timePreferences ?? [],
    selectedRegion: adaptiveAnswers.selectedRegion ?? null,
  };

  // 1) 서버 코드 100점 만점 랭킹 계산으로 Top 3 확정 (환각 및 점수 역전 원천 차단)
  const codeRanked = rankActions(
    candidates,
    scoringProfile,
    scoringAnswers,
    metadataByAction,
    3,
  );

  // 조건 완화(Relaxation) 안내 검사: 사용자가 선택한 핵심 조건에 부합하는 액션이 top 3에 없는 경우 종합 안내
  let isConditionRelaxed = relaxation.length > 0;

  if (!isConditionRelaxed) {
    if (scoringAnswers.targetGroupPreference === 'task') {
      const hasTask = codeRanked.some((it) => it.matched.includes('과업·집중형 활동'));
      if (!hasTask) isConditionRelaxed = true;
    } else if (scoringAnswers.targetGroupPreference === 'social') {
      const hasSocial = codeRanked.some((it) => it.matched.includes('교류·소통형 활동'));
      if (!hasSocial) isConditionRelaxed = true;
    }

    const userRequestedSpecificSkills =
      scoringAnswers.selectedSkills &&
      scoringAnswers.selectedSkills.length > 0 &&
      !scoringAnswers.selectedSkills.includes('기타');
    if (userRequestedSpecificSkills) {
      const hasSkillMatch = codeRanked.some((it) =>
        it.matched.some((m) => m.includes('재능 활용')),
      );
      if (!hasSkillMatch) isConditionRelaxed = true;
    }

    if (scoringAnswers.activityTypePreference === 'outdoor') {
      const hasOutdoor = codeRanked.some((it) =>
        it.matched.includes('야외 활동') || it.matched.includes('실내외 병행 활동'),
      );
      if (!hasOutdoor) isConditionRelaxed = true;
    } else if (scoringAnswers.activityTypePreference === 'indoor') {
      const hasIndoor = codeRanked.some((it) =>
        it.matched.includes('실내 활동') || it.matched.includes('실내외 병행 활동'),
      );
      if (!hasIndoor) isConditionRelaxed = true;
    }
  }

  if (isConditionRelaxed) {
    relaxation.push(RELAXATION_MESSAGE);
  }

  const uniqueRelaxation = Array.from(new Set(relaxation));

  const userSelectedSkills =
    scoringAnswers.selectedSkills && scoringAnswers.selectedSkills.length > 0
      ? scoringAnswers.selectedSkills.filter((s) => s !== '기타')
      : (scoringAnswers.selectedSkill && scoringAnswers.selectedSkill !== '기타' ? [scoringAnswers.selectedSkill] : []);

  // 2) 선정된 Top 3 후보에 대해 AI가 개인화 맞춤 추천 이유(reason) 서술
  // AI에게는 "이미 매칭이 끝난 결과"만 넘긴다 — 액션 자체의 원본 속성(카테고리·성격·환경 등)은
  // 일부러 넘기지 않는다. 예전엔 이 필드들도 같이 줬는데, AI가 "사용자와 매칭된 것"
  // (positiveHighlights)과 "액션 자신의 성격 설명"을 구분 못 하고 후자를 보고 "이것도
  // 관심사겠거니" 끼워맞추는 사고가 있었다 (2026-09-30, 팀 테스트 피드백: 사용자가 고르지도
  // 않은 카테고리를 "관심있어 하는 분야"라고 서술). "왜 맞는지/안 맞는지"의 유일한 근거는
  // positiveHighlights·mismatchNotes 두 배열뿐이어야 헷갈릴 여지가 없다.
  const candidateSummaries = codeRanked.map((item) => {
    const action = item.action;
    const meta = metasById.get(action.id);
    const rawItems = itemsByAction.get(action.id) ?? [];
    const recruitmentItems = rawItems
      .filter((it) => it.name && it.name.trim().length > 0)
      .map((it) => (it.type === 'PERSON' ? `${it.name}(모집)` : `${it.name}(물품)`));

    const actionSkills = meta?.skills ?? [];
    const matchedUserSkills = actionSkills.filter((s) => userSelectedSkills.includes(s));

    return {
      actionId: action.id,
      title: action.title,
      matchedUserSkills,
      actionRequiresSkills: actionSkills,
      recruitmentItems,
      positiveHighlights: buildPositiveHighlights(item.matched),
      mismatchNotes: buildMismatchNotes({ action, meta, scoringAnswers }),
    };
  });

  const reasonsMap: Record<string, string> = {};

  try {
    const aiRec = await callStructuredAI({
      agent: 'DISCOVER',
      promptVersion: RECOMMEND_PROMPT_VERSION,
      system: `당신은 선한 영향력 SNS '착착'의 액션 추천 전문 AI 에이전트입니다.
선정된 각 액션에 대해, 왜 이 액션이 이 사람에게 의미있는지 2~3문장의 다정한 추천 이유(reason)를 작성하세요.
영어 'Action'이나 '봉사/봉사활동/수혜자' 단어를 절대 쓰지 말고 한글 '액션'으로 서술하세요.
'사용자님'이라는 표현은 절대 쓰지 마세요 — 반드시 '사용자닉네임' 값에 '님'을 붙여 이름으로 부르세요 (예: "민호님이 관심있어 하는...").

[추천 이유 구조 — 반드시 이 순서를 지키세요]
1. 오프너(1~2문장, 항상 긍정): 각 액션의 'positiveHighlights' 배열은 이미 우선순위(관심 분야 → 활동 성격 → 재능 → 모임 규모)
   순으로 정렬되어 있습니다. 앞에서부터 2~3개를 골라 왜 이 액션이 이 사람과 잘 맞는지 구체적으로 서술하세요.
   이 배열에 없는 사실은 절대 지어내지 마세요.
2. 불일치(0~1문장): 'mismatchNotes' 배열이 비어있지 않다면, "다만"/"하지만"으로 자연스럽게 이어서 배열의 내용을
   그대로(과장하거나 새로 지어내지 말고) 딱 한 번만 정직하게 언급하세요. 배열이 비어있으면 이 문장은 통째로 생략하세요.
3. 클로징(반드시 긍정, 1문장): 'positiveHighlights' 중 오프너에서 아직 안 쓴 항목이 있으면 그것으로, 없으면 오프너에서
   쓴 것 중 하나를 다른 표현으로 반복해서 "~라 골라봤어요!" 처럼 다시 긍정적인 인상으로 마무리하세요.
   ★★★ 절대로 2번(불일치) 문장을 추천 이유의 마지막 문장으로 두지 마세요. 항상 긍정 문장으로 끝나야 합니다.

[예시] positiveHighlights: ["관심 분야(아동·청소년)", "교류·소통형 활동"], mismatchNotes: ["평일에 진행되어 희망하신 주말 시간대와는 달라요"]
→ "민호님이 관심있어 하는 아동·청소년 분야이면서 사람들과 도란도란 소통할 수 있는 액션이에요. 다만 평일에 진행되어 희망하신 주말 시간대와는 조금 다르지만, 아이들과 이야기 나누는 걸 좋아하신다면 분명 잘 맞으실 거예요!"

[필수 사실 검증 원칙 - 절대 위반 금지]

1. ★★★ [재능 날조 및 사용자 미보유 재능 언급 절대 금지]:
   - 오직 'matchedUserSkills'에 재능명이 들어있을 때만("positiveHighlights'에도 그 재능이 포함되어 있을 것입니다) 재능을 언급할 수 있습니다.
   - 'matchedUserSkills'가 빈 배열([])이면 재능 이야기는 일체 하지 마세요. 액션 정보(actionRequiresSkills)에 적힌 다른 재능을
     사용자가 가지고 있다고 절대 거짓 서술하지 마세요.
     (위반 금지 예시: 교육·멘토링을 선택한 사용자에게 액션이 네일아트라고 해서 "미술·공예 재능을 활용하여..."라고 쓰는 것은 심각한 날조입니다.)
   - 같은 이유로, 'positiveHighlights'에 '관심 분야(...)' 항목이 없으면 "관심있어 하는 OO 분야"처럼
     특정 카테고리를 사용자의 관심사로 엮어 말하지 마세요. 액션 제목이나 소개에 어떤 분야 단어가
     보여도, 그게 사용자가 실제로 고른 관심사라는 뜻은 아닙니다.

2. ★★★ [활동 환경(실내/실외) 언급 절대 금지 — mismatchNotes에 있는 것 제외]:
   - 이 액션이 실내인지 실외인지에 대한 정보는 드리지 않습니다. 'mismatchNotes'에 그 내용이
     있을 때만 그대로 전달하고, 그 외에는 실내·실외·야외에 대해 아무 말도 지어내지 마세요.
   - '교류·소통형'이나 '육체·과업·집중형'은 활동의 '분위기'이지 '재능'이 아닙니다. "육체적인 재능" 같은 표현 금지.

3. ★★★ [불일치는 오직 'mismatchNotes'에 있는 것만]:
   - 'mismatchNotes'에 없는 불일치를 새로 지어내지 마세요.
   - 반대로 실제 불일치를 "시간도 잘 맞을 것 같아요"처럼 거짓으로 좋다고 포장하지도 마세요.

4. [세부 모집 항목(recruitmentItems) 역할 타겟팅]:
   - recruitmentItems 중 사용자가 실제로 선택한 재능(matchedUserSkills)이나 역할에 부합하는 세부 파트가 있을 때만 구체적 파트명을 언급하세요.

반드시 JSON 형식으로만 답하세요:
{"reasons": {"actionId1": "추천 이유 1", "actionId2": "추천 이유 2", ...}}`,
      temperature: 0.3,
      user: JSON.stringify({
        사용자닉네임: profile.nickname,
        사용자선택조건: {
          관심분야: scoringAnswers.categories ?? [scoringAnswers.category],
          선택재능: userSelectedSkills.length > 0 ? userSelectedSkills : ['선택하지 않음 / 재능 상관없음'],
          희망활동성격:
            scoringAnswers.targetGroupPreference === 'social'
              ? '교류·교육·소통형'
              : scoringAnswers.targetGroupPreference === 'task'
                ? '육체·과업·집중형'
                : '상관없음',
          활동환경:
            scoringAnswers.activityTypePreference === 'indoor'
              ? '실내'
              : scoringAnswers.activityTypePreference === 'outdoor'
                ? '실외'
                : '상관없음',
          희망시간대:
            scoringAnswers.userTimePreferences && scoringAnswers.userTimePreferences.length > 0
              ? scoringAnswers.userTimePreferences
              : ['시간 상관없음'],
          모임규모: scoringAnswers.groupSizePreference ?? '상관없음',
        },
        선정된액션목록: candidateSummaries,
      }),
      schema: z.object({
        reasons: z.record(z.string(), z.string()).catch({}).default({}),
      }),
      userId: user.id,
    });

    Object.assign(reasonsMap, aiRec.reasons);
  } catch {
    // AI 실패 시 기본 이유(fallbackReason) 사용
  }

  const topItems = codeRanked.map((item) => {
    const reason = reasonsMap[item.action.id] ?? '';
    const meta = metasById.get(item.action.id);
    const finalReason = filterRecommendationReason({
      reason,
      item,
      meta,
      userSelectedSkills,
      scoringAnswers,
      mismatchNotes: buildMismatchNotes({ action: item.action, meta, scoringAnswers }),
      positiveHighlights: buildPositiveHighlights(item.matched),
    });

    return {
      action: item.action,
      score: item.score,
      reason: finalReason,
    };
  });

  return NextResponse.json({
    done: true,
    reply: finalReply,
    options: [],
    relaxation: uniqueRelaxation,
    items: topItems,
    summaryChips: formatSummaryChips(messages),
  });
}
