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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string
          credits_remaining: number
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          total_calls: number
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_remaining?: number
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name?: string
          total_calls?: number
          user_id: string
        }
        Update: {
          created_at?: string
          credits_remaining?: number
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          total_calls?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      api_usage_log: {
        Row: {
          api_key_id: string
          created_at: string
          id: string
          mode: string
          query: string
          tokens_used: number
        }
        Insert: {
          api_key_id: string
          created_at?: string
          id?: string
          mode?: string
          query: string
          tokens_used?: number
        }
        Update: {
          api_key_id?: string
          created_at?: string
          id?: string
          mode?: string
          query?: string
          tokens_used?: number
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_log_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address: string | null
          category: string
          city: string | null
          country: string
          created_at: string
          description: string | null
          email: string | null
          id: string
          inventory_csv_url: string | null
          is_verified: boolean
          logo_url: string | null
          member_discount_percent: number | null
          name: string
          owner_id: string
          phone: string | null
          state: string | null
          trust_score: number
          updated_at: string
          verified_at: string | null
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          category?: string
          city?: string | null
          country?: string
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          inventory_csv_url?: string | null
          is_verified?: boolean
          logo_url?: string | null
          member_discount_percent?: number | null
          name: string
          owner_id: string
          phone?: string | null
          state?: string | null
          trust_score?: number
          updated_at?: string
          verified_at?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          category?: string
          city?: string | null
          country?: string
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          inventory_csv_url?: string | null
          is_verified?: boolean
          logo_url?: string | null
          member_discount_percent?: number | null
          name?: string
          owner_id?: string
          phone?: string | null
          state?: string | null
          trust_score?: number
          updated_at?: string
          verified_at?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "businesses_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          message: string
          subject: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          message: string
          subject: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          message?: string
          subject?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          ai_response: string | null
          category: string
          created_at: string
          email: string
          full_name: string
          id: string
          message: string
          rating: number | null
        }
        Insert: {
          ai_response?: string | null
          category?: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          message: string
          rating?: number | null
        }
        Update: {
          ai_response?: string | null
          category?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          message?: string
          rating?: number | null
        }
        Relationships: []
      }
      knowledge_vault_items: {
        Row: {
          answer: string | null
          created_at: string
          id: string
          query: string
          sources: Json | null
          vault_id: string
        }
        Insert: {
          answer?: string | null
          created_at?: string
          id?: string
          query: string
          sources?: Json | null
          vault_id: string
        }
        Update: {
          answer?: string | null
          created_at?: string
          id?: string
          query?: string
          sources?: Json | null
          vault_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_vault_items_vault_id_fkey"
            columns: ["vault_id"]
            isOneToOne: false
            referencedRelation: "knowledge_vaults"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_vaults: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          name: string
          slug: string
          updated_at: string
          user_id: string
          view_count: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          name: string
          slug: string
          updated_at?: string
          user_id: string
          view_count?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          name?: string
          slug?: string
          updated_at?: string
          user_id?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_vaults_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      poi_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          id: string
          payload: Json
          query: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at?: string
          id?: string
          payload?: Json
          query: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          id?: string
          payload?: Json
          query?: string
        }
        Relationships: []
      }
      poi_points_log: {
        Row: {
          created_at: string
          id: string
          points: number
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          points: number
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          points?: number
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poi_points_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      poi_task_completions: {
        Row: {
          created_at: string
          id: string
          proof_data: Json | null
          status: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          proof_data?: Json | null
          status?: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          proof_data?: Json | null
          status?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poi_task_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "poi_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poi_task_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      poi_tasks: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          points_reward: number
          task_type: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          points_reward?: number
          task_type?: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          points_reward?: number
          task_type?: string
          title?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email_verified: boolean
          id: string
          is_premium: boolean
          lite_mode: boolean
          poi_points: number
          premium_since: string | null
          referral_code: string
          referred_by: string | null
          search_count: number
          signup_ip: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email_verified?: boolean
          id: string
          is_premium?: boolean
          lite_mode?: boolean
          poi_points?: number
          premium_since?: string | null
          referral_code?: string
          referred_by?: string | null
          search_count?: number
          signup_ip?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email_verified?: boolean
          id?: string
          is_premium?: boolean
          lite_mode?: boolean
          poi_points?: number
          premium_since?: string | null
          referral_code?: string
          referred_by?: string | null
          search_count?: number
          signup_ip?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_rewards: {
        Row: {
          activated_at: string
          expires_at: string
          id: string
          referral_batch: number
          reward_type: string
          user_id: string
        }
        Insert: {
          activated_at?: string
          expires_at?: string
          id?: string
          referral_batch: number
          reward_type?: string
          user_id: string
        }
        Update: {
          activated_at?: string
          expires_at?: string
          id?: string
          referral_batch?: number
          reward_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_rewards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          referred_id: string
          referrer_id: string
          status: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          referred_id: string
          referrer_id: string
          status?: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          referred_id?: string
          referrer_id?: string
          status?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      search_activity: {
        Row: {
          created_at: string
          id: string
          query: string
          search_mode: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          query: string
          search_mode?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          query?: string
          search_mode?: string
          user_id?: string | null
        }
        Relationships: []
      }
      shared_searches: {
        Row: {
          answer: string
          created_at: string
          id: string
          query: string
          search_mode: string
          slug: string
          sources: Json | null
          user_id: string | null
          view_count: number
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          query: string
          search_mode?: string
          slug: string
          sources?: Json | null
          user_id?: string | null
          view_count?: number
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          query?: string
          search_mode?: string
          slug?: string
          sources?: Json | null
          user_id?: string | null
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "shared_searches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trending_content: {
        Row: {
          category: string
          content: string
          created_at: string
          description: string
          id: string
          keywords: string[] | null
          slug: string
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          description: string
          id?: string
          keywords?: string[] | null
          slug: string
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          description?: string
          id?: string
          keywords?: string[] | null
          slug?: string
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: []
      }
      trending_searches: {
        Row: {
          created_at: string
          id: string
          last_searched_at: string
          query: string
          search_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          last_searched_at?: string
          query: string
          search_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          last_searched_at?: string
          query?: string
          search_count?: number
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          company: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          use_case: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          use_case?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          use_case?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      award_poi_points: {
        Args: { amount: number; point_reason: string; target_user_id: string }
        Returns: undefined
      }
      get_admin_user_stats: {
        Args: never
        Returns: {
          active_users: number
          inactive_users: number
          total_users: number
        }[]
      }
      get_admin_users_list: {
        Args: never
        Returns: {
          created_at: string
          display_name: string
          email_verified: boolean
          referral_code: string
          search_count: number
          signup_ip: string
          updated_at: string
          user_id: string
        }[]
      }
      get_referral_details: {
        Args: { referrer_uid: string }
        Returns: {
          created_at: string
          is_flagged: boolean
          referred_display_name: string
          referred_id: string
          referred_ip: string
          referrer_ip: string
          status: string
        }[]
      }
      increment_search_count: { Args: never; Returns: undefined }
      increment_shared_view: { Args: { search_id: string }; Returns: undefined }
      log_search_activity: {
        Args: { search_mode?: string; search_query: string }
        Returns: undefined
      }
      process_referral: {
        Args: { referral_code_input: string }
        Returns: boolean
      }
      update_signup_ip: { Args: { ip_address: string }; Returns: undefined }
      verify_referral: { Args: never; Returns: undefined }
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
    Enums: {},
  },
} as const
