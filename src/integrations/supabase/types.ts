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
      activities: {
        Row: {
          building_id: string
          description: string
          id: string
          outreach_reason_used: string | null
          tenant_id: string
          timestamp: string
          title: string
          type: string
        }
        Insert: {
          building_id?: string
          description?: string
          id?: string
          outreach_reason_used?: string | null
          tenant_id: string
          timestamp?: string
          title?: string
          type: string
        }
        Update: {
          building_id?: string
          description?: string
          id?: string
          outreach_reason_used?: string | null
          tenant_id?: string
          timestamp?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      broker_assignments: {
        Row: {
          assigned_at: string
          broker_id: string
          broker_name: string
          building_id: string
          id: string
          tenant_id: string
        }
        Insert: {
          assigned_at?: string
          broker_id: string
          broker_name: string
          building_id: string
          id?: string
          tenant_id: string
        }
        Update: {
          assigned_at?: string
          broker_id?: string
          broker_name?: string
          building_id?: string
          id?: string
          tenant_id?: string
        }
        Relationships: []
      }
      cached_buildings: {
        Row: {
          address: string
          building_data: Json
          business_status: string
          fetched_at: string
          id: string
          lat: number
          lng: number
          name: string
          photo_url: string | null
          query_index: number
          rating: number | null
          rating_count: number
          types: string[]
        }
        Insert: {
          address?: string
          building_data?: Json
          business_status?: string
          fetched_at?: string
          id: string
          lat?: number
          lng?: number
          name: string
          photo_url?: string | null
          query_index?: number
          rating?: number | null
          rating_count?: number
          types?: string[]
        }
        Update: {
          address?: string
          building_data?: Json
          business_status?: string
          fetched_at?: string
          id?: string
          lat?: number
          lng?: number
          name?: string
          photo_url?: string | null
          query_index?: number
          rating?: number | null
          rating_count?: number
          types?: string[]
        }
        Relationships: []
      }
      cached_company_news: {
        Row: {
          citations: Json
          company_id: string
          company_name: string
          fetched_at: string
          id: string
          news_items: Json
        }
        Insert: {
          citations?: Json
          company_id: string
          company_name?: string
          fetched_at?: string
          id?: string
          news_items?: Json
        }
        Update: {
          citations?: Json
          company_id?: string
          company_name?: string
          fetched_at?: string
          id?: string
          news_items?: Json
        }
        Relationships: []
      }
      company_contacts: {
        Row: {
          created_at: string
          direct_phone: string | null
          email: string
          entity_id: string
          id: string
          mobile_phone: string | null
          name: string
          title: string
        }
        Insert: {
          created_at?: string
          direct_phone?: string | null
          email?: string
          entity_id: string
          id?: string
          mobile_phone?: string | null
          name: string
          title?: string
        }
        Update: {
          created_at?: string
          direct_phone?: string | null
          email?: string
          entity_id?: string
          id?: string
          mobile_phone?: string | null
          name?: string
          title?: string
        }
        Relationships: []
      }
      copilot_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id?: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      copilot_templates: {
        Row: {
          created_at: string
          id: string
          name: string
          original_filename: string
          parsed_structure: string
          template_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          original_filename?: string
          parsed_structure: string
          template_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          original_filename?: string
          parsed_structure?: string
          template_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      critical_dates: {
        Row: {
          acknowledged: boolean
          building_name: string
          created_at: string
          date_type: string
          date_value: string
          description: string
          id: string
          lease_abstract_id: string | null
          prospect_id: string | null
          prospect_name: string
          remind_days_before: number
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          acknowledged?: boolean
          building_name?: string
          created_at?: string
          date_type: string
          date_value: string
          description?: string
          id?: string
          lease_abstract_id?: string | null
          prospect_id?: string | null
          prospect_name?: string
          remind_days_before?: number
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          acknowledged?: boolean
          building_name?: string
          created_at?: string
          date_type?: string
          date_value?: string
          description?: string
          id?: string
          lease_abstract_id?: string | null
          prospect_id?: string | null
          prospect_name?: string
          remind_days_before?: number
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      custom_prospects: {
        Row: {
          address: string
          created_at: string
          enrichment: Json | null
          id: string
          name: string
          source: string
          updated_at: string
          website: string
        }
        Insert: {
          address?: string
          created_at?: string
          enrichment?: Json | null
          id?: string
          name: string
          source?: string
          updated_at?: string
          website?: string
        }
        Update: {
          address?: string
          created_at?: string
          enrichment?: Json | null
          id?: string
          name?: string
          source?: string
          updated_at?: string
          website?: string
        }
        Relationships: []
      }
      pipeline_deals: {
        Row: {
          building_id: string
          created_at: string
          id: string
          is_manual: boolean
          last_activity: string
          notes: string[]
          prospect_company: string | null
          prospect_email: string | null
          prospect_name: string | null
          prospect_phone: string | null
          prospect_sqft: number | null
          sent_touchpoints: Json
          sort_order: number
          stage: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          building_id: string
          created_at?: string
          id?: string
          is_manual?: boolean
          last_activity?: string
          notes?: string[]
          prospect_company?: string | null
          prospect_email?: string | null
          prospect_name?: string | null
          prospect_phone?: string | null
          prospect_sqft?: number | null
          sent_touchpoints?: Json
          sort_order?: number
          stage?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          building_id?: string
          created_at?: string
          id?: string
          is_manual?: boolean
          last_activity?: string
          notes?: string[]
          prospect_company?: string | null
          prospect_email?: string | null
          prospect_name?: string | null
          prospect_phone?: string | null
          prospect_sqft?: number | null
          sent_touchpoints?: Json
          sort_order?: number
          stage?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_initials: string
          created_at: string
          email: string
          full_name: string
          id: string
        }
        Insert: {
          avatar_initials?: string
          created_at?: string
          email?: string
          full_name?: string
          id: string
        }
        Update: {
          avatar_initials?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
        }
        Relationships: []
      }
      prospect_files: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          prospect_id: string
          uploaded_by: string
          uploaded_by_name: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number
          file_type?: string
          id?: string
          prospect_id: string
          uploaded_by: string
          uploaded_by_name?: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          prospect_id?: string
          uploaded_by?: string
          uploaded_by_name?: string
        }
        Relationships: []
      }
      prospect_owners: {
        Row: {
          claimed_at: string
          id: string
          owner_id: string
          owner_name: string
          prospect_id: string
        }
        Insert: {
          claimed_at?: string
          id?: string
          owner_id: string
          owner_name?: string
          prospect_id: string
        }
        Update: {
          claimed_at?: string
          id?: string
          owner_id?: string
          owner_name?: string
          prospect_id?: string
        }
        Relationships: []
      }
      scoop_comments: {
        Row: {
          author_avatar: string
          author_name: string
          content: string
          created_at: string
          id: string
          scoop_id: string
        }
        Insert: {
          author_avatar?: string
          author_name?: string
          content: string
          created_at?: string
          id?: string
          scoop_id: string
        }
        Update: {
          author_avatar?: string
          author_name?: string
          content?: string
          created_at?: string
          id?: string
          scoop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scoop_comments_scoop_id_fkey"
            columns: ["scoop_id"]
            isOneToOne: false
            referencedRelation: "scoops"
            referencedColumns: ["id"]
          },
        ]
      }
      scoop_likes: {
        Row: {
          created_at: string
          id: string
          scoop_id: string
          session_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          scoop_id: string
          session_id: string
        }
        Update: {
          created_at?: string
          id?: string
          scoop_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scoop_likes_scoop_id_fkey"
            columns: ["scoop_id"]
            isOneToOne: false
            referencedRelation: "scoops"
            referencedColumns: ["id"]
          },
        ]
      }
      scoop_verifications: {
        Row: {
          created_at: string
          id: string
          scoop_id: string
          session_id: string
          verifier_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          scoop_id: string
          session_id: string
          verifier_name: string
        }
        Update: {
          created_at?: string
          id?: string
          scoop_id?: string
          session_id?: string
          verifier_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "scoop_verifications_scoop_id_fkey"
            columns: ["scoop_id"]
            isOneToOne: false
            referencedRelation: "scoops"
            referencedColumns: ["id"]
          },
        ]
      }
      scoops: {
        Row: {
          author_avatar: string
          author_name: string
          category: Database["public"]["Enums"]["scoop_category"]
          comments_count: number
          content: string
          created_at: string
          id: string
          likes_count: number
          linked_building_id: string | null
          linked_building_name: string | null
          linked_tenant_id: string | null
          linked_tenant_name: string | null
          tags: string[]
          updated_at: string
          verified: boolean
        }
        Insert: {
          author_avatar?: string
          author_name?: string
          category?: Database["public"]["Enums"]["scoop_category"]
          comments_count?: number
          content: string
          created_at?: string
          id?: string
          likes_count?: number
          linked_building_id?: string | null
          linked_building_name?: string | null
          linked_tenant_id?: string | null
          linked_tenant_name?: string | null
          tags?: string[]
          updated_at?: string
          verified?: boolean
        }
        Update: {
          author_avatar?: string
          author_name?: string
          category?: Database["public"]["Enums"]["scoop_category"]
          comments_count?: number
          content?: string
          created_at?: string
          id?: string
          likes_count?: number
          linked_building_id?: string | null
          linked_building_name?: string | null
          linked_tenant_id?: string | null
          linked_tenant_name?: string | null
          tags?: string[]
          updated_at?: string
          verified?: boolean
        }
        Relationships: []
      }
      task_comments: {
        Row: {
          author_initials: string
          author_name: string
          content: string
          created_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          author_initials?: string
          author_name?: string
          content: string
          created_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          author_initials?: string
          author_name?: string
          content?: string
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_by: string | null
          assigned_to: string | null
          assigned_to_name: string
          building_id: string | null
          completed: boolean
          created_at: string
          description: string
          due_date: string
          id: string
          priority: string
          tenant_id: string | null
          title: string
          type: string
        }
        Insert: {
          assigned_by?: string | null
          assigned_to?: string | null
          assigned_to_name?: string
          building_id?: string | null
          completed?: boolean
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          priority?: string
          tenant_id?: string | null
          title: string
          type?: string
        }
        Update: {
          assigned_by?: string | null
          assigned_to?: string | null
          assigned_to_name?: string
          building_id?: string | null
          completed?: boolean
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          priority?: string
          tenant_id?: string | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          activity_categories: string
          brokerage: string
          calendar_connected: boolean
          copilot_memory: boolean
          created_at: string
          dark_mode: boolean
          default_market: string
          email_greeting: string
          email_signature: string
          email_tone: string
          id: string
          meeting_lead_weeks: string
          notify_new_scoops: boolean
          notify_pipeline_changes: boolean
          notify_task_reminders: boolean
          notify_weekly_digest: boolean
          phone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_categories?: string
          brokerage?: string
          calendar_connected?: boolean
          copilot_memory?: boolean
          created_at?: string
          dark_mode?: boolean
          default_market?: string
          email_greeting?: string
          email_signature?: string
          email_tone?: string
          id?: string
          meeting_lead_weeks?: string
          notify_new_scoops?: boolean
          notify_pipeline_changes?: boolean
          notify_task_reminders?: boolean
          notify_weekly_digest?: boolean
          phone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_categories?: string
          brokerage?: string
          calendar_connected?: boolean
          copilot_memory?: boolean
          created_at?: string
          dark_mode?: boolean
          default_market?: string
          email_greeting?: string
          email_signature?: string
          email_tone?: string
          id?: string
          meeting_lead_weeks?: string
          notify_new_scoops?: boolean
          notify_pipeline_changes?: boolean
          notify_task_reminders?: boolean
          notify_weekly_digest?: boolean
          phone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      scoop_category:
        | "lease_move"
        | "rfp"
        | "expansion"
        | "contraction"
        | "personnel"
        | "concession"
        | "conversion"
        | "general"
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
      scoop_category: [
        "lease_move",
        "rfp",
        "expansion",
        "contraction",
        "personnel",
        "concession",
        "conversion",
        "general",
      ],
    },
  },
} as const
