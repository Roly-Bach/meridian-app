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
   * (resolveTurnLifecycle already decided complete=true, DB status is already
   * 'completed'). Suppresses the unconditional closing PFLICHT-ask-the-question-first
   * methodology text so the farewell turn actually says goodbye instead of re-asking
   * the closing probe or a new question.
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
  clarification_cards?: ClarificationCard[]
  /** Accumulated opening phrases the Talker has used — stored in next_briefing for cross-turn tracking */
  usedFillerPhrases?: string[]
  /**
   * PROJ-42 Advance-Signal: "ist der aktuelle Prozessschritt für jetzt ausreichend
   * erhoben" — LLM-authored content judgment (Analyst, via AnalystBriefingSchema),
   * read by resolveTurnLifecycle to progress Explore without relying on turn-count
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
  /**
   * PROJ-44 Remediation (M-1/M-3 shared primitive): deterministic O-field
   * drought state for the currently focus-locked step. Threaded through
   * next_briefing like noNewExtractionStreak/usedFillerPhrases — see
   * interviewOrchestrator.ts's computeFocusLock/updateODrought.
   */
  oDrought?: ODroughtState
}

/**
 * PROJ-44 Remediation (M-1/M-3 shared primitive): per-locked-step drought state
 * for O2–O6 fields (entscheidungslogik, tazite_cues, ausnahmen, inputs, outputs,
 * hilfsmittel, abhaengigkeiten — the substantial COVERAGE_FIELDS, excluding the
 * auto-filled O1 bezeichnung/reihenfolge). Deterministically computed in code
 * (not LLM-guessed). See interviewOrchestrator.ts's computeFocusLock/
 * updateODrought/hasUnexhaustedStep.
 */
export interface ODroughtState {
  /** The currently locked/active step's stable id (S001…), or null when none is lockable (empty tracker / all exhausted). */
  stepId: string | null
  /** Consecutive turns without a new O-field for stepId. */
  streak: number
  /** Step ids whose drought already fired this interview — never re-locked. */
  exhaustedStepIds: string[]
}
