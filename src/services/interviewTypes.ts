/**
 * Pure interaction types for the interview engine.
 *
 * Extracted from interviewAgent.ts so client components and pure modules
 * can import these without touching the supabase-admin server-only chain.
 *
 * Everything here must remain side-effect-free and free of any server-only
 * imports (no supabase-admin, no next/server).
 */

import type { Phase, StepEntry, RawExtraction, OSlotField } from './interviewSemantic'

/** PROJ-46 (ADR-023 D1): why the Talker's binding target changed this turn — code-computed, per-turn ephemeral, never persisted. */
export type TransitionReason = 'step_switch' | 'closing_entry' | null

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
  /** Opening phrases the Talker already used — injected as avoidance list to prevent repetition */
  usedFillerPhrases?: string[]
  /** Last 4 assistant messages — used for question-stem repetition detection (KI-15). */
  recentAssistantTurns?: string[]
  /**
   * PROJ-46 (ADR-023 D3): this turn's O-Drought-locked step id (Fokus-Lock),
   * null when nothing is lockable (empty tracker, all exhausted, or closing).
   * Binding for the Talker's topic/target choice — see interviewOrchestrator.ts's
   * computeFocusLock.
   */
  focusStepId?: string | null
  /**
   * PROJ-46 (ADR-023 D1): code-computed reason the binding target changed this
   * turn — drives the Talker's transition-sentence guidance. See
   * interviewOrchestrator.ts's computeTransitionReason.
   */
  transitionReason?: TransitionReason
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
  /**
   * PROJ-43 (AC2): the direction captured live for this slot (SchemaSlotNumber.richtung),
   * carried onto the deterministically-built numeric SlotCards so the UI can render
   * direction-tailored buckets (clarificationBuckets.ts). Absent/null → generic buckets.
   */
  direction?: 'niedrig' | 'hoch' | null
}

export interface AnalystBriefing {
  /**
   * PROJ-46 (ADR-023 D1): the Analyst's chosen O2–O6 target field for the
   * currently focus-locked step — structured Absicht, never a formulated
   * question. LLM-chosen with a deterministic fallback (first empty O2–O6
   * field of the locked step) when the model omits it — see
   * interviewOrchestrator.ts's computeTargetOFieldFallback, injected into
   * interviewAnalyst.ts's runAnalyst. Replaces next_focus/suggested_question
   * (Invariante I1 — no briefing field can express a question, farewell, or
   * termination).
   */
  target_o_field?: OSlotField
  clarification_cards?: ClarificationCard[]
  /** Accumulated opening phrases the Talker has used — stored in next_briefing for cross-turn tracking */
  usedFillerPhrases?: string[]
  /**
   * PROJ-42 Advance-Signal, reframed by PROJ-46/ADR-023 D2: "ist der aktuelle
   * Prozessschritt für jetzt ausreichend erhoben" — advisory LLM-authored
   * content judgment (Analyst, via AnalystBriefingSchema), read by
   * resolveTurnLifecycle to progress Explore without relying on turn-count
   * thresholds. The deterministic Fortschritts-Boden (hasUnexhaustedStep) can
   * veto it — this is a hint, not a lifecycle driver. snake_case to match the
   * zod tool-call schema field verbatim.
   */
  step_advance_ready?: boolean
  /**
   * PROJ-46/ADR-024 (B/C, D1): the Analyst's own geguardetes Completion-
   * Readiness-Urteil — "Entdeckung erschöpft, die Person bietet nichts
   * Substanzielles mehr". LLM-authored (AnalystBriefingSchema), read by
   * resolveTurnLifecycle: explore+Guard opens Closing (stellt weiterhin
   * mindestens eine Entdeckungsfrage — nie im selben Turn abgeschlossen, da
   * ctx.phase zu diesem Zeitpunkt noch 'explore' ist), closing+Guard
   * schließt ab. A structured boolean, never a farewell/termination channel
   * (Invariante I1/I2 aus ADR-023 bleiben wahr) — the Talker still only says
   * goodbye once resolveTurnLifecycle has actually decided complete:true.
   * Replaces the removed noNewExtractionStreak safety net (ADR-024 D4).
   */
  discovery_exhausted?: boolean
  /**
   * PROJ-44 Remediation (M-1/M-3 shared primitive): deterministic O-field
   * drought state for the currently focus-locked step. Threaded through
   * next_briefing like usedFillerPhrases — see interviewOrchestrator.ts's
   * computeFocusLock/updateODrought.
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
