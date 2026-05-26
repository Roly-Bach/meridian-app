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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      interview_state: {
        Row: {
          extractions_log: Json
          interview_id: string
          phase: string
          step_tracker: Json
          timer_minutes: number
          topics_covered: string[]
          topics_open: string[]
          updated_at: string
        }
        Insert: {
          extractions_log?: Json
          interview_id: string
          phase?: string
          step_tracker?: Json
          timer_minutes?: number
          topics_covered?: string[]
          topics_open?: string[]
          updated_at?: string
        }
        Update: {
          extractions_log?: Json
          interview_id?: string
          phase?: string
          step_tracker?: Json
          timer_minutes?: number
          topics_covered?: string[]
          topics_open?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_state_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: true
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      interviews: {
        Row: {
          access_token: string
          created_at: string
          department: string
          employee_name: string
          employee_role: string | null
          extractions_pending: boolean
          focus_topics: string | null
          id: string
          max_duration_minutes: number
          status: string
          token_expires_at: string
          workspace_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          department: string
          employee_name: string
          employee_role?: string | null
          extractions_pending?: boolean
          focus_topics?: string | null
          id?: string
          max_duration_minutes?: number
          status?: string
          token_expires_at: string
          workspace_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          department?: string
          employee_name?: string
          employee_role?: string | null
          extractions_pending?: boolean
          focus_topics?: string | null
          id?: string
          max_duration_minutes?: number
          status?: string
          token_expires_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interviews_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_objects: {
        Row: {
          content: Json
          created_at: string
          embedding: string | null
          existing_count: number
          id: string
          interview_id: string
          last_seen_at: string
          source_quote: string | null
          turn_id: string | null
          type: string
          workspace_id: string
        }
        Insert: {
          content?: Json
          created_at?: string
          embedding?: string | null
          existing_count?: number
          id?: string
          interview_id: string
          last_seen_at?: string
          source_quote?: string | null
          turn_id?: string | null
          type: string
          workspace_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          embedding?: string | null
          existing_count?: number
          id?: string
          interview_id?: string
          last_seen_at?: string
          source_quote?: string | null
          turn_id?: string | null
          type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_objects_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_objects_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: false
            referencedRelation: "turns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_objects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      process_clusters: {
        Row: {
          canonical_description: string | null
          canonical_title: string
          created_at: string
          id: string
          participant_count: number
          participants: Json
          representative_embedding: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          canonical_description?: string | null
          canonical_title: string
          created_at?: string
          id?: string
          participant_count?: number
          participants?: Json
          representative_embedding?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          canonical_description?: string | null
          canonical_title?: string
          created_at?: string
          id?: string
          participant_count?: number
          participants?: Json
          representative_embedding?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_clusters_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      process_steps: {
        Row: {
          cluster_id: string | null
          condition_text: string | null
          created_at: string
          data_sources: string[]
          description: string | null
          duration_minutes: number | null
          embedding: string | null
          error_rate_percent: number | null
          frequency_per_month: number | null
          id: string
          interview_id: string
          media_breaks: number
          role: string | null
          rule_based: boolean
          source_quote: string | null
          step_type: string
          substeps: Json | null
          title: string
          workspace_id: string
        }
        Insert: {
          cluster_id?: string | null
          condition_text?: string | null
          created_at?: string
          data_sources?: string[]
          description?: string | null
          duration_minutes?: number | null
          embedding?: string | null
          error_rate_percent?: number | null
          frequency_per_month?: number | null
          id?: string
          interview_id: string
          media_breaks?: number
          role?: string | null
          rule_based?: boolean
          source_quote?: string | null
          step_type?: string
          substeps?: Json | null
          title: string
          workspace_id: string
        }
        Update: {
          cluster_id?: string | null
          condition_text?: string | null
          created_at?: string
          data_sources?: string[]
          description?: string | null
          duration_minutes?: number | null
          embedding?: string | null
          error_rate_percent?: number | null
          frequency_per_month?: number | null
          id?: string
          interview_id?: string
          media_breaks?: number
          role?: string | null
          rule_based?: boolean
          source_quote?: string | null
          step_type?: string
          substeps?: Json | null
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_steps_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "process_clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_steps_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_steps_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      turns: {
        Row: {
          agent_response: string
          created_at: string
          id: string
          interview_id: string
          turn_number: number
          user_input: string
        }
        Insert: {
          agent_response: string
          created_at?: string
          id?: string
          interview_id: string
          turn_number: number
          user_input: string
        }
        Update: {
          agent_response?: string
          created_at?: string
          id?: string
          interview_id?: string
          turn_number?: number
          user_input?: string
        }
        Relationships: [
          {
            foreignKeyName: "turns_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      use_cases: {
        Row: {
          created_at: string
          description: string | null
          effort: string | null
          id: string
          priority: string | null
          process_step_id: string
          quarter: string | null
          reasoning: string | null
          roi_eur_per_year: number | null
          roi_hours_per_year: number | null
          score: number | null
          title: string
          type: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          effort?: string | null
          id?: string
          priority?: string | null
          process_step_id: string
          quarter?: string | null
          reasoning?: string | null
          roi_eur_per_year?: number | null
          roi_hours_per_year?: number | null
          score?: number | null
          title: string
          type: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          effort?: string | null
          id?: string
          priority?: string | null
          process_step_id?: string
          quarter?: string | null
          reasoning?: string | null
          roi_eur_per_year?: number | null
          roi_hours_per_year?: number | null
          score?: number | null
          title?: string
          type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "use_cases_process_step_id_fkey"
            columns: ["process_step_id"]
            isOneToOne: false
            referencedRelation: "process_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "use_cases_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          joined_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          joined_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          joined_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          hourly_rate: number
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hourly_rate?: number
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          hourly_rate?: number
          id?: string
          name?: string
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
