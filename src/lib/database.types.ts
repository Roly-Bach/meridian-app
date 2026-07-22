// Minimal Supabase table types — updated for PROJ-24 (use_cases enrichment).
// Uses interface format (no __InternalSupabase) to preserve existing type-check strictness.

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
            foreignKeyName: 'workspace_members_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'workspace_members_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
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
          analyst_status: string
          next_briefing: Json | null
          clarification_answers: Json | null
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
          analyst_status?: string
          next_briefing?: Json | null
          clarification_answers?: Json | null
        }
        Update: {
          status?: 'created' | 'active' | 'completed'
          extractions_pending?: boolean
          max_duration_minutes?: number
          analyst_status?: string
          next_briefing?: Json | null
          clarification_answers?: Json | null
        }
        Relationships: []
      }
      interview_state: {
        Row: {
          interview_id: string
          phase: 'intro' | 'explore' | 'closing' | 'clarification'
          timer_minutes: number
          topics_covered: string[]
          topics_open: string[]
          extractions_log: Json
          step_tracker: Json
          updated_at: string
          opener_text: string | null
        }
        Insert: {
          interview_id: string
          phase?: 'intro' | 'explore' | 'closing' | 'clarification'
          timer_minutes?: number
          topics_covered?: string[]
          topics_open?: string[]
          extractions_log?: Json
          step_tracker?: Json
          updated_at?: string
          opener_text?: string | null
        }
        Update: {
          interview_id?: string
          phase?: 'intro' | 'explore' | 'closing' | 'clarification'
          timer_minutes?: number
          topics_covered?: string[]
          topics_open?: string[]
          extractions_log?: Json
          step_tracker?: Json
          updated_at?: string
          opener_text?: string | null
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
      process_clusters: {
        Row: {
          id: string
          workspace_id: string
          canonical_title: string
          canonical_description: string | null
          participant_count: number
          participants: Json
          representative_embedding: number[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          canonical_title: string
          canonical_description?: string | null
          participant_count?: number
          participants?: Json
          representative_embedding?: number[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          canonical_title?: string
          canonical_description?: string | null
          participant_count?: number
          participants?: Json
          representative_embedding?: number[] | null
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: 'process_clusters_workspace_id_fkey'; columns: ['workspace_id']; referencedRelation: 'workspaces'; referencedColumns: ['id'] }
        ]
      }
      process_steps: {
        Row: {
          id: string
          interview_id: string
          workspace_id: string
          cluster_id: string | null
          title: string
          description: string | null
          source_quote: string | null
          step_type: 'action' | 'decision'
          condition_text: string | null
          substeps: Json | null
          embedding: number[] | null
          /** PROJ-45 (ADR-025 D1): full StepEntry object verbatim — same shape as interview_state.step_tracker entries. Replaces the 10 dropped legacy flat columns. */
          schritt_daten: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          interview_id: string
          workspace_id: string
          cluster_id?: string | null
          title: string
          description?: string | null
          source_quote?: string | null
          step_type?: 'action' | 'decision'
          condition_text?: string | null
          substeps?: Json | null
          embedding?: number[] | null
          schritt_daten?: Json | null
          created_at?: string
        }
        Update: {
          title?: string
          description?: string | null
          source_quote?: string | null
          step_type?: 'action' | 'decision'
          condition_text?: string | null
          substeps?: Json | null
          embedding?: number[] | null
          cluster_id?: string | null
          schritt_daten?: Json | null
        }
        Relationships: [
          { foreignKeyName: 'process_steps_interview_id_fkey'; columns: ['interview_id']; referencedRelation: 'interviews'; referencedColumns: ['id'] },
          { foreignKeyName: 'process_steps_cluster_id_fkey'; columns: ['cluster_id']; isOneToOne: false; referencedRelation: 'process_clusters'; referencedColumns: ['id'] }
        ]
      }
      knowledge_objects: {
        Row: {
          id: string
          workspace_id: string
          interview_id: string
          turn_id: string | null
          type: string
          content: Json
          source_quote: string | null
          embedding: number[] | null
          existing_count: number
          last_seen_at: string
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          interview_id: string
          turn_id?: string | null
          type: string
          content?: Json | Record<string, unknown>
          source_quote?: string | null
          embedding?: number[] | null
          existing_count?: number
          last_seen_at?: string
          created_at?: string
        }
        Update: {
          type?: string
          content?: Json
          source_quote?: string | null
          embedding?: number[] | null
          existing_count?: number
          last_seen_at?: string
        }
        Relationships: []
      }
      use_cases: {
        Row: {
          id: string
          workspace_id: string
          type: string
          title: string
          description: string | null
          reasoning: string | null
          effort: 'low' | 'medium' | 'high' | null
          priority: 'low' | 'medium' | 'high' | null
          roi_hours_per_year: number | null
          roi_eur_per_year: number | null
          roi_breakdown: Json | null
          score: number | null
          quarter: string | null
          process_step_id: string | null
          cluster_id: string | null
          llm_insights: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          type: string
          title: string
          description?: string | null
          reasoning?: string | null
          effort?: 'low' | 'medium' | 'high' | null
          priority?: 'low' | 'medium' | 'high' | null
          roi_hours_per_year?: number | null
          roi_eur_per_year?: number | null
          roi_breakdown?: Json | null
          score?: number | null
          quarter?: string | null
          process_step_id?: string | null
          cluster_id?: string | null
          llm_insights?: Json | null
          created_at?: string
        }
        Update: {
          type?: string
          title?: string
          description?: string | null
          reasoning?: string | null
          effort?: 'low' | 'medium' | 'high' | null
          priority?: 'low' | 'medium' | 'high' | null
          roi_hours_per_year?: number | null
          roi_eur_per_year?: number | null
          roi_breakdown?: Json | null
          score?: number | null
          quarter?: string | null
          process_step_id?: string | null
          cluster_id?: string | null
          llm_insights?: Json | null
        }
        Relationships: []
      }
    }
    Views: {}
    Functions: {
      match_process_cluster: {
        Args: {
          query_embedding: string
          similarity_threshold?: number
          workspace_id: string
        }
        Returns: {
          cluster_id: string
          similarity: number
        }[]
      }
      search_knowledge_objects: {
        Args: {
          match_count?: number
          object_type?: string
          query_embedding: string
          similarity_threshold?: number
          workspace_id: string
        }
        Returns: {
          content: Json
          id: string
          interview_id: string
          similarity: number
          source_quote: string
          type: string
        }[]
      }
    }
    Enums: {}
    CompositeTypes: {}
  }
}
