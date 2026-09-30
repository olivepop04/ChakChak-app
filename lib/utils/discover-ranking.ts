export interface AdaptiveScoringAnswers {
  talentPreference: 'use' | 'any' | null;
  groupSizePreference: 'small' | 'medium' | 'large' | 'any' | null;
  fieldPreference: 'familiar' | 'new' | 'any' | null;
  targetGroupPreference?: 'social' | 'task' | 'any' | null;
  difficultyPreference?: 'easy' | 'physical' | 'expert' | 'any' | null;
  activityTypePreference?: 'indoor' | 'outdoor' | 'both' | 'any' | null;
  selectedSkill?: string | null;
  selectedSkills?: string[];
  userKeywords?: string[];
}

export function sameProvince(
  address: string | null,
  preferredRegions: string[],
): boolean {
  const province = address?.trim().split(/\s+/)[0] ?? '';
  if (!province) return false;
  return preferredRegions.some(
    (region) => region.trim().split(/\s+/)[0] === province,
  );
}

export function scoreAdaptiveTraits({
  profileSkills,
  historyCategories,
  actionCategory,
  actionSkills,
  actionGroupSize,
  actionTargetGroups = [],
  actionDifficulty = null,
  actionActivityTypes = [],
  actionKeywords = [],
  actionParticipationModes = [],
  answers,
}: {
  profileSkills: string[];
  historyCategories: string[];
  actionCategory: string;
  actionSkills: string[];
  actionGroupSize: number | null;
  actionTargetGroups?: string[];
  actionDifficulty?: string | null;
  actionActivityTypes?: string[];
  actionKeywords?: string[];
  actionParticipationModes?: string[];
  answers: AdaptiveScoringAnswers;
}): { score: number; matched: string[] } {
  let score = 0;
  const matched: string[] = [];

  // 1) 재능 활용 (skills) — 5점 (전문 재능 매칭 시 부여)
  if (answers.talentPreference === 'use') {
    const userSelected =
      answers.selectedSkills && answers.selectedSkills.length > 0
        ? answers.selectedSkills.filter((s) => s !== '기타' && !s.includes('특별한 재능 없이'))
        : answers.selectedSkill && answers.selectedSkill !== '기타' && !answers.selectedSkill.includes('특별한 재능 없이')
          ? [answers.selectedSkill]
          : [];
    const candidateSkills = [
      ...userSelected,
      ...profileSkills,
    ];
    const sharedSkill = candidateSkills.find((skill) => actionSkills.includes(skill));
    if (sharedSkill) {
      score += 5;
      matched.push(`${sharedSkill} 재능 활용`);
    } else if (userSelected.length > 0) {
      const keywordHit = userSelected.find((userSkill) =>
        actionKeywords.some((k) => k.includes(userSkill) || userSkill.includes(k)),
      );
      if (keywordHit) {
        score += 5;
        matched.push(`${keywordHit} 재능 활용`);
      }
    }
  } else if (answers.talentPreference === 'any' || answers.selectedSkill === '기타' || answers.selectedSkills?.includes('기타')) {
    matched.push('재능 상관없이 참여 가능');
  }

  // 2) 모임 규모 (participation_modes / group_size) — 10점 (정규 반영)
  //
  // actionGroupSize(모집 항목의 실제 min/max에서 바로 계산됨, 항상 최신·정확함)가 있으면
  // 그것만 믿는다. actionParticipationModes(액션 등록 시 AI가 분류해 둔 라벨)는 항목이
  // 나중에 수정돼도 재분류 전까지 안 바뀌는 값이라 실제 인원수와 어긋날 수 있다 — 그걸
  // OR로 같이 믿으면, 예를 들어 실제로는 3~6명(소그룹)인 액션이 분류 라벨만 "10~20명
  // 중그룹"으로 남아있어서 중그룹으로도 매칭되는 일이 생겼다 (2026-09-30, 팀 테스트 피드백:
  // 실제 모집은 3~6명인데 추천 이유가 "10~20명 중그룹으로 진행되어"라고 설명한 사례).
  // actionGroupSize가 없을 때(예: 물품만 모집하는 액션)만 분류 라벨로 대신한다.
  if (answers.groupSizePreference) {
    const isSmall =
      actionGroupSize !== null
        ? actionGroupSize <= 10
        : actionParticipationModes.some((m) => m.includes('10명 이내') || m.includes('소그룹') || m.includes('소규모'));
    const isMedium =
      actionGroupSize !== null
        ? actionGroupSize > 10 && actionGroupSize <= 20
        : actionParticipationModes.some((m) => m.includes('10~20') || m.includes('중그룹') || m.includes('중규모'));
    const isLarge =
      actionGroupSize !== null
        ? actionGroupSize > 20
        : actionParticipationModes.some((m) => m.includes('20명 이상') || m.includes('대그룹') || m.includes('대규모'));

    if (answers.groupSizePreference === 'small' && isSmall) {
      score += 10;
      matched.push('10명 이내 소규모');
    } else if (answers.groupSizePreference === 'medium' && isMedium) {
      score += 10;
      matched.push('10~20명 중그룹');
    } else if (answers.groupSizePreference === 'large' && isLarge) {
      score += 10;
      matched.push('20명 이상 대그룹');
    } else if (answers.groupSizePreference === 'any') {
      score += 7;
      matched.push('규모 상관없음');
    }
  }

  // 3) 활동 성격 (target_groups) — 10점
  if (answers.targetGroupPreference) {
    const hasSocial = actionTargetGroups.some((g) =>
      /교류|교육|소통|말벗|멘토|상담|친구/.test(g),
    );
    const hasTask = actionTargetGroups.some((g) =>
      /과업|육체|집중|노동|땀|청소|플로깅|배달|제작|텃밭|수리/.test(g),
    );

    if (answers.targetGroupPreference === 'social' && hasSocial) {
      score += 10;
      matched.push('교류·소통형 활동');
    } else if (answers.targetGroupPreference === 'task' && hasTask) {
      score += 10;
      matched.push('과업·집중형 활동');
    } else if (answers.targetGroupPreference === 'any') {
      score += 7;
      matched.push('성격 상관없음');
    }
  }

  // 4) 참여 난이도 (difficulty) — 매칭 사유 반영 (배점은 '난이도 및 재능 5점'으로 skills에서 통합 평가하여 100점 만점 보장)
  if (answers.difficultyPreference) {
    const isEasy =
      actionDifficulty === '누구나 참여가능' ||
      actionDifficulty === '누구나' ||
      actionDifficulty === '쉬움';
    const isPhysical =
      actionDifficulty === '기초 체력 필요' ||
      actionDifficulty === '기초체력' ||
      actionDifficulty === '보통';
    const isExpert =
      actionDifficulty === '전문지식/자격/재능 활용' ||
      actionDifficulty === '전문지식·자격 필요' ||
      actionDifficulty === '전문지식' ||
      actionDifficulty === '어려움';

    if (answers.difficultyPreference === 'easy' && isEasy) {
      matched.push('부담 없는 난이도');
    } else if (answers.difficultyPreference === 'physical' && isPhysical) {
      matched.push('기초 체력 활동');
    } else if (answers.difficultyPreference === 'expert' && isExpert) {
      matched.push('전문·재능 활용');
    } else if (answers.difficultyPreference === 'any') {
      matched.push('난이도 상관없음');
    }
  }

  // 5) 활동 환경 (activity_types) — 10점
  if (answers.activityTypePreference) {
    const hasIndoor = actionActivityTypes.some((t) => /실내/.test(t));
    const hasOutdoor = actionActivityTypes.some((t) => /실외|야외/.test(t));
    const hasBoth = actionActivityTypes.some((t) => /병행/.test(t));

    if (answers.activityTypePreference === 'indoor' && (hasIndoor || hasBoth)) {
      score += 10;
      matched.push(hasBoth ? '실내외 병행 활동' : '실내 활동');
    } else if (answers.activityTypePreference === 'outdoor' && (hasOutdoor || hasBoth)) {
      score += 10;
      matched.push(hasBoth ? '실내외 병행 활동' : '야외 활동');
    } else if (answers.activityTypePreference === 'both' && (hasBoth || hasIndoor || hasOutdoor)) {
      score += 10;
      matched.push(hasBoth ? '실내외 병행 활동' : (hasIndoor ? '실내 활동' : '야외 활동'));
    } else if (answers.activityTypePreference === 'any') {
      score += 7;
      matched.push('환경 상관없음');
    }
  }

  return { score, matched };
}

export function totalGroupSize(
  items: Array<{
    type: string;
    min_required: number;
    max_allowed: number | null;
  }>,
): number | null {
  const people = items.filter((item) => item.type === 'PERSON');
  if (people.length === 0) return null;
  return people.reduce(
    (total, item) => total + (item.max_allowed ?? item.min_required),
    0,
  );
}
