/**
 * Pure conversation-signal analysis for the interview engine.
 *
 * Deep module (PROJ-35 / ADR-017): exposes a single entry point
 * `analyzeConversationSignals(ctx, briefing) → Signals` that composes the
 * seven internal detectors. The detectors themselves are private — tested
 * through the public surface.
 *
 * No server-only chain: no supabase-admin, no next/server imports.
 */

import type { InterviewContext, AnalystBriefing } from './interviewTypes'
import type { StepEntry, TaziteSlot, TaziteSlotArray, PotenzialSlotName, TaziteSlotName } from './interviewSemantic'

// ─── Public types ─────────────────────────────────────────────────────────────

/** Conflicting factual statements detected in the current user turn. */
export type AmbiguityResult = { phraseA: string; phraseB: string } | null

export interface Signals {
  /** Numbers from briefing.suggested_question — anchoring-prevention guard. */
  anchorNumbers: string[]
  /** Slot-drill warnings (F1): slot targeted too many times without a value. */
  drillWarnings: string[]
  /** Conflicting factual statements (E3.1). */
  ambiguity: AmbiguityResult
  /** Exception / special-case signal detected in last user turn (E3.2). */
  exception: boolean
  /** Re-contextualization was used in recent assistant turns (E3.2 cap). */
  recentlyRecontextualized: boolean
  /** Consecutive blockade turns from the end of recentUserTurns (E3.4). */
  ladderingStreak: number
  /** Current user turn is a blockade (D1: direct single-turn signal). */
  blockade: boolean
}

// ─── Private: Drill-Stop (F1 / F1b) ──────────────────────────────────────────

type DrillSlotKind = 'duration_minutes' | 'frequency_per_month' | 'error_rate_percent' | 'entscheidungslogik'

const DRILL_PATTERNS: Record<DrillSlotKind, RegExp> = {
  duration_minutes: /(minuten|stunden|wie lange|wie viel(?:e)? zeit|wie viel(?:e)? tag|dauer|aufwand|aufwendest)/i,
  frequency_per_month: /(wie oft|häufigkeit|anzahl|wie viele.*(rechnung|fall|konten|posten|vorgäng|tickets|aufträge)|pro (woche|monat|tag))/i,
  error_rate_percent: /(fehlerquote|fehleranteil|prozent.*(fehler|unstimmig|korrektur)|wie hoch.*anteil.*fehler|anteil.*korrigier)/i,
  entscheidungslogik: /(immer.*gleich(en)?.*schema|festes schema|nach.*regel(werk)?|von fall zu fall|wenn-dann|strengen.*regeln|entscheidungslogik)/i,
}

// F1b: detect persona-refuse patterns.
const REFUSE_PATTERNS: RegExp[] = [
  /kann ich (nicht|keine|kein|nichts|hier|dazu)?\s*\b(exakt|präzise|genau|nennen|beziffern|sagen|angeben)\b/i,
  /lässt sich (nicht|keine|kein|kaum)?\s*(pauschal|allgemein|exakt|präzise|verlässlich|genau)?\s*(beziffern|festlegen|nennen|sagen|bestimmen|erfassen)/i,
  /keine (exakte|präzise|verlässliche|allgemeingültige|allgemein\s*gültige|statistische|starre|pauschale|feste) (zahl|minutenzahl|prozentzahl|stundenzahl|angabe|erfassung|auswertung|aussage|aufzeichnung)/i,
  /schwer zu (sagen|beziffern|nennen|bestimmen|schätzen)/i,
  /variiert (stark|sehr|deutlich|monatlich|erheblich)/i,
  /(hängt|abhängig).*(stark|maßgeblich|unmittelbar)/i,
  /führe ich keine (statistik|aufzeichnung|erfassung)/i,
  /habe ich (keine|dazu keine|hierzu keine|leider keine)/i,
  /liegt mir (keine|hierzu keine|dazu keine)/i,
  /nicht in (einer|eine) (festen?|starren?) (stunden|minuten|zeit)/i,
]

function detectPersonaRefuse(text: string | undefined): boolean {
  if (!text) return false
  return REFUSE_PATTERNS.some(p => p.test(text))
}

function detectDrillStops(
  recentAssistantTurns: string[] | undefined,
  stepTracker: StepEntry[],
  lastUserTurn?: string,
): string[] {
  if (!recentAssistantTurns || recentAssistantTurns.length === 0) return []
  const lastFour = recentAssistantTurns.slice(-4)
  const counts: Record<DrillSlotKind, number> = {
    duration_minutes: 0,
    frequency_per_month: 0,
    error_rate_percent: 0,
    entscheidungslogik: 0,
  }
  for (const turn of lastFour) {
    for (const kind of Object.keys(DRILL_PATTERNS) as DrillSlotKind[]) {
      if (DRILL_PATTERNS[kind].test(turn)) counts[kind] += 1
    }
  }

  // Active step = the one currently being walked through (walkthrough > exploring).
  const activeStep =
    stepTracker.find(s => s.status === 'walkthrough') ??
    stepTracker.find(s => s.status === 'exploring')
  if (!activeStep) return []

  // F1b: when persona refused on last turn, threshold drops to 1 — early skip.
  const refused = detectPersonaRefuse(lastUserTurn)
  const threshold = refused ? 1 : 2

  const warnings: string[] = []
  for (const kind of Object.keys(counts) as DrillSlotKind[]) {
    // Check correct location: potenzial for quant slots, slots for tazite
    const slotVal = kind === 'duration_minutes' || kind === 'frequency_per_month' || kind === 'error_rate_percent'
      ? activeStep.potenzial[kind as PotenzialSlotName]
      : activeStep.slots[kind as TaziteSlotName]
    const slotEmpty = slotVal == null || (
      typeof slotVal === 'object' && 'value' in slotVal && slotVal.value == null &&
      // slot is empty only when value=null AND no nicht_befund_typ set (PROJ-28: SlotValue now also carries nicht_befund_typ)
      (!('nicht_befund_typ' in slotVal) || (slotVal as TaziteSlot).nicht_befund_typ == null)
    )
    if (counts[kind] >= threshold && slotEmpty) {
      const reason = refused
        ? `Mitarbeiter hat im letzten Turn ausgewichen (Refuse-Pattern erkannt)`
        : `${counts[kind]}× in den letzten ${lastFour.length} Turns nachgefragt ohne Wert`
      warnings.push(
        `Slot "${kind}" für Schritt "${activeStep.title}": ${reason}. NICHT erneut fragen — Slot bleibt offen, Clarification Card am Ende erfasst ihn. Wechsle SOFORT zu einem anderen Slot/Schritt.`,
      )
    }
  }
  return warnings
}

// ─── Private: Ambiguity (E3.1) ───────────────────────────────────────────────

const CONTRA_PATTERNS: RegExp[] = [
  /eigentlich (doch|schon|nicht|kein)/i,
  /obwohl (ich|wir) (vorhin|gerade|eben)/i,
  /nein[,\s]+warte/i,
  /oder doch[\s,?]/i,
  /halt nein/i,
]

// B2 fix: extract capitalized concepts explicitly negated in prior turns.
const NEGATED_CONCEPT_RE = /\bkein[e]?\s+([A-ZÄÖÜ][a-zäöüß]+(?:[A-Z][a-z]+)*)/gi

function extractNegatedConcepts(turns: string[]): Map<string, string> {
  const result: Map<string, string> = new Map()
  for (const turn of turns) {
    const re = new RegExp(NEGATED_CONCEPT_RE.source, 'gi')
    let m: RegExpExecArray | null
    while ((m = re.exec(turn)) !== null) {
      const concept = m[1].toLowerCase()
      if (concept.length >= 3) result.set(concept, m[0])
    }
  }
  return result
}

function detectAmbiguity(
  lastUserTurn: string | undefined,
  stepTracker: StepEntry[],
  priorUserTurns?: string[],
): AmbiguityResult {
  if (!lastUserTurn) return null

  // Explicit contradiction markers — extract surrounding phrase fragments
  for (const p of CONTRA_PATTERNS) {
    const m = lastUserTurn.match(p)
    if (m && m.index !== undefined) {
      const before = lastUserTurn.slice(Math.max(0, m.index - 60), m.index).trim()
      const after = lastUserTurn.slice(m.index, Math.min(lastUserTurn.length, m.index + 80)).trim()
      if (before.length > 3 && after.length > 3) return { phraseA: before, phraseB: after }
    }
  }

  // Numeric conflict: compare current turn numbers against captured slot values
  const activeStep =
    stepTracker.find(s => s.status === 'walkthrough') ??
    stepTracker.find(s => s.status === 'exploring')
  if (activeStep) {
    const currentNums = extractNumericTokens(lastUserTurn)
      .map(Number)
      .filter(n => !isNaN(n) && n > 0)

    if (currentNums.length > 0) {
      const durationSlot = activeStep.potenzial.duration_minutes
      if (durationSlot?.value != null && typeof durationSlot.value === 'number' && durationSlot.value > 0) {
        for (const n of currentNums) {
          const ratio = Math.max(n, durationSlot.value) / Math.min(n, durationSlot.value)
          if (ratio >= 3 && n !== durationSlot.value) {
            return {
              phraseA: `${durationSlot.value} Minuten (erfasst)`,
              phraseB: `${n} (aktuelle Aussage)`,
            }
          }
        }
      }

      const freqSlot = activeStep.potenzial.frequency_per_month
      if (freqSlot?.value != null && typeof freqSlot.value === 'number' && freqSlot.value > 0) {
        for (const n of currentNums) {
          const ratio = Math.max(n, freqSlot.value) / Math.min(n, freqSlot.value)
          if (ratio >= 3 && n !== freqSlot.value) {
            return {
              phraseA: `${freqSlot.value}× pro Monat (erfasst)`,
              phraseB: `${n} (aktuelle Aussage)`,
            }
          }
        }
      }
    }
  }

  // B2 fix: negation contradiction — concept denied in prior turns, mentioned positively now
  if (priorUserTurns && priorUserTurns.length > 0) {
    const negated = extractNegatedConcepts(priorUserTurns)
    for (const [concept, negPhrase] of negated) {
      // Positive mention: concept appears without an immediately preceding negation
      const posRe = new RegExp(`(?<!kein[e]?\\s)\\b${concept}[a-zäöüß]*\\b`, 'i')
      if (posRe.test(lastUserTurn)) {
        const posMatch = lastUserTurn.match(new RegExp(`\\b${concept}[a-zäöüß]*\\b`, 'i'))
        return {
          phraseA: negPhrase,
          phraseB: posMatch?.[0] ?? concept,
        }
      }
    }
  }

  return null
}

// ─── Private: Exception (E3.2) ───────────────────────────────────────────────

const EXCEPTION_PATTERNS: RegExp[] = [
  /\b(manchmal|gelegentlich|ab und zu|hin und wieder)\b/i,
  /\baußer wenn\b/i,
  /\bim sonderfall\b/i,
  /\bwenn .{1,40} (dann|nicht)\b/i,
  /\bnicht immer\b/i,
  /\bin (manchen|bestimmten|einigen) fällen\b/i,
  /\b(ausnahme|ausnahmsweise|ausnahmen)\b/i,
  /\babhängig (davon|ob|von)\b/i,
]

function detectException(lastUserTurn: string | undefined): boolean {
  if (!lastUserTurn) return false
  return EXCEPTION_PATTERNS.some(p => p.test(lastUserTurn))
}

// ─── Private: Re-contextualization cap (E3.2) ────────────────────────────────

const RECONTEXT_ASSISTANT_PATTERNS: RegExp[] = [
  /lass uns (zurück|noch einmal|wieder).*(kommen|schauen|gehen)/i,
  /kommen wir (zurück|noch einmal) zu/i,
  /zurück zu (deiner|unserem|dem|dieser)/i,
  /wir hatten noch nicht gesprochen über/i,
  /lass mich.*(erinnern|zurückkommen)/i,
  /aber eigentlich wollte ich noch/i,
]

function wasRecentlyRecontextualized(recentAssistantTurns: string[] | undefined): boolean {
  if (!recentAssistantTurns || recentAssistantTurns.length === 0) return false
  // Check last 3 assistant turns for re-contextualization language
  return recentAssistantTurns.slice(-3).some(t =>
    RECONTEXT_ASSISTANT_PATTERNS.some(p => p.test(t)),
  )
}

// ─── Private: Blockade (E3.4) ────────────────────────────────────────────────

const BLOCKADE_PATTERNS: RegExp[] = [
  /\b(weiß ich nicht|weiß nicht genau|weiß (das|es) nicht)\b/i,
  /\bkeine ahnung\b/i,
  /\bist halt so\b/i,
  /\bimmer schon so\b/i,
  /\bschwer zu sagen\b/i,
  /\b(kann ich|kann man) (so nicht|nicht) sagen\b/i,
  /\bda fragst du (mich|uns) zu viel\b/i,
  /\bkann ich nicht sagen\b/i,
]

function detectBlockade(lastUserTurn: string | undefined): boolean {
  if (!lastUserTurn) return false
  const words = lastUserTurn.trim().split(/\s+/).filter(w => w.length > 0)
  if (words.length < 10) return true
  return BLOCKADE_PATTERNS.some(p => p.test(lastUserTurn))
}

function computeLadderingStreak(recentUserTurns: string[] | undefined): number {
  if (!recentUserTurns || recentUserTurns.length === 0) return 0
  let streak = 0
  for (const turn of [...recentUserTurns].reverse()) {
    if (detectBlockade(turn)) streak++
    else break
  }
  return streak
}

// ─── Public: extractNumericTokens (shared util) ───────────────────────────────

/**
 * Pt7: Extract standalone numeric tokens from a string.
 * Used to detect analyst-extracted numbers in briefing.suggested_question
 * so the Talker can be warned not to re-quote them (anchoring prevention).
 * Also used by detectNumberAnchoring in interviewTalker.
 */
export function extractNumericTokens(text: string): string[] {
  const matches = text.match(/\b\d+(?:[.,]\d+)?\b/g) ?? []
  return [...new Set(matches)]
}

// ─── Public: analyzeConversationSignals ──────────────────────────────────────

/**
 * Single entry point for all conversation-signal analysis (PROJ-35 / ADR-017).
 * Interface 9→1: composes the seven detectors and maps results to `Signals`.
 *
 * Field mapping (verhaltensneutral — replicates previous inline calls in buildDynamicContext):
 * - anchorNumbers ← extractNumericTokens(briefing?.suggested_question ?? '')
 * - drillWarnings ← detectDrillStops(ctx.recentAssistantTurns, ctx.stepTracker, ctx.lastUserTurn)
 * - ambiguity     ← detectAmbiguity(ctx.lastUserTurn, ctx.stepTracker, ctx.recentUserTurns?.slice(0, -1))
 * - exception     ← detectException(ctx.lastUserTurn)
 * - recentlyRecontextualized ← wasRecentlyRecontextualized(ctx.recentAssistantTurns)
 * - ladderingStreak ← computeLadderingStreak(ctx.recentUserTurns)
 * - blockade      ← detectBlockade(ctx.lastUserTurn)  [D1: current turn only]
 */
export function analyzeConversationSignals(
  ctx: InterviewContext,
  briefing?: AnalystBriefing | null,
): Signals {
  const suggestedQ = briefing?.suggested_question ?? ''
  return {
    anchorNumbers: extractNumericTokens(suggestedQ),
    drillWarnings: detectDrillStops(ctx.recentAssistantTurns, ctx.stepTracker, ctx.lastUserTurn),
    ambiguity: detectAmbiguity(ctx.lastUserTurn, ctx.stepTracker, ctx.recentUserTurns?.slice(0, -1)),
    exception: detectException(ctx.lastUserTurn),
    recentlyRecontextualized: wasRecentlyRecontextualized(ctx.recentAssistantTurns),
    ladderingStreak: computeLadderingStreak(ctx.recentUserTurns),
    blockade: detectBlockade(ctx.lastUserTurn),
  }
}
