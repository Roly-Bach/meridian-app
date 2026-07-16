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
import type { Phase, StepEntry, RawExtraction } from './interviewSemantic'

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
  /**
   * KI-19: set only by the scripted completion/farewell call in runInterviewTurn.ts
   * (checkLifecycle already decided shouldComplete=true, DB status is already
   * 'completed'). Suppresses the unconditional wrap_up PFLICHT-ask-the-question-first
   * methodology text so the farewell turn actually says goodbye instead of re-asking
   * the wrap-up probe or a new question.
   */
  isCompletionFarewell?: boolean
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
  /**
   * PROJ-42 Advance-Signal: "ist der aktuelle Prozessschritt für jetzt ausreichend
   * erhoben" — LLM-authored content judgment (Analyst, via AnalystBriefingSchema),
   * read by decideNextPhase to progress Explore without relying on turn-count
   * thresholds. snake_case to match the zod tool-call schema field verbatim
   * (same convention as next_focus/suggested_question/clarification_cards).
   */
  step_advance_ready?: boolean
  /**
   * PROJ-42 No-New-Extraction-Zähler: deterministically computed in code (NOT by
   * the LLM) from whether the analyst pass made any knowledge-tool calls this
   * turn. Threaded through the same next_briefing bridge as usedFillerPhrases.
   * Safety-net escalation to 'closing' when this reaches the configured limit.
   */
  noNewExtractionStreak?: number
}
