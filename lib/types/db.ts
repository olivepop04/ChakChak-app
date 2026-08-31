/**
 * DB 행 타입에 짧은 이름을 붙여 둔 것.
 *
 * `lib/types/database.ts` 는 아래 명령으로 자동 생성되는 파일이라
 * 스키마를 바꿀 때마다 통째로 덮어써집니다. 그래서 손으로 아무것도 적지 않습니다.
 *
 *   npx supabase gen types typescript --project-id <ID> > lib/types/database.ts
 *
 * 대신 여기서 별칭만 뽑아 씁니다. 이 파일은 덮어써지지 않습니다.
 *
 * 사용:
 *   import type { ActionRow, ProfileRow } from '@/lib/types/db';
 */
import type { Database } from '@/lib/types/database';

type Tables = Database['public']['Tables'];
type Views = Database['public']['Views'];

export type ProfileRow = Tables['profiles']['Row'];
export type ActionRow = Tables['actions']['Row'];
export type ActionItemRow = Tables['action_items']['Row'];
export type ParticipationRow = Tables['participations']['Row'];
export type ParticipationItemRow = Tables['participation_items']['Row'];
export type ActionResultRow = Tables['action_results']['Row'];
export type CrewVoiceRow = Tables['crew_voices']['Row'];
export type ChatMessageRow = Tables['chat_messages']['Row'];
export type NotificationRow = Tables['notifications']['Row'];
export type ActionAiMetadataRow = Tables['action_ai_metadata']['Row'];
export type FollowRow = Tables['follows']['Row'];
export type SaveRow = Tables['saves']['Row'];
export type LikeRow = Tables['likes']['Row'];
export type AiRunRow = Tables['ai_runs']['Row'];

/**
 * 뷰 타입 주의 — 컬럼이 전부 `| null` 입니다.
 *
 * Postgres 는 뷰의 NOT NULL 여부를 보장하지 못해서, 원본 테이블이 NOT NULL 이어도
 * 생성된 타입은 nullable 이 됩니다. 실제 값이 비는 일은 없지만
 * 타입 검사는 통과해야 하므로 `?? 기본값` 으로 받으세요.
 *
 * 이미 `lib/queries/` 에서 처리해 두었으니, 화면에서는 신경 쓰지 않아도 됩니다.
 */
export type ActionItemProgressRow = Views['action_item_progress']['Row'];
export type ActionSocialCountsRow = Views['action_social_counts']['Row'];

/** 삽입용 타입 (필수 컬럼만 필수) */
export type ActionInsert = Tables['actions']['Insert'];
export type ActionItemInsert = Tables['action_items']['Insert'];
export type ActionResultInsert = Tables['action_results']['Insert'];
