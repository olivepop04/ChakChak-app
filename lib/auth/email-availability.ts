export interface EmailDirectoryUser {
  email?: string | null;
}

export interface EmailDirectoryPage {
  users: EmailDirectoryUser[];
  hasMore: boolean;
}

export type LoadEmailDirectoryPage = (
  page: number,
) => Promise<EmailDirectoryPage>;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Supabase Auth 사용자 목록에서 같은 이메일이 있는지 찾습니다.
 *
 * 이 함수는 서버 전용 API가 넘긴 목록만 읽습니다. 브라우저에는
 * service role key나 전체 사용자 목록이 전달되지 않습니다.
 */
export async function emailExistsByPage(
  email: string,
  loadPage: LoadEmailDirectoryPage,
  maxPages = 50,
): Promise<boolean> {
  const target = normalizeEmail(email);

  for (let page = 1; page <= maxPages; page += 1) {
    const result = await loadPage(page);
    if (
      result.users.some(
        (user) => user.email && normalizeEmail(user.email) === target,
      )
    ) {
      return true;
    }
    if (!result.hasMore) return false;
  }

  throw new Error('이메일 목록 확인 범위를 초과했습니다.');
}
