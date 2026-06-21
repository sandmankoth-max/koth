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
      banned_fingerprints: {
        Row: {
          banned_at: string
          banned_by: string | null
          fp_hash: string
          reason: string | null
        }
        Insert: {
          banned_at?: string
          banned_by?: string | null
          fp_hash: string
          reason?: string | null
        }
        Update: {
          banned_at?: string
          banned_by?: string | null
          fp_hash?: string
          reason?: string | null
        }
        Relationships: []
      }
      banned_usernames: {
        Row: {
          banned_at: string
          banned_by: string | null
          reason: string | null
          username: string
        }
        Insert: {
          banned_at?: string
          banned_by?: string | null
          reason?: string | null
          username: string
        }
        Update: {
          banned_at?: string
          banned_by?: string | null
          reason?: string | null
          username?: string
        }
        Relationships: []
      }
      challenge_comments: {
        Row: {
          author_id: string
          body: string
          challenge_id: string
          created_at: string
          id: string
          like_count: number
          parent_id: string | null
          reply_count: number
          tagged_user_ids: string[]
        }
        Insert: {
          author_id: string
          body: string
          challenge_id: string
          created_at?: string
          id?: string
          like_count?: number
          parent_id?: string | null
          reply_count?: number
          tagged_user_ids?: string[]
        }
        Update: {
          author_id?: string
          body?: string
          challenge_id?: string
          created_at?: string
          id?: string
          like_count?: number
          parent_id?: string | null
          reply_count?: number
          tagged_user_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "challenge_comments_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "challenge_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string
          id: string
          max_video_seconds: number | null
          prize_first: number
          prize_second: number
          prize_third: number
          safety_note: string | null
          starts_at: string
          status: Database["public"]["Enums"]["challenge_status"]
          title: string
          unit_label: string
          unit_type: Database["public"]["Enums"]["challenge_unit"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at: string
          id?: string
          max_video_seconds?: number | null
          prize_first?: number
          prize_second?: number
          prize_third?: number
          safety_note?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["challenge_status"]
          title: string
          unit_label: string
          unit_type: Database["public"]["Enums"]["challenge_unit"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string
          id?: string
          max_video_seconds?: number | null
          prize_first?: number
          prize_second?: number
          prize_third?: number
          safety_note?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["challenge_status"]
          title?: string
          unit_label?: string
          unit_type?: Database["public"]["Enums"]["challenge_unit"]
        }
        Relationships: [
          {
            foreignKeyName: "challenges_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          kind: Database["public"]["Enums"]["comment_kind"]
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          kind: Database["public"]["Enums"]["comment_kind"]
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          kind?: Database["public"]["Enums"]["comment_kind"]
          user_id?: string
        }
        Relationships: []
      }
      device_fingerprints: {
        Row: {
          created_at: string
          fp_hash: string
          id: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          fp_hash: string
          id?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          fp_hash?: string
          id?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      device_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: Database["public"]["Enums"]["friendship_status"]
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: Database["public"]["Enums"]["friendship_status"]
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: Database["public"]["Enums"]["friendship_status"]
        }
        Relationships: [
          {
            foreignKeyName: "friendships_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          payload: Json
          read: boolean
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json
          read?: boolean
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          read?: boolean
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          age_consent_ack_at: string
          avatar_url: string | null
          banned: boolean
          banned_at: string | null
          banned_reason: string | null
          bio: string | null
          created_at: string
          date_of_birth: string
          display_name: string
          id: string
          username: string
        }
        Insert: {
          age_consent_ack_at?: string
          avatar_url?: string | null
          banned?: boolean
          banned_at?: string | null
          banned_reason?: string | null
          bio?: string | null
          created_at?: string
          date_of_birth: string
          display_name: string
          id: string
          username: string
        }
        Update: {
          age_consent_ack_at?: string
          avatar_url?: string | null
          banned?: boolean
          banned_at?: string | null
          banned_reason?: string | null
          bio?: string | null
          created_at?: string
          date_of_birth?: string
          display_name?: string
          id?: string
          username?: string
        }
        Relationships: []
      }
      results: {
        Row: {
          challenge_id: string
          created_at: string
          final_value: number
          id: string
          paid: boolean
          prize_amount: number
          rank: number
          tie_resolution:
            | Database["public"]["Enums"]["tie_resolution_kind"]
            | null
          user_id: string
        }
        Insert: {
          challenge_id: string
          created_at?: string
          final_value: number
          id?: string
          paid?: boolean
          prize_amount?: number
          rank: number
          tie_resolution?:
            | Database["public"]["Enums"]["tie_resolution_kind"]
            | null
          user_id: string
        }
        Update: {
          challenge_id?: string
          created_at?: string
          final_value?: number
          id?: string
          paid?: boolean
          prize_amount?: number
          rank?: number
          tie_resolution?:
            | Database["public"]["Enums"]["tie_resolution_kind"]
            | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "results_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          admin_verified_value: number | null
          challenge_id: string
          comment_count: number
          id: string
          is_active_entry: boolean
          like_count: number
          self_reported_value: number
          status: Database["public"]["Enums"]["submission_status"]
          submitted_at: string
          user_id: string
          video_path: string
          visibility: Database["public"]["Enums"]["submission_visibility"]
        }
        Insert: {
          admin_verified_value?: number | null
          challenge_id: string
          comment_count?: number
          id?: string
          is_active_entry?: boolean
          like_count?: number
          self_reported_value: number
          status?: Database["public"]["Enums"]["submission_status"]
          submitted_at?: string
          user_id: string
          video_path: string
          visibility?: Database["public"]["Enums"]["submission_visibility"]
        }
        Update: {
          admin_verified_value?: number | null
          challenge_id?: string
          comment_count?: number
          id?: string
          is_active_entry?: boolean
          like_count?: number
          self_reported_value?: number
          status?: Database["public"]["Enums"]["submission_status"]
          submitted_at?: string
          user_id?: string
          video_path?: string
          visibility?: Database["public"]["Enums"]["submission_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "submissions_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      video_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          like_count: number
          parent_id: string | null
          reply_count: number
          submission_id: string
          tagged_user_ids: string[]
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          like_count?: number
          parent_id?: string | null
          reply_count?: number
          submission_id: string
          tagged_user_ids?: string[]
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          like_count?: number
          parent_id?: string | null
          reply_count?: number
          submission_id?: string
          tagged_user_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "video_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "video_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_comments_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      video_likes: {
        Row: {
          created_at: string
          submission_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          submission_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          submission_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_likes_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_announce_winners:
        | {
            Args: {
              p_first_amount: number
              p_first_username: string
              p_note?: string
              p_second_amount: number
              p_second_username: string
              p_third_amount: number
              p_third_username: string
            }
            Returns: number
          }
        | {
            Args: {
              p_first_amount: number
              p_first_username: string
              p_headline?: string
              p_note?: string
              p_second_amount: number
              p_second_username: string
              p_third_amount: number
              p_third_username: string
            }
            Returns: number
          }
      admin_ban_user: {
        Args: { p_reason: string; p_user_id: string }
        Returns: undefined
      }
      admin_broadcast_notification: {
        Args: { p_message: string }
        Returns: number
      }
      admin_delete_submission: {
        Args: { p_submission_id: string }
        Returns: undefined
      }
      admin_disqualify_submission:
        | { Args: { p_submission_id: string }; Returns: undefined }
        | {
            Args: { p_reason?: string; p_submission_id: string }
            Returns: undefined
          }
      admin_restore_submission: {
        Args: { p_submission_id: string }
        Returns: undefined
      }
      admin_send_notification: {
        Args: { p_message: string; p_user_id: string }
        Returns: undefined
      }
      are_friends: { Args: { _a: string; _b: string }; Returns: boolean }
      can_view_submission: {
        Args: { _submission_id: string; _viewer: string }
        Returns: boolean
      }
      close_challenge: { Args: { p_challenge_id: string }; Returns: undefined }
      get_my_profile: {
        Args: never
        Returns: {
          age_consent_ack_at: string
          avatar_url: string | null
          banned: boolean
          banned_at: string | null
          banned_reason: string | null
          bio: string | null
          created_at: string
          date_of_birth: string
          display_name: string
          id: string
          username: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_fingerprint_banned: { Args: { _fp: string }; Returns: boolean }
      is_profane: { Args: { _text: string }; Returns: boolean }
      lifecycle_tick: { Args: never; Returns: Json }
      notify_rank_changes: {
        Args: { p_actor: string; p_challenge_id: string }
        Returns: undefined
      }
      username_exists: { Args: { _username: string }; Returns: boolean }
    }
    Enums: {
      app_role: "member" | "admin"
      challenge_status:
        | "upcoming"
        | "active"
        | "closed"
        | "archived"
        | "inactive"
      challenge_unit: "time_seconds" | "count_reps" | "custom"
      comment_kind: "video" | "challenge"
      friendship_status: "pending" | "accepted"
      notification_type:
        | "new_challenge"
        | "deadline_reminder"
        | "overtaken"
        | "podium_lost"
        | "podium_gained"
        | "time_verified"
        | "time_disqualified"
        | "deadline_reminder_24h"
        | "friend_request"
        | "friend_accepted"
        | "comment_video"
        | "reply_comment"
        | "tag_comment"
        | "like_video"
        | "like_comment"
        | "reply_challenge_comment"
        | "tag_challenge_comment"
        | "admin_message"
        | "winners_announcement"
      submission_status:
        | "pending_review"
        | "verified"
        | "flagged"
        | "disqualified"
      submission_visibility: "public" | "friends_only"
      tie_resolution_kind: "none" | "admin_broke_tie" | "split"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["member", "admin"],
      challenge_status: [
        "upcoming",
        "active",
        "closed",
        "archived",
        "inactive",
      ],
      challenge_unit: ["time_seconds", "count_reps", "custom"],
      comment_kind: ["video", "challenge"],
      friendship_status: ["pending", "accepted"],
      notification_type: [
        "new_challenge",
        "deadline_reminder",
        "overtaken",
        "podium_lost",
        "podium_gained",
        "time_verified",
        "time_disqualified",
        "deadline_reminder_24h",
        "friend_request",
        "friend_accepted",
        "comment_video",
        "reply_comment",
        "tag_comment",
        "like_video",
        "like_comment",
        "reply_challenge_comment",
        "tag_challenge_comment",
        "admin_message",
        "winners_announcement",
      ],
      submission_status: [
        "pending_review",
        "verified",
        "flagged",
        "disqualified",
      ],
      submission_visibility: ["public", "friends_only"],
      tie_resolution_kind: ["none", "admin_broke_tie", "split"],
    },
  },
} as const
