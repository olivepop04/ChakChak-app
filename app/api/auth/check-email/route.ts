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

function clientKey(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function isRateLimited(key: string, now = Date.now()): boolean {
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
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
  } catch {
    return json(
      { error: '이메일을 확인하지 못했어요. 잠시 후 다시 시도해주세요.' },
      503,
    );
  }
}
