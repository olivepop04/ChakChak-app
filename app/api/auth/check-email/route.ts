import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { emailExistsByPage } from '@/lib/auth/email-availability';
import { createAdminClient } from '@/lib/supabase/server';

const RequestSchema = z.object({
  email: z.string().trim().email().max(254),
});

const PAGE_SIZE = 200;
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;
const attempts = new Map<string, { count: number; resetAt: number }>();
/** 이 수를 넘으면 새 IP 가 들어올 때 만료 항목을 한 번 치웁니다. */
const SWEEP_THRESHOLD = 500;

function clientKey(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

/**
 * 창이 끝난 항목을 치웁니다.
 *
 * 이게 없으면 인스턴스가 사는 동안 찾아온 IP 마다 항목이 남아 계속 쌓입니다.
 * 새 IP 가 들어올 때만, 그것도 항목이 많을 때만 돌려서 평소에는 비용이 없습니다.
 */
function sweepExpired(now: number) {
  for (const [key, state] of attempts) {
    if (state.resetAt <= now) attempts.delete(key);
  }
}

function isRateLimited(key: string, now = Date.now()): boolean {
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    if (attempts.size > SWEEP_THRESHOLD) sweepExpired(now);
    attempts.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }

  current.count += 1;
  return current.count > RATE_LIMIT;
}

function json(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: NextRequest) {
  if (isRateLimited(clientKey(request))) {
    return json(
      { error: '요청이 너무 많아요. 잠시 후 다시 시도해주세요.' },
      429,
    );
  }

  const parsed = RequestSchema.safeParse(
    await request.json().catch(() => ({})),
  );
  if (!parsed.success) {
    return json({ error: '이메일 형식을 확인해주세요.' }, 400);
  }

  try {
    const admin = createAdminClient();
    const taken = await emailExistsByPage(parsed.data.email, async (page) => {
      const { data, error } = await admin.auth.admin.listUsers({
        page,
        perPage: PAGE_SIZE,
      });
      if (error) throw error;

      return {
        users: data.users,
        hasMore: data.users.length === PAGE_SIZE,
      };
    });

    return json({ taken });
  } catch (err) {
    // 서버 기록에 진짜 이유를 남깁니다 (13).
    //
    // 전에는 catch 가 오류를 통째로 삼켜서, 화면에는 안내 문구만 나오고
    // 원인이 어디에도 안 남았습니다. 성은님이 가입 테스트를 못 하셨는데
    // 이유를 찾는 데 한참 걸렸습니다.
    //
    // 사용자에게 보이는 문구는 그대로 둡니다 — 계정이 있는지 없는지를
    // 오류 메시지로 흘리면 안 되기 때문입니다.
    console.error('[check-email] 이메일 확인 실패:', err);
    return json(
      { error: '일시적인 오류로 이메일 중복 확인을 완료하지 못했어요. 잠시 후 다시 시도해주세요.' },
      503,
    );
  }
}
