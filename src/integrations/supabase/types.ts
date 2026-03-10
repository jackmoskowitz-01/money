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
