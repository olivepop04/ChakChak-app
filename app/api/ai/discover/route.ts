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
  extractAdaptiveAnswers,
  extractAnswersFromDialogue,
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
} from '@/app/api/ai/discover/interview';
import { CATEGORIES, SKILLS, type Category } from '@/lib/constants';
import { matchesRegion, NATIONWIDE } from '@/lib/constants/regions';
import { formatDate, formatTime, isWeekend } from '@/lib/utils/date';

const CHAT_PROMPT_VERSION = 'discover-chat-v11-axis-locked';
const RECOMMEND_PROMPT_VERSION = 'discover-recommend-v11-truth-grounding';
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

  // 3) 액션 환경(실내/실외) 왜곡 및 날조 감지:
  // - 순수 실내 활동인데 '실외', '야외', '밖에서' 또는 '땀 흘리며'가 들어간 경우
  if (isIndoorOnly && /실외|야외|밖에서|땀\s*흘리/.test(cleaned)) {
    return fallbackReason(item);
  }
  // - 순수 실외 활동인데 '실내'가 들어간 경우
  if (isOutdoorOnly && /실내/.test(cleaned)) {
    return fallbackReason(item);
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

  // 7) 일정 사실 날조 검증 (기존 로직 유지)
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

  return cleaned || fallbackReason(item);
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
  const adaptiveAnswers = {
    ...extractAdaptiveAnswers(userAnswers),
    ...extractAnswersFromDialogue(messages),
  };
  if (
    adaptiveAnswers.selectedSkill === 'profile' &&
    profile.skills &&
    profile.skills.length > 0 &&
    (!adaptiveAnswers.selectedSkills || adaptiveAnswers.selectedSkills.length === 0)
  ) {
    adaptiveAnswers.selectedSkills = profile.skills;
    adaptiveAnswers.selectedSkill = 'profile';
    adaptiveAnswers.talentPreference = 'use';
  }
  const inferredSkills = extractSkillsAnswer(messages);
  const effectiveSkills = inferredSkills ?? profile.skills;
  const selectedSkills =
    adaptiveAnswers.talentPreference === 'use'
      ? (inferredSkills ?? profile.skills ?? [])
      : [];
  const remainingQuestionKeys = getRemainingQuestionKeys({
    answers: adaptiveAnswers,
    userState: userContext.state,
    hasRegionAndTime: userContext.hasRegionAndTime,
    hasHistory,
    profileSkills: profile.skills ?? [],
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

  // 직전 턴에 실제로 어떤 축을 물었는지 결정론적으로 재계산한다 (AI 생성 텍스트를 정규식으로
  // 스니핑하지 않는다 — 질문은 항상 getRemainingQuestionKeys() 가 고른 축에서 나오기 때문에
  // 같은 함수를 "직전 답변 반영 전" 상태에 대해 한 번 더 돌리면 직전 질문 축이 그대로 나온다).
  const priorUserAnswers = userAnswers.slice(0, -1);
  const priorMessages = messages.slice(0, -1);
  const priorAdaptive = {
    ...extractAdaptiveAnswers(priorUserAnswers),
    ...extractAnswersFromDialogue(priorMessages),
  };
  const skillAlreadyDecided =
    Boolean(priorAdaptive.selectedSkills && priorAdaptive.selectedSkills.length > 0) ||
    priorAdaptive.selectedSkill === 'profile' ||
    priorAdaptive.talentPreference === 'any';
  const previousAxis =
    getRemainingQuestionKeys({
      answers: priorAdaptive,
      userState: userContext.state,
      hasRegionAndTime: userContext.hasRegionAndTime,
      hasHistory,
      profileSkills: profile.skills ?? [],
    })[0] ?? null;
  const isSkillContext = previousAxis === 'skills' && !skillAlreadyDecided;

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
      // 프로필 재능 그대로 활용 확정 ➔ 재능 바인딩 후 다음 질문으로 정상 진행
      adaptiveAnswers.selectedSkill = 'profile';
      adaptiveAnswers.selectedSkills = profile.skills ?? [];
      adaptiveAnswers.talentPreference = 'use';
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
    adaptiveAnswers.selectedCategory && adaptiveAnswers.selectedCategory !== '상관없음'
      ? adaptiveAnswers.selectedCategory
      : (filterCategories.length === 1 ? filterCategories[0] : null);

  const scoringAnswers: ScoringAnswers = {
    participationMode,
    category: resolvedCategory,
    categories: filterCategories,
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
  const candidateSummaries = codeRanked.map((item) => {
    const action = item.action;
    const meta = metasById.get(action.id);
    const scheduleStr = action.activityStartAt
      ? `${formatDate(action.activityStartAt)} ${formatTime(action.activityStartAt)} (${isWeekend(action.activityStartAt) ? '주말' : '평일'})`
      : '일정 미정';
    const rawItems = itemsByAction.get(action.id) ?? [];
    const recruitmentItems = rawItems
      .filter((it) => it.name && it.name.trim().length > 0)
      .map((it) => (it.type === 'PERSON' ? `${it.name}(모집)` : `${it.name}(물품)`));

    const actionSkills = meta?.skills ?? [];
    const matchedUserSkills = actionSkills.filter((s) => userSelectedSkills.includes(s));
    const isSocialAction = (meta?.target_groups ?? []).some((g) => /교류|교육|소통/.test(g));
    const isTaskAction = (meta?.target_groups ?? []).some((g) => /과업|육체|집중/.test(g));
    const actualVibeDescription =
      isSocialAction && isTaskAction
        ? '교류·소통과 육체적 작업이 함께 있는 복합 활동'
        : isSocialAction
          ? '사람과의 대화, 상담, 정서적 유대가 중심인 교류·소통형 활동'
          : isTaskAction
            ? '작업, 땀 흘리기, 결과물 완성이 중심인 육체·과업·집중형 활동'
            : '일반 활동';

    const actionActivityTypes = meta?.activity_types ?? [];

    return {
      actionId: action.id,
      title: action.title,
      category: action.category,
      address: action.address,
      activityTypes: actionActivityTypes,
      targetGroups: meta?.target_groups ?? [],
      actualVibeDescription,
      isSocialAction,
      isTaskAction,
      participationModes: meta?.participation_modes ?? [],
      matchedUserSkills,
      actionRequiresSkills: actionSkills,
      recruitmentItems,
      actualSchedule: scheduleStr,
      isWeekendAction: action.activityStartAt ? isWeekend(action.activityStartAt) : null,
      matchedReasons: item.matched,
    };
  });

  const reasonsMap: Record<string, string> = {};

  try {
    const aiRec = await callStructuredAI({
      agent: 'DISCOVER',
      promptVersion: RECOMMEND_PROMPT_VERSION,
      system: `당신은 선한 영향력 SNS '착착'의 액션 추천 전문 AI 에이전트입니다.
선정된 각 액션에 대해 사용자의 성향과 대화 내용을 바탕으로 왜 이 액션이 사용자에게 꼭 맞는지 1~2문장의 다정하고 구체적인 추천 이유(reason)를 작성하세요.
영어 'Action'이나 '봉사/봉사활동/수혜자' 단어를 절대 쓰지 말고 한글 '액션'으로 서술하세요.

[필수 작성 규칙 및 사실 검증 원칙 - 절대 위반 금지]

1. ★★★ [재능 날조 및 사용자 미보유 재능 언급 절대 금지]:
   - 오직 이 액션의 'matchedUserSkills'에 재능명이 들어있을 때만 "사용자님의 [재능명] 재능을 살려..."라고 작성할 수 있습니다.
   - ★ [매우 중요] 'matchedUserSkills'가 빈 배열([])인 액션의 경우:
     사용자가 선택한 재능과 이 액션의 요구 재능이 일치하지 않는 상태입니다. 액션 정보(actionRequiresSkills)에 적힌 다른 재능(예: 미술·공예, 요리, 운전 등)을 사용자가 가지고 있다고 절대 거짓 서술하지 마세요!
     (위반 금지 예시: 교육·멘토링을 선택한 사용자에게 액션이 네일아트라고 해서 "미술·공예 재능을 활용하여 네일아트를 해보세요"라고 권유하는 것은 심각한 날조입니다.)
     이 경우 재능에 대한 언급은 일체 하지 말고, 액션의 분야(노인 복지 등), 따뜻한 대화/정서적 교류, 활동의 보람 등 액션 본연의 특성으로만 진솔하게 추천 이유를 작성하세요.

2. ★★★ [활동 환경(실내/실외) 및 활동 성격 왜곡 절대 금지]:
   - 액션의 'activityTypes'가 '실내 활동'인 경우:
     ★ 절대로 "실외에서", "야외에서", "밖에서", "땀 흘리며" 등으로 왜곡하지 마세요! 도서 분류, 물품 정리 등은 실내 활동입니다. 사용자가 실외를 희망했더라도 액션이 실내 활동이면 환경을 실외로 속여서는 안 됩니다.
   - 액션의 'activityTypes'가 '실외 활동'인 경우:
     ★ 절대로 "실내에서", "아늑한 실내" 등으로 왜곡하지 마세요!
   - '교류·소통형'이나 '육체·과업·집중형'은 활동의 '분위기/진행 방식'이지 '재능'이 아닙니다! "육체적인 재능", "집중적인 재능" 같은 해괴한 표현은 절대 사용하지 마세요.

3. ★★★ [희망 시간대 불일치 시 시간대 언급 및 억지 칭찬 절대 금지]:
   - 사용자가 '주말'을 희망했는데 액션 일정이 '평일'인 경우:
     ★ "평일이라 시간도 잘 맞을 것 같아요", "평일 오후에 진행되어..." 같은 거짓말이나 억지 칭찬을 절대 하지 마세요! 사용자가 희망하지 않은 요일이면 시간대에 대한 언급 자체를 일체 하지 마세요!
   - 사용자가 '평일'을 희망했는데 액션 일정이 '주말'인 경우도 마찬가지로 시간대 언급을 일체 하지 마세요!
   - 액션의 실제 요일(actualSchedule)이 사용자의 '희망시간대'와 정확히 일치할 때만 시간대 장점을 언급할 수 있습니다.

4. ★★★ [조건 완화 시 진솔한 서술 원칙]:
   - 사용자의 희망 조건(환경, 시간대, 재능 등)과 액션의 실제 정보가 일치하지 않는 경우, 불일치하는 조건을 억지로 사용자에게 맞다고 지어내지 마세요.
   - 불일치하는 조건(환경, 시간대)은 일체 언급을 피하고, 일치하는 관심 분야나 액션 본연의 사회적 가치, 따뜻한 보람, 구체적 활동 내용만을 정직하게 서술하세요.

5. [세부 모집 항목(recruitmentItems) 역할 타겟팅]:
   - 액션의 recruitmentItems 중 사용자가 실제로 선택한 재능(matchedUserSkills)이나 역할에 부합하는 세부 파트가 있을 때만 구체적 파트명을 언급하세요.

6. [사용자 '상관없음' 선택 시 변명조 문구 금지]:
   - 사용자가 환경이나 규모, 시간을 '상관없음'으로 선택한 경우에는, '실내에서 진행되지만', '비록 ~이지만' 같은 변명조 문구를 절대 쓰지 마세요.

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
