/**
 * 코드가 찾은 것과 AI 가 찾은 것을 하나의 검수 결과로 합칩니다.
 *
 * 왜 따로 뺐나 —
 * 검수 결과는 호스트가 액션을 공개하기 직전에 보는 마지막 화면입니다.
 * 여기서 같은 말이 세 번 겹쳐 보이면 "고칠 게 많구나" 싶어 손을 놓게 됩니다.
 * 겹치지 않게 하는 규칙은 조용히 깨지기 쉬워서, 순수 함수로 빼고
 * `tests/review-result.test.ts` 가 지키게 했습니다. (2026-09-09)
 */

export interface ReviewLike {
  decision: 'PASS' | 'REVISE' | 'BLOCK';
  hard_errors: string[];
  warnings: string[];
  suggestions: string[];
  questions: string[];
}

/**
 * 코드가 이미 짚은 것.
 *
 * 프롬프트로도 "이미 알려준 것은 다시 쓰지 말라" 고 일러두었지만
 * 모델이 종종 무시합니다 (2026-09-09 실측). 시연 도중에 모델 순응도에
 * 기대지 않으려고 코드로 확정합니다.
 */
export interface CodeWarning {
  /** 이 낱말이 든 AI 문장은 겹친 것으로 봅니다 */
  topic: string;
  message: string;
  /**
   * AI 의 suggestions 까지 지울지.
   *
   * 주소는 주소 검색으로 고르는 것이라 AI 가 대신 써줄 수 없어 지웁니다.
   * 제목은 AI 가 제안한 문장을 그대로 가져다 쓸 수 있으니 남깁니다.
   */
  dropSuggestions: boolean;
}

/** 코드가 이미 짚은 주제를 다시 말하는 AI 문장을 걸러냅니다 */
export function withoutRepeats(sentences: string[], topics: string[]): string[] {
  if (topics.length === 0) return sentences;
  return sentences.filter((s) => !topics.some((t) => s.includes(t)));
}

/**
 * AI 결과에 코드가 찾은 것을 얹습니다.
 *
 * - 코드가 짚은 것이 있으면 PASS 로 넘어가지 않습니다.
 *   장소가 "파주" 뿐인데 통과하면 「UI 및 기획 수정 4」 25쪽 문제가 되돌아옵니다.
 * - 코드 문장을 앞에 두고, 같은 주제를 되풀이하는 AI 문장은 지웁니다.
 * - BLOCK 은 그대로 둡니다. 막아야 할 것을 완화하지 않습니다.
 */
export function applyCodeFindings(ai: ReviewLike, codeWarnings: CodeWarning[]): ReviewLike {
  const messages = codeWarnings.map((w) => w.message);
  const topics = codeWarnings.map((w) => w.topic);
  const suggestionTopics = codeWarnings
    .filter((w) => w.dropSuggestions)
    .map((w) => w.topic);

  return {
    decision:
      ai.decision === 'PASS' && codeWarnings.length > 0 ? 'REVISE' : ai.decision,
    hard_errors: ai.hard_errors,
    warnings: [...new Set([...messages, ...withoutRepeats(ai.warnings, topics)])],
    suggestions: withoutRepeats(ai.suggestions, suggestionTopics),
    questions: withoutRepeats(ai.questions, topics),
  };
}
