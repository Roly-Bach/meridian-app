// Minimal Supabase table types — generated manually from the migration schema.
// Replace with full generated types from `supabase gen types typescript` when available.

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string
          name: string
          hourly_rate: number
          user_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          hourly_rate?: number
          user_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          hourly_rate?: number
          user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          workspace_id: string
          user_id: string
          joined_at: string
        }
        Insert: {
          workspace_id: string
          user_id: string
          joined_at?: string | null
        }
        Update: {
          workspace_id?: string
          user_id?: string
          joined_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      interviews: {
        Row: {
          id: string
          workspace_id: string
          employee_name: string
          employee_role: string | null
          department: string
          focus_topics: string | null
          status: 'created' | 'active' | 'completed'
          access_token: string
          token_expires_at: string
          extractions_pending: boolean
          max_duration_minutes: number
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          employee_name: string
          employee_role?: string | null
          department: string
          focus_topics?: string | null
          status?: 'created' | 'active' | 'completed'
          access_token: string
          token_expires_at: string
          extractions_pending?: boolean
          max_duration_minutes?: number
          created_at?: string
        }
        Update: {
          status?: 'created' | 'active' | 'completed'
          extractions_pending?: boolean
          max_duration_minutes?: number
        }
        Relationships: []
      }
      interview_state: {
        Row: {
          interview_id: string
          phase: 'intro' | 'process_loop' | 'coverage_check' | 'wrap_up'
          timer_minutes: number
          topics_covered: string[]
          topics_open: string[]
          extractions_log: Json
          step_tracker: Json
          updated_at: string
        }
        Insert: {
          interview_id: string
          phase?: 'intro' | 'process_loop' | 'coverage_check' | 'wrap_up'
          timer_minutes?: number
          topics_covered?: string[]
          topics_open?: string[]
          extractions_log?: Json
          step_tracker?: Json
          updated_at?: string
        }
        Update: {
          interview_id?: string
          phase?: 'intro' | 'process_loop' | 'coverage_check' | 'wrap_up'
          timer_minutes?: number
          topics_covered?: string[]
          topics_open?: string[]
          extractions_log?: Json
          step_tracker?: Json
          updated_at?: string
        }
        Relationships: []
      }
      turns: {
        Row: {
          id: string
          interview_id: string
          turn_number: number
          user_input: string
          agent_response: string
          created_at: string
        }
        Insert: {
          id?: string
          interview_id: string
          turn_number: number
          user_input: string
          agent_response: string
          created_at?: string
        }
        Update: {
          agent_response?: string
        }
        Relationships: []
      }
      process_steps: {
        Row: {
          id: string
          interview_id: string
          workspace_id: string
          title: string
          description: string | null
          role: string | null
          frequency_per_month: number | null
          duration_minutes: number | null
          data_sources: string[]
          rule_based: boolean
          error_rate_percent: number | null
          media_breaks: number
          source_quote: string | null
          created_at: string
        }
        Insert: {
          id?: string
          interview_id: string
          workspace_id: string
          title: string
          description?: string | null
          role?: string | null
          frequency_per_month?: number | null
          duration_minutes?: number | null
          data_sources?: string[]
          rule_based?: boolean
          error_rate_percent?: number | null
          media_breaks?: number
          source_quote?: string | null
          created_at?: string
        }
        Update: {
          title?: string
          description?: string | null
          role?: string | null
          frequency_per_month?: number | null
          duration_minutes?: number | null
          data_sources?: string[]
          rule_based?: boolean
          error_rate_percent?: number | null
          media_breaks?: number
          source_quote?: string | null
        }
        Relationships: []
      }
      use_cases: {
        Row: {
          id: string
          process_step_id: string
          workspace_id: string
          type: string
          title: string
          description: string | null
          reasoning: string | null
          priority: 'high' | 'medium' | 'low' | null
          roi_hours_per_year: number | null
          roi_eur_per_year: number | null
          effort: 'low' | 'medium' | 'high' | null
          score: number | null
          quarter: string | null
          created_at: string
        }
        Insert: {
          id?: string
          process_step_id: string
          workspace_id: string
          type: string
          title: string
          description?: string | null
          reasoning?: string | null
          priority?: 'high' | 'medium' | 'low' | null
          roi_hours_per_year?: number | null
          roi_eur_per_year?: number | null
          effort?: 'low' | 'medium' | 'high' | null
          score?: number | null
          quarter?: string | null
          created_at?: string
        }
        Update: {
          title?: string
          description?: string | null
          reasoning?: string | null
        }
        Relationships: []
      }
      knowledge_objects: {
        Row: {
          id: string
          interview_id: string
          workspace_id: string
          type: 'process_step' | 'tool' | 'pain_point' | 'role' | 'fact' | 'contact'
          content: Record<string, unknown>
          source_quote: string | null
          turn_id: string | null
          embedding: number[] | null
          created_at: string
        }
        Insert: {
          id?: string
          interview_id: string
          workspace_id: string
          type: 'process_step' | 'tool' | 'pain_point' | 'role' | 'fact' | 'contact'
          content: Record<string, unknown>
          source_quote?: string | null
          turn_id?: string | null
          embedding?: unknown
          created_at?: string
        }
        Update: {
          content?: Record<string, unknown>
          source_quote?: string | null
          embedding?: unknown
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
