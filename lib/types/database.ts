export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      action_ai_metadata: {
        Row: {
          action_id: string
          activity_types: string[]
          ai_model: string
          categories: string[]
          difficulty: string | null
          generated_at: string
          keywords: string[]
          owner_confirmed: boolean
          participation_modes: string[]
          prompt_version: string
          skills: string[]
          target_groups: string[]
        }
        Insert: {
          action_id: string
          activity_types?: string[]
          ai_model: string
          categories?: string[]
          difficulty?: string | null
          generated_at?: string
          keywords?: string[]
          owner_confirmed?: boolean
          participation_modes?: string[]
          prompt_version: string
          skills?: string[]
          target_groups?: string[]
        }
        Update: {
          action_id?: string
          activity_types?: string[]
          ai_model?: string
          categories?: string[]
          difficulty?: string | null
          generated_at?: string
          keywords?: string[]
          owner_confirmed?: boolean
          participation_modes?: string[]
          prompt_version?: string
          skills?: string[]
          target_groups?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "action_ai_metadata_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: true
            referencedRelation: "action_social_counts"
            referencedColumns: ["action_id"]
          },
          {
            foreignKeyName: "action_ai_metadata_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: true
            referencedRelation: "actions"
            referencedColumns: ["id"]
          },
        ]
      }
      action_items: {
        Row: {
          action_id: string
          condition_desc: string | null
          condition_name: string | null
          created_at: string
          gender_requirement: string
          id: string
          max_allowed: number | null
          min_required: number
          name: string
          sort_order: number
          target_type: string
          type: string
          unit: string
        }
        Insert: {
          action_id: string
          condition_desc?: string | null
          condition_name?: string | null
          created_at?: string
          gender_requirement?: string
          id?: string
          max_allowed?: number | null
          min_required: number
          name: string
          sort_order?: number
          target_type: string
          type: string
          unit: string
        }
        Update: {
          action_id?: string
          condition_desc?: string | null
          condition_name?: string | null
          created_at?: string
          gender_requirement?: string
          id?: string
          max_allowed?: number | null
          min_required?: number
          name?: string
          sort_order?: number
          target_type?: string
          type?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_items_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "action_social_counts"
            referencedColumns: ["action_id"]
          },
          {
            foreignKeyName: "action_items_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["id"]
          },
        ]
      }
      action_results: {
        Row: {
          action_id: string
          content: string | null
          created_at: string
          id: string
          image_urls: string[]
          owner_voice: string | null
        }
        Insert: {
          action_id: string
          content?: string | null
          created_at?: string
          id?: string
          image_urls?: string[]
          owner_voice?: string | null
        }
        Update: {
          action_id?: string
          content?: string | null
          created_at?: string
          id?: string
          image_urls?: string[]
          owner_voice?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "action_results_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: true
            referencedRelation: "action_social_counts"
            referencedColumns: ["action_id"]
          },
          {
            foreignKeyName: "action_results_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: true
            referencedRelation: "actions"
            referencedColumns: ["id"]
          },
        ]
      }
      actions: {
        Row: {
          activity_end_at: string | null
          activity_start_at: string | null
          address: string | null
          cancel_reason: string | null
          categories: string[]
          category: string
          created_at: string
          description: string | null
          early_end_reason: string | null
          id: string
          image_urls: string[]
          notice: string | null
          owner_id: string
          place_name: string | null
          recruit_end_at: string | null
          review_feedback: Json | null
          status: string
          thumbnail_index: number
          title: string
          updated_at: string
        }
        Insert: {
          activity_end_at?: string | null
          activity_start_at?: string | null
          address?: string | null
          cancel_reason?: string | null
          categories: string[]
          category: string
          created_at?: string
          description?: string | null
          early_end_reason?: string | null
          id?: string
          image_urls?: string[]
          notice?: string | null
          owner_id: string
          place_name?: string | null
          recruit_end_at?: string | null
          review_feedback?: Json | null
          status?: string
          thumbnail_index?: number
          title: string
          updated_at?: string
        }
        Update: {
          activity_end_at?: string | null
          activity_start_at?: string | null
          address?: string | null
          cancel_reason?: string | null
          categories?: string[]
          category?: string
          created_at?: string
          description?: string | null
          early_end_reason?: string | null
          id?: string
          image_urls?: string[]
          notice?: string | null
          owner_id?: string
          place_name?: string | null
          recruit_end_at?: string | null
          review_feedback?: Json | null
          status?: string
          thumbnail_index?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "actions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_runs: {
        Row: {
          action_id: string | null
          agent_type: string
          created_at: string
          error_code: string | null
          id: string
          latency_ms: number | null
          model: string
          output_json: Json | null
          prompt_version: string
          status: string
          user_id: string | null
        }
        Insert: {
          action_id?: string | null
          agent_type: string
          created_at?: string
          error_code?: string | null
          id?: string
          latency_ms?: number | null
          model: string
          output_json?: Json | null
          prompt_version: string
          status: string
          user_id?: string | null
        }
        Update: {
          action_id?: string | null
          agent_type?: string
          created_at?: string
          error_code?: string | null
          id?: string
          latency_ms?: number | null
          model?: string
          output_json?: Json | null
          prompt_version?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_runs_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "action_social_counts"
            referencedColumns: ["action_id"]
          },
          {
            foreignKeyName: "ai_runs_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_runs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          action_id: string
          content: string
          created_at: string
          deleted_at: string | null
          id: string
          kind: string
          parent_id: string | null
          user_id: string
        }
        Insert: {
          action_id: string
          content: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          kind?: string
          parent_id?: string | null
          user_id: string
        }
        Update: {
          action_id?: string
          content?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          kind?: string
          parent_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "action_social_counts"
            referencedColumns: ["action_id"]
          },
          {
            foreignKeyName: "chat_messages_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_voices: {
        Row: {
          action_id: string
          content: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          action_id: string
          content: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          action_id?: string
          content?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crew_voices_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "action_social_counts"
            referencedColumns: ["action_id"]
          },
          {
            foreignKeyName: "crew_voices_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crew_voices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      likes: {
        Row: {
          action_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          action_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          action_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "action_social_counts"
            referencedColumns: ["action_id"]
          },
          {
            foreignKeyName: "likes_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_id: string | null
          body: string | null
          created_at: string
          event_key: string
          id: string
          is_read: boolean
          type: string
          user_id: string
        }
        Insert: {
          action_id?: string | null
          body?: string | null
          created_at?: string
          event_key: string
          id?: string
          is_read?: boolean
          type: string
          user_id: string
        }
        Update: {
          action_id?: string | null
          body?: string | null
          created_at?: string
          event_key?: string
          id?: string
          is_read?: boolean
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "action_social_counts"
            referencedColumns: ["action_id"]
          },
          {
            foreignKeyName: "notifications_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      participation_items: {
        Row: {
          action_item_id: string
          created_at: string
          id: string
          participation_id: string
          quantity: number
        }
        Insert: {
          action_item_id: string
          created_at?: string
          id?: string
          participation_id: string
          quantity: number
        }
        Update: {
          action_item_id?: string
          created_at?: string
          id?: string
          participation_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "participation_items_action_item_id_fkey"
            columns: ["action_item_id"]
            isOneToOne: false
            referencedRelation: "action_item_progress"
            referencedColumns: ["action_item_id"]
          },
          {
            foreignKeyName: "participation_items_action_item_id_fkey"
            columns: ["action_item_id"]
            isOneToOne: false
            referencedRelation: "action_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participation_items_participation_id_fkey"
            columns: ["participation_id"]
            isOneToOne: false
            referencedRelation: "participations"
            referencedColumns: ["id"]
          },
        ]
      }
      participations: {
        Row: {
          action_id: string
          created_at: string
          id: string
          left_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_id: string
          created_at?: string
          id?: string
          left_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_id?: string
          created_at?: string
          id?: string
          left_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "participations_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "action_social_counts"
            referencedColumns: ["action_id"]
          },
          {
            foreignKeyName: "participations_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          available_times: string[]
          avatar: string
          bio: string | null
          categories: string[]
          created_at: string
          gender: string
          id: string
          name: string
          nickname: string
          notify_off: string[]
          regions: string[]
          skills: string[] | null
          terms_agreed_at: string
          time_prefs: Json
          updated_at: string
        }
        Insert: {
          available_times?: string[]
          avatar: string
          bio?: string | null
          categories?: string[]
          created_at?: string
          gender: string
          id: string
          name: string
          nickname: string
          notify_off?: string[]
          regions?: string[]
          skills?: string[] | null
          terms_agreed_at?: string
          time_prefs?: Json
          updated_at?: string
        }
        Update: {
          available_times?: string[]
          avatar?: string
          bio?: string | null
          categories?: string[]
          created_at?: string
          gender?: string
          id?: string
          name?: string
          nickname?: string
          notify_off?: string[]
          regions?: string[]
          skills?: string[] | null
          terms_agreed_at?: string
          time_prefs?: Json
          updated_at?: string
        }
        Relationships: []
      }
      saves: {
        Row: {
          action_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          action_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          action_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saves_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "action_social_counts"
            referencedColumns: ["action_id"]
          },
          {
            foreignKeyName: "saves_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shares: {
        Row: {
          action_id: string
          created_at: string
          id: string
          target_id: string | null
          user_id: string
        }
        Insert: {
          action_id: string
          created_at?: string
          id?: string
          target_id?: string | null
          user_id: string
        }
        Update: {
          action_id?: string
          created_at?: string
          id?: string
          target_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shares_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "action_social_counts"
            referencedColumns: ["action_id"]
          },
          {
            foreignKeyName: "shares_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shares_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shares_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      action_item_progress: {
        Row: {
          action_id: string | null
          action_item_id: string | null
          current_count: number | null
          gender_requirement: string | null
          is_full: boolean | null
          is_min_met: boolean | null
          max_allowed: number | null
          min_required: number | null
          name: string | null
          target_type: string | null
          type: string | null
          unit: string | null
        }
        Relationships: [
          {
            foreignKeyName: "action_items_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "action_social_counts"
            referencedColumns: ["action_id"]
          },
          {
            foreignKeyName: "action_items_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["id"]
          },
        ]
      }
      action_social_counts: {
        Row: {
          action_id: string | null
          crew_count: number | null
          like_count: number | null
          save_count: number | null
          share_count: number | null
        }
        Insert: {
          action_id?: string | null
          crew_count?: never
          like_count?: never
          save_count?: never
          share_count?: never
        }
        Update: {
          action_id?: string | null
          crew_count?: never
          like_count?: never
          save_count?: never
          share_count?: never
        }
        Relationships: []
      }
    }
    Functions: {
      action_status: { Args: { a: string }; Returns: string }
      cancel_action: {
        Args: { p_action_id: string; p_reason: string }
        Returns: undefined
      }
      complete_action: { Args: { p_action_id: string }; Returns: undefined }
      delete_chat_message: {
        Args: { p_message_id: string }
        Returns: undefined
      }
      end_action_early: {
        Args: { p_action_id: string; p_reason: string }
        Returns: undefined
      }
      has_no_duplicate: { Args: { arr: string[] }; Returns: boolean }
      is_action_crew: { Args: { a: string }; Returns: boolean }
      is_action_member: { Args: { a: string }; Returns: boolean }
      is_action_owner: { Args: { a: string }; Returns: boolean }
      is_action_public: { Args: { a: string }; Returns: boolean }
      join_action: {
        Args: { p_action_id: string; p_items: Json }
        Returns: string
      }
      leave_action: { Args: { p_action_id: string }; Returns: undefined }
      leave_action_with_reason: {
        Args: { p_action_id: string; p_reason: string }
        Returns: undefined
      }
      notify_invite: {
        Args: { p_action_id: string; p_target: string }
        Returns: undefined
      }
      publish_action: { Args: { p_action_id: string }; Returns: undefined }
      submit_crew_voice: {
        Args: { p_action_id: string; p_content: string }
        Returns: undefined
      }
      sync_action_status: { Args: { p_action_id: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
