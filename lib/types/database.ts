/**
 * DB 타입.
 *
 * 지금은 손으로 적어 둔 것이다. Supabase 프로젝트를 만들고 스키마를 올린 뒤에는
 * 아래 명령으로 자동 생성한 내용으로 교체할 것. 손으로 고치지 말 것.
 *
 *   npx supabase gen types typescript --project-id <ID> > lib/types/database.ts
 *
 * 스키마를 바꾸면 이 파일도 다시 생성해야 한다.
 */
import type {
  Category,
  ActionStatus,
  ParticipationStatus,
  Gender,
  GenderRequirement,
  ItemType,
  TargetType,
  NotificationType,
} from '@/lib/constants';

export interface Profile {
  id: string;
  name: string;
  nickname: string;
  gender: Gender;
  bio: string | null;
  categories: string[];
  available_times: string[];
  regions: string[];
  terms_agreed_at: string;
  created_at: string;
  updated_at: string;
}

export interface Action {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  category: Category;
  image_urls: string[];
  thumbnail_index: number;
  address: string | null;
  notice: string | null;
  status: ActionStatus;
  cancel_reason: string | null;
  recruit_end_at: string | null;
  activity_start_at: string | null;
  activity_end_at: string | null;
  review_feedback: unknown | null;
  created_at: string;
  updated_at: string;
}

export interface ActionItem {
  id: string;
  action_id: string;
  type: ItemType;
  name: string;
  target_type: TargetType;
  min_required: number;
  max_allowed: number | null;
  unit: string;
  gender_requirement: GenderRequirement;
  condition_name: string | null;
  condition_desc: string | null;
  sort_order: number;
  created_at: string;
}

export interface Participation {
  id: string;
  action_id: string;
  user_id: string;
  status: ParticipationStatus;
  left_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParticipationItem {
  id: string;
  participation_id: string;
  action_item_id: string;
  quantity: number;
  created_at: string;
}

export interface ActionResult {
  id: string;
  action_id: string;
  content: string | null;
  image_urls: string[];
  owner_voice: string | null;
  created_at: string;
}

export interface CrewVoice {
  id: string;
  action_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  action_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  deleted_at: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  action_id: string | null;
  event_key: string;
  is_read: boolean;
  created_at: string;
}

export interface ActionAiMetadata {
  action_id: string;
  categories: string[];
  activity_types: string[];
  target_groups: string[];
  participation_modes: string[];
  skills: string[];
  keywords: string[];
  difficulty: string | null;
  ai_model: string;
  prompt_version: string;
  generated_at: string;
  owner_confirmed: boolean;
}

/** 뷰 — 항목별 진행 상황 (LEFT 참여 제외) */
export interface ActionItemProgress {
  action_item_id: string;
  action_id: string;
  type: ItemType;
  name: string;
  target_type: TargetType;
  min_required: number;
  max_allowed: number | null;
  unit: string;
  gender_requirement: GenderRequirement;
  current_count: number;
  is_full: boolean;
  is_min_met: boolean;
}

/** 뷰 — 좋아요/저장/참여 수. 개인정보 없이 숫자만. */
export interface ActionSocialCounts {
  action_id: string;
  like_count: number;
  save_count: number;
  crew_count: number;
}

type Row<T> = { Row: T; Insert: Partial<T>; Update: Partial<T> };

export interface Database {
  public: {
    Tables: {
      profiles: Row<Profile>;
      actions: Row<Action>;
      action_items: Row<ActionItem>;
      participations: Row<Participation>;
      participation_items: Row<ParticipationItem>;
      action_results: Row<ActionResult>;
      crew_voices: Row<CrewVoice>;
      chat_messages: Row<ChatMessage>;
      notifications: Row<Notification>;
      action_ai_metadata: Row<ActionAiMetadata>;
      follows: Row<{
        id: string;
        follower_id: string;
        following_id: string;
        created_at: string;
      }>;
      saves: Row<{
        id: string;
        user_id: string;
        action_id: string;
        created_at: string;
      }>;
      likes: Row<{
        id: string;
        user_id: string;
        action_id: string;
        created_at: string;
      }>;
    };
    Views: {
      action_item_progress: { Row: ActionItemProgress };
      action_social_counts: { Row: ActionSocialCounts };
    };
    Functions: {
      join_action: {
        Args: { p_action_id: string; p_items: unknown };
        Returns: string;
      };
      leave_action: { Args: { p_action_id: string }; Returns: undefined };
      submit_crew_voice: {
        Args: { p_action_id: string; p_content: string };
        Returns: undefined;
      };
      delete_chat_message: { Args: { p_message_id: string }; Returns: undefined };
      publish_action: { Args: { p_action_id: string }; Returns: undefined };
      complete_action: { Args: { p_action_id: string }; Returns: undefined };
      cancel_action: {
        Args: { p_action_id: string; p_reason: string };
        Returns: undefined;
      };
      sync_action_status: { Args: { p_action_id: string }; Returns: string };
      notify_invite: {
        Args: { p_action_id: string; p_target: string };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
  };
}
