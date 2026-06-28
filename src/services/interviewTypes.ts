/**
 * Pure interaction types for the interview engine.
 *
 * Extracted from interviewAgent.ts so client components and pure modules
 * can import these without touching the supabase-admin server-only chain.
 *
 * Everything here must remain side-effect-free and free of any server-only
 * imports (no supabase-admin, no next/server).
 */

import type { MissingSlot } from './interviewSemantic'
import type { Phase, StepEntry } from './interviewSemantic'
import type { RawExtraction } from './extraction'

export interface InterviewContext {
  interviewId: string
  workspaceId: string
  employeeName: string
  employeeRole: string | null
  department: string
  focusTopics: string | null
  phase: Phase
  timerMinutes: number
  topicsCovered: string[]
  topicsOpen: string[]
  extractionsLog: RawExtraction[]
  maxDurationMinutes: number
  stepTracker: StepEntry[]
  missingSlotsForCoverageCheck?: MissingSlot[]
  /** Opening phrases the Talker already used — injected as avoidance list to prevent repetition */
  usedFillerPhrases?: string[]
  /** Last 4 assistant messages — used for drill-stop detection (F1). */
  recentAssistantTurns?: string[]
  /** Last user message — used for refuse-detect (F1b). */
  lastUserTurn?: string
  /** Last 4 user messages — used for laddering streak detection (E3.4). */
  recentUserTurns?: string[]
  /** KI-18: slots filled by quick-extract from THIS turn's input, before the Talker ran. */
  justFilledSlots?: MissingSlot[]
}

export interface TurnMessage {
  role: 'user' | 'assistant'
  content: string
}

// ─── Analyst Briefing types (used by Iteration 3 Analyst + Talker) ────────────

export interface ClarificationCard {
  process_step_id: string
  step_title: string
  question: string
  options: string[]
  slot_key: string
  answer_type?: 'single' | 'multi'
}

export interface AnalystBriefing {
  next_focus?: string
  suggested_question?: string
  wrap_up_question_asked?: boolean
  clarification_cards?: ClarificationCard[]
  /** Accumulated opening phrases the Talker has used — stored in next_briefing for cross-turn tracking */
  usedFillerPhrases?: string[]
}
