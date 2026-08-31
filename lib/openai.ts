/**
 * AI 호출 공통 함수.
 *
 * 원칙 (팀 합의)
 *  - AI 응답은 Zod 스키마를 통과해야만 사용한다.
 *  - 잘못된 JSON 이면 한 번 재시도하고, 그래도 실패하면 안전한 오류를 던진다.
 *  - LLM 이 SQL 을 만들지 않는다. 허용된 필터 JSON 만 만들고 서버가 검증한다.
 *  - 실행 결과와 프롬프트 버전을 ai_runs 에 남긴다. (발표의 "검증·개선" 근거)
 *  - API 키나 비밀번호는 절대 로그에 남기지 않는다.
 *
 * 서버에서만 부를 것. 클라이언트 컴포넌트에서 import 하면 키가 노출된다.
 */
import 'server-only';
import OpenAI from 'openai';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/server';

export const AI_MODEL = 'gpt-4o-mini';

export type AgentType = 'REVIEW' | 'CLASSIFY' | 'DISCOVER' | 'TRENDS';

let client: OpenAI | null = null;
function getClient() {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY 가 설정되지 않았습니다.');
    client = new OpenAI({ apiKey });
  }
  return client;
}

/** Agent 별 temperature — 분류/검수는 낮게, 설명 생성은 조금 높게 */
export const TEMPERATURE: Record<AgentType, number> = {
  REVIEW: 0.2,
  CLASSIFY: 0.2,
  DISCOVER: 0.2,
  TRENDS: 0.4,
};

/**
 * 스키마 타입(S)에서 결과 타입을 뽑아냅니다.
 * z.ZodSchema<T> 로 받으면 .default() 를 쓴 필드가 optional 로 추론되어
 * 호출하는 쪽에서 "undefined 일 수 있음" 오류가 납니다.
 */
interface CallOptions<S extends z.ZodTypeAny> {
  agent: AgentType;
  promptVersion: string;
  system: string;
  user: string;
  schema: S;
  temperature?: number;
  maxTokens?: number;
  /** 로그용. 없으면 생략된다 */
  userId?: string | null;
  actionId?: string | null;
}

export class AIError extends Error {
  constructor(
    message: string,
    public code: 'SCHEMA_FAIL' | 'API_FAIL',
  ) {
    super(message);
    this.name = 'AIError';
  }
}

export async function callStructuredAI<S extends z.ZodTypeAny>(
  opts: CallOptions<S>,
): Promise<z.infer<S>> {
  const {
    agent,
    promptVersion,
    system,
    user,
    schema,
    temperature = TEMPERATURE[agent],
    maxTokens = 1000,
    userId = null,
    actionId = null,
  } = opts;

  const startedAt = Date.now();
  let lastError: unknown = null;
  let status: 'SUCCESS' | 'SCHEMA_FAIL' | 'API_FAIL' | 'RETRY_OK' = 'API_FAIL';

  // 1회 재시도
  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      const res = await getClient().chat.completions.create({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
      });

      const text = res.choices[0]?.message?.content ?? '';
      const parsed = schema.parse(JSON.parse(text));

      status = attempt === 0 ? 'SUCCESS' : 'RETRY_OK';
      await logRun({
        agent,
        promptVersion,
        status,
        output: parsed,
        latency: Date.now() - startedAt,
        userId,
        actionId,
      });
      return parsed;
    } catch (err) {
      lastError = err;
      if (attempt === 1) {
        const isSchema = err instanceof z.ZodError || err instanceof SyntaxError;
        status = isSchema ? 'SCHEMA_FAIL' : 'API_FAIL';

        await logRun({
          agent,
          promptVersion,
          status,
          output: null,
          latency: Date.now() - startedAt,
          userId,
          actionId,
          errorCode: isSchema ? 'INVALID_JSON' : 'API_ERROR',
        });

        throw new AIError(
          isSchema
            ? 'AI 응답을 이해하지 못했어요. 잠시 후 다시 시도해주세요.'
            : 'AI 처리 중 문제가 생겼어요. 잠시 후 다시 시도해주세요.',
          isSchema ? 'SCHEMA_FAIL' : 'API_FAIL',
        );
      }
    }
  }

  throw lastError;
}

/** 로그 실패가 본 기능을 막으면 안 된다. 조용히 넘어간다. */
async function logRun(row: {
  agent: AgentType;
  promptVersion: string;
  status: string;
  output: unknown;
  latency: number;
  userId: string | null;
  actionId: string | null;
  errorCode?: string;
}) {
  try {
    const admin = createAdminClient();
    await admin.from('ai_runs').insert({
      agent_type: row.agent,
      prompt_version: row.promptVersion,
      model: AI_MODEL,
      output_json: row.output as never,
      status: row.status,
      error_code: row.errorCode ?? null,
      latency_ms: row.latency,
      user_id: row.userId,
      action_id: row.actionId,
    } as never);
  } catch {
    // 로그는 부가 기능이다. 실패해도 무시한다.
  }
}

// ── Agent #1 미디어 검수 응답 스키마 ────────────────────────────────
export const ReviewSchema = z.object({
  decision: z.enum(['PASS', 'REVISE', 'BLOCK']),
  hard_errors: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  suggestions: z.array(z.string()).default([]),
  questions: z.array(z.string()).default([]),
});
export type ReviewResult = z.infer<typeof ReviewSchema>;

// ── Agent #3 Discover 필터 스키마 (LLM 은 이 JSON 만 만든다) ──────────
export const DiscoverFilterSchema = z.object({
  categories: z.array(z.string()).default([]),
  participation_modes: z.array(z.string()).default([]),
  regions: z.array(z.string()).default([]),
  available_days: z.array(z.string()).default([]),
});
export type DiscoverFilter = z.infer<typeof DiscoverFilterSchema>;
