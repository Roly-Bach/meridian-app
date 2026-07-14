import { resolveModel } from '@/lib/llm-provider'
import { streamText, tool } from 'ai'
import { buildTraceMetadata, type TraceCtx } from './_telemetry'
import { z } from 'zod'
import type { TurnSession, TurnStore } from './turnStore/port'
import type { WriteSource } from './slotConflictResolver'
import { generateEmbedding } from './embeddings'
import { classifyStepSimilarity, generateMissingEmbeddings, HARD_THRESHOLD, SOFT_THRESHOLD } from './stepIdentity'
import {
  TAZITE_SLOT_NAMES,
  POTENZIAL_SLOT_NAMES,
  colonParent,
  tokenJaccardNorm,
  normalizeStepEntry,
  type SlotValue,
  type StepEntry,
  type TaziteSlotName,
  type PotenzialSlotName,
  type TaziteSlot,
  type TaziteSlotArray,
  type GovernanceSlot,
  type Abhaengigkeiten,
  type AbhaengigkeitsKante,
  type EinflussKante,
  type Schritt,
} from './interviewSemantic'
import type {
  InterviewContext,
  TurnMessage,
  AnalystBriefing,
} from './interviewTypes'
import { buildDynamicContext, STATIC_PROMPT } from './talkerPrompt'

// Normalize step title for substring-based dedup — strips whole-string
// process noun suffix. Used only inside interviewAgent for title dedup.
function normalizeStepTitleForDedup(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/(prozess|wesen|ablauf|vorgang|schritt|bearbeitung|handling|verwaltung|management)$/, '')
    .trim()
}

/**
 * Deterministically expand a verbatim span (e.g. "100", "5 Minuten") to the
 * enclosing sentence(s) in the source text. Used by record_slot to derive a
 * quote from a short LLM-provided span — eliminates LLM paraphrase drift.
 *
 * Algorithm: locate the span, walk left/right to the nearest sentence
 * boundary (./?/!/\n), trim, cap at ~280 chars. Falls back to the raw span
 * if no boundary is found.
 */
function extractSentenceAroundSpan(text: string, span: string): string {
  const idx = text.indexOf(span)
  if (idx < 0) return span
  const SENTENCE_END = /[.!?\n]/
  let start = idx
  while (start > 0 && !SENTENCE_END.test(text[start - 1])) start--
  let end = idx + span.length
  while (end < text.length && !SENTENCE_END.test(text[end])) end++
  if (end < text.length) end++ // include terminator
  const sentence = text.slice(start, end).trim()
  if (sentence.length === 0) return span
  return sentence.length > 280 ? sentence.slice(0, 280) : sentence
}

// ─── System Prompt ────────────────────────────────────────────────────────────
// PROJ-37: STATIC_PROMPT (talkerPrompt.ts) is the single source of truth for
// conversation-behavior rules (turn format, Ausweichen-Eskalation, verboten
// topics, no_repeat, kein_kommentar) — shared with the Talker's every-turn
// prompt. Only the <tools> block below is agent-specific (the Talker doesn't
// call live tools; the Analyst does that in the dual loop).

function buildStaticPrompt(): string {
  return STATIC_PROMPT + `<tools>
Tool-Calls laufen still im Hintergrund — erscheinen nie im Text.
evidence_quote muss ein wörtliches Zitat aus dem Mitarbeiter-Statement sein.
Slots nur setzen wenn Mitarbeiter den Wert explizit genannt hat.
record_governance aufrufen sobald Mitarbeiter Rolle, OE oder zuständige Systeme nennt.
update_topics nach jedem Turn mit aktualisierten Listen aufrufen.
PFLICHT: Nach Tool-Calls IMMER eine Textantwort generieren — auch nur ein Reaktionssatz + Frage. Eine leere Antwort ist kein gültiger Turn.
</tools>

`
}

// ─── Tools ────────────────────────────────────────────────────────────────────
// Iteration 2: phase-management tools (transition_phase, complete_interview, enter_coverage_check)
// removed — Orchestrator (interviewOrchestrator.ts) handles all phase transitions deterministically.

export function buildTools(
  session: TurnSession,
  currentUserInput?: string,
  opts?: {
    source?: 'quick' | 'analyst' | 'analyst_online' | 'analyst_catchup'
    /** When set, only tools whose names are in this list are included in the returned object. */
    allowedTools?: string[]
    /** User turn texts indexed 0-based. Reserved for catchup evidence validation. */
    userTurns?: string[]
  },
) {
  // PROJ-34/ADR-018: tools keep their read/decide logic but return a WriteIntent
  // via session.stage() instead of writing to Supabase. Conflict resolution,
  // idempotency and the done-transition live behind stage (applyIntent).
  const writeSource = (opts?.source ?? 'analyst') as WriteSource

  const allTools = {
    update_topics: tool({
      description: 'Aktualisiert die Liste der abgedeckten und offenen Themen nach einem Turn.',
      inputSchema: z.object({
        covered: z.array(z.string()),
        open: z.array(z.string()),
      }),
      execute: async ({ covered, open }) => {
        const res = session.stage({ kind: 'update_topics', covered, open })
        return res.status === 'accepted'
          ? { success: true }
          : { success: false, error: 'update_topics not applied' }
      },
    }),

    register_step: tool({
      description: 'Legt einen neuen Prozessschritt im Slot-Tracker an. Einmalig pro Schritt aufrufen sobald der Schritt klar benannt ist. Setzt reihenfolge automatisch.',
      inputSchema: z.object({
        title: z.string().min(1),
      }),
      execute: async ({ title }) => {
        try {
          let current: StepEntry[] = session.snapshot().stepTracker

          // ── Layer 1: exact / substring match (free, always runs) ──────────
          const normalizedTitle = title.trim().toLowerCase()
          const normalizedForDedup = normalizeStepTitleForDedup(title)
          const exactDuplicate = current.find((s) => {
            const existing = s.title.trim().toLowerCase()
            if (existing === normalizedTitle || existing.includes(normalizedTitle) || normalizedTitle.includes(existing)) {
              return true
            }
            const existingForDedup = normalizeStepTitleForDedup(s.title)
            if (existingForDedup.length >= 4 && normalizedForDedup.length >= 4) {
              if (existingForDedup === normalizedForDedup ||
                existingForDedup.includes(normalizedForDedup) ||
                normalizedForDedup.includes(existingForDedup)) {
                return true
              }
            }
            return false
          })
          if (exactDuplicate) {
            return {
              success: true,
              deduplicated: true,
              matched_title: exactDuplicate.title,
              message: `Schritt bereits vorhanden als "${exactDuplicate.title}" — nutze diesen Titel für record_slot`,
              step_tracker: current,
              existing_step_titles: current.map((s) => s.title),
            }
          }

          // ── Layer 1b: colon-parent guard (F1) ─────────────────────────────
          // Sub-step "X: Y" handling has two cases:
          // Case A — parent not registered: tell LLM to register parent first
          // Case B — parent already registered: redirect directly, skip this call
          const parent = colonParent(title)
          if (parent && parent !== title) {
            const parentMatch = current.find((s) => {
              const ex = s.title.trim().toLowerCase()
              const p = parent.toLowerCase()
              return ex === p || ex.includes(p) || p.includes(ex)
            })
            if (!parentMatch) {
              // Case A: parent missing → register parent first
              return {
                success: false,
                soft_warning: true,
                colon_parent_missing: true,
                suggested_parent: parent,
                message: `Registriere zuerst den übergeordneten Prozess "${parent}" mit register_step. Danach nutze "${parent}" direkt als step_title für record_slot — rufe register_step für "${title}" NICHT nochmals auf.`,
                existing_step_titles: current.map((s) => s.title),
              }
            } else {
              // Case B: parent exists → redirect directly, no new step needed
              return {
                success: true,
                deduplicated: true,
                matched_title: parentMatch.title,
                message: `Teilschritt-Registrierung übersprungen. Nutze direkt "${parentMatch.title}" als step_title für record_slot. KEIN weiterer register_step-Aufruf nötig.`,
                step_tracker: current,
                existing_step_titles: current.map((s) => s.title),
              }
            }
          }

          // ── Layer 2: embedding-based cosine similarity (Jina v3) ──────────
          // Falls back to Layer 3 (Jaccard) when JINA_API_KEY is unset.
          const titleEmbedding = await generateEmbedding(title)
          if (titleEmbedding) {
            // Lazily populate embeddings for existing steps that lack one.
            // Save back to DB only when at least one was generated.
            const hydrated = await generateMissingEmbeddings(current)
            const anyNew = hydrated.some((s, i) => s.embedding && !current[i].embedding)
            if (anyNew) {
              current = hydrated
              // Persist hydrated embeddings (full-array write, same as today).
              session.stage({ kind: 'register_step', tracker: current })
            }

            const match = classifyStepSimilarity(titleEmbedding, current)
            if (match?.zone === 'hard') {
              return {
                success: true,
                deduplicated: true,
                matched_title: match.step.title,
                similarity_score: Math.round(match.score * 100) / 100,
                message: `Schritt semantisch identisch mit "${match.step.title}" (score=${match.score.toFixed(2)}) — nutze diesen Titel für record_slot`,
                step_tracker: current,
                existing_step_titles: current.map((s) => s.title),
              }
            }
            if (match?.zone === 'soft') {
              return {
                success: false,
                soft_warning: true,
                similar_titles: [match.step.title],
                similarity_score: Math.round(match.score * 100) / 100,
                message: `Semantisch ähnlicher Schritt: "${match.step.title}" (score=${match.score.toFixed(2)}, threshold=${HARD_THRESHOLD}). Nutze record_slot mit diesem Titel wenn es derselbe Prozess ist. Nur fortfahren wenn dieser Schritt einen anderen Hauptprozess beschreibt.`,
                existing_step_titles: current.map((s) => s.title),
              }
            }
          } else {
            // ── Layer 3: Token Jaccard fallback (no JINA_API_KEY) ────────────
            const jaccardDuplicate = current.find((s) => tokenJaccardNorm(s.title, title) >= 0.4)
            if (jaccardDuplicate) {
              return {
                success: true,
                deduplicated: true,
                matched_title: jaccardDuplicate.title,
                message: `Schritt bereits vorhanden als "${jaccardDuplicate.title}" — nutze diesen Titel für record_slot`,
                step_tracker: current,
                existing_step_titles: current.map((s) => s.title),
              }
            }
            const softSimilar = current
              .map(s => ({ title: s.title, score: tokenJaccardNorm(s.title, title) }))
              .filter(({ score }) => score >= 0.2 && score < 0.4)
              .map(({ title: t }) => t)
            if (softSimilar.length > 0) {
              return {
                success: false,
                soft_warning: true,
                similar_titles: softSimilar,
                message: `Ähnliche Schritte gefunden: ${softSimilar.map(t => `"${t}"`).join(', ')}. Nutze record_slot mit einem dieser Titel wenn es derselbe Prozess ist. Nur fortfahren wenn dieser Schritt einen anderen Hauptprozess beschreibt.`,
                existing_step_titles: current.map((s) => s.title),
              }
            }
          }

          // Collision guard: skip IDs already present (BL-E1.4 edge case)
          let stepNum = current.length + 1
          let candidateId = `S${String(stepNum).padStart(3, '0')}`
          while (current.some(s => s.id === candidateId)) {
            stepNum++
            candidateId = `S${String(stepNum).padStart(3, '0')}`
          }
          const newEntry: StepEntry = {
            id: candidateId,
            title: title.trim(),
            reihenfolge: stepNum,
            governance: null,
            abhaengigkeiten: null,
            potenzial: {
              frequency_per_month: null,
              duration_minutes: null,
              error_rate_percent: null,
              media_breaks: null,
            },
            status: 'exploring',
            slots: {
              entscheidungslogik: null,
              tazite_cues: null,
              ausnahmen: null,
              inputs: null,
              outputs: null,
              hilfsmittel: null,
            },
            process_steps: [],
            friction_points: [],
            friction_tools: [],
            pain_point_primary: null,
            ...(titleEmbedding ? { embedding: titleEmbedding } : {}),
          }

          const updated = [...current, newEntry]
          session.stage({ kind: 'register_step', tracker: updated })

          return {
            success: true,
            step_tracker: updated,
            existing_step_titles: updated.map((s) => s.title),
            reminder: 'Prüfe: Enthält existing_step_titles einen semantisch gleichwertigen Eintrag? Falls ja: nutze record_slot mit dem bestehenden Titel.',
          }
        } catch (err) {
          console.error('[register_step] failed:', err)
          return { success: false, error: (err as Error).message }
        }
      },
    }),

    record_slot: tool({
      description: 'Füllt einen Slot im Schritt-Tracker. Schreibbare Slots: potenzial (frequency_per_month, duration_minutes, error_rate_percent, media_breaks) und tazite O2–O5 (entscheidungslogik, tazite_cues, ausnahmen, inputs, outputs, hilfsmittel). EVIDENZ-MODELL (ADR-015, Fix 3): Übergib evidence_span — einen kurzen WÖRTLICHEN Ausschnitt (5–60 Zeichen) aus dem aktuellen Mitarbeiter-Turn. Das System erweitert ihn deterministisch zum vollständigen Satz. Fallback: evidence_quote + source_turn. ⚠️ NIEMALS einen Wert eintragen, den der Mitarbeiter nicht selbst genannt hat. is_correction=true NUR wenn der Mitarbeiter einen früher genannten Wert explizit korrigiert. Nicht-Befund (PROJ-28): Für potenzial-Slots kann statt value ein nicht_befund_typ gesetzt werden wenn der Mitarbeiter keine Angabe machen konnte.',
      inputSchema: z.object({
        step_id: z.string().regex(/^S[0-9]{3}$/).optional().describe('Stabiler Schritt-ID (z.B. S001). Bevorzugt gegenüber step_title. Aus register_step-Antwort.'),
        step_title: z.string().min(1),
        slot: z.enum([
          // Potenzial (quantitativ)
          'frequency_per_month', 'duration_minutes', 'error_rate_percent', 'media_breaks',
          // Tazite O2–O5 (qualitativ)
          'entscheidungslogik', 'tazite_cues', 'ausnahmen', 'inputs', 'outputs', 'hilfsmittel',
        ]),
        value: z.union([z.string(), z.number(), z.array(z.string())]).optional().describe('String für tazite Einzel-Slots (entscheidungslogik), String-Array für Mehrwert-Slots (tazite_cues/ausnahmen/inputs/outputs/hilfsmittel), Zahl für potenzial-Slots. Optional wenn nicht_befund_typ gesetzt.'),
        nicht_befund_typ: z.enum(['nicht_zutreffend', 'unbekannt', 'verweigert']).optional().describe('Nur für potenzial-Slots: Setze wenn Mitarbeiter keine belegbare Angabe machen konnte. unbekannt=weiß nicht, verweigert=Auskunft abgelehnt, nicht_zutreffend=nicht anwendbar. Nicht setzen wenn value vorhanden.'),
        evidence_span: z.string().min(2).max(80).optional().describe('Wörtlicher Ausschnitt aus dem aktuellen Mitarbeiter-Turn. System extrahiert den umgebenden Satz als Beleg.'),
        evidence_quote: z.string().min(3).optional().describe('Fallback wenn evidence_span nicht im aktuellen Turn vorkommt (Catch-up). Pflicht: source_turn setzen.'),
        confidence: z.enum(['confirmed', 'estimate', 'unknown']).optional(),
        qualifier: z.string().nullable().optional(),
        source_turn: z.number().int().positive().optional(),
        is_correction: z.boolean().optional().describe('Setze auf true wenn der Mitarbeiter einen früher genannten Wert explizit widerspricht oder korrigiert. Hebt Prioritäts-Konflikt-Sperre auf.'),
      }),
      execute: async ({ step_id, step_title, slot, value, nicht_befund_typ, evidence_span, evidence_quote, confidence, qualifier, source_turn, is_correction }) => {
        // Fix 3 (ADR-015): prefer deterministic span-based extraction.
        const userInputText = currentUserInput?.trim() ?? ''
        let resolvedQuote: string | null = null

        if (evidence_span && evidence_span.trim().length >= 2) {
          const span = evidence_span.trim()
          if (userInputText.length > 0 && userInputText.includes(span)) {
            resolvedQuote = extractSentenceAroundSpan(userInputText, span)
          } else {
            return {
              success: false,
              error: `evidence_span "${span}" wurde nicht wörtlich im aktuellen Mitarbeiter-Turn gefunden. Übergib einen exakten Ausschnitt aus dem aktuellen Statement oder nutze evidence_quote + source_turn für historische Belege.`,
            }
          }
        }

        if (resolvedQuote === null) {
          if (!evidence_quote || evidence_quote.trim().length < 3) {
            return {
              success: false,
              error: 'Weder gültiges evidence_span noch evidence_quote übergeben. Bevorzugt: evidence_span (kurzer wörtlicher Ausschnitt aus aktuellem Turn).',
            }
          }
          resolvedQuote = evidence_quote.trim()
        }

        // Per-slot type guards
        const isPotenzial = (POTENZIAL_SLOT_NAMES as readonly string[]).includes(slot)
        const isTaziteArray = ((['tazite_cues', 'ausnahmen', 'inputs', 'outputs', 'hilfsmittel'] as const) as readonly string[]).includes(slot)

        // F2: Parse NICHT-BEFUND string that quick-extract LLM may pass as raw value
        // e.g. value="NICHT-BEFUND:unbekannt" with no nicht_befund_typ set → convert to structured mode
        let resolvedValue = value
        let resolvedNichtBefundTyp = nicht_befund_typ
        if (typeof value === 'string' && value.startsWith('NICHT-BEFUND:')) {
          const parsed = value.split(':')[1] as 'unbekannt' | 'nicht_zutreffend' | 'verweigert' | undefined
          const validTypes = ['unbekannt', 'nicht_zutreffend', 'verweigert'] as const
          if (parsed !== undefined && (validTypes as readonly string[]).includes(parsed)) {
            resolvedValue = undefined
            resolvedNichtBefundTyp = parsed as 'unbekannt' | 'nicht_zutreffend' | 'verweigert'
          }
        }

        // PROJ-28/BL-E2.1 — Nicht-Befund mode: only for potenzial slots, no value required
        const isNichtBefundMode = resolvedNichtBefundTyp !== undefined && resolvedValue === undefined
        if (isNichtBefundMode) {
          if (!isPotenzial) {
            return { success: false, error: `nicht_befund_typ ist nur für potenzial-Slots gültig (frequency_per_month, duration_minutes, error_rate_percent, media_breaks). Für tazite-Slots: Slot leer lassen.` }
          }
          // Falls through to step lookup + write below with isNichtBefundMode=true
        } else {
          // Normal value mode — value must be present
          if (value === undefined) {
            return { success: false, error: 'Entweder value oder nicht_befund_typ muss gesetzt sein.' }
          }
          if (isPotenzial) {
            if (slot === 'media_breaks' && typeof value !== 'number') {
              return { success: false, error: `media_breaks erwartet eine ganze Zahl (Anzahl Medienbrüche pro Durchlauf, z.B. 0, 1, 2), nicht "${value}".` }
            }
            if ((slot === 'frequency_per_month' || slot === 'duration_minutes' || slot === 'error_rate_percent') && typeof value !== 'number') {
              return { success: false, error: `${slot} erwartet eine Zahl, nicht "${value}". Extrahiere den numerischen Mittelwert.` }
            }
          } else if (isTaziteArray) {
            if (!Array.isArray(value)) {
              return { success: false, error: `${slot} erwartet ein String-Array, z.B. ["SAP FI", "Excel"]. Nicht: "${value}".` }
            }
            // Reject empty arrays — spec requires value: null + nicht_befund_typ instead
            if ((value as string[]).length === 0) {
              return { success: false, error: `Leeres Array für "${slot}" ist ungültig. Wenn nichts bekannt: lass den Slot leer und setze nicht_befund_typ via record_governance, oder frag nochmals nach.` }
            }
          } else if (slot === 'entscheidungslogik' && typeof value !== 'string') {
            return { success: false, error: `entscheidungslogik erwartet einen String (Beschreibung der Entscheidungslogik), nicht "${value}".` }
          }
        }

        const verbatimQuote = resolvedQuote

        // PROJ-34/ADR-018: lookup, idempotency, priority (canOverwrite) and the
        // done-transition live behind session.stage (applyIntent). The tool keeps
        // evidence resolution + type guards above; here it just stages the intent
        // and maps the result back to the same LLM-facing response as before.
        const result = session.stage({
          kind: 'record_slot',
          ...(step_id !== undefined ? { stepId: step_id } : {}),
          stepTitle: step_title,
          slot,
          value: resolvedValue,
          nichtBefundTyp: resolvedNichtBefundTyp,
          isNichtBefundMode,
          quote: verbatimQuote,
          ...(confidence !== undefined ? { confidence } : {}),
          ...(qualifier !== undefined ? { qualifier } : {}),
          sourceTurn: source_turn ?? null,
          isCorrection: is_correction,
          writeSource,
        })

        if (result.status === 'blocked' && result.reason === 'step_not_found') {
          const avail = (result.detail?.available as Array<{ title: string; id: string | null }> | undefined ?? [])
            .map((s) => `"${s.title}" (${s.id ?? 'no-id'})`)
            .join(', ')
          return { success: false, error: `Schritt "${step_id ?? step_title}" nicht gefunden. Verfügbare Schritte: ${avail || '(keine)'}. Nutze einen dieser Titel oder IDs exakt.` }
        }
        if (result.status === 'blocked' && result.reason === 'priority') {
          return { success: false, error: `Slot "${slot}" already owned by higher-priority source "${result.detail?.prevSource ?? 'unknown'}". Current source "${writeSource}" may not overwrite it. Use is_correction=true only if the interviewee explicitly corrected this value.` }
        }
        if (result.status === 'skipped' && result.reason === 'idempotent') {
          return {
            success: true,
            skipped: true,
            message: `Slot "${slot}" für "${result.detail?.stepTitle ?? step_title}" enthält bereits diesen Wert. STOPP — kein weiterer record_slot-Aufruf für diesen Slot nötig. Fahre mit dem nächsten fehlenden Slot fort.`,
          }
        }
        // accepted — detail carries step_id, step_title, slot, value|nicht_befund_typ, source_turn
        return { success: true, ...result.detail }
      },
    }),

    record_governance: tool({
      description: 'Erfasst Governance-Information zu einem Prozessschritt (wer führt aus, welche OE, welche Systeme). Partial-Write: nur übergebene Felder werden gesetzt, bestehende bleiben unverändert. Separat von record_slot — GovernanceSlot hat anderes Format. Rufe auf sobald eine Governance-Information im Turn vorkommt.',
      inputSchema: z.object({
        step_title: z.string().min(1),
        rolle: z.string().optional().describe('Person oder Rolle, die den Schritt ausführt'),
        organisationseinheit: z.string().optional().describe('Organisationseinheit / Abteilung'),
        systeme: z.array(z.string()).optional().describe('Systeme oder Plattformen, die für diesen Schritt zuständig sind (nicht: Tools die benutzt werden — das ist hilfsmittel)'),
        nicht_befund_typ: z.enum(['nicht_zutreffend', 'unbekannt', 'verweigert']).optional().describe('Setze wenn Governance explizit nicht klärbar ist'),
        evidence_span: z.string().min(2).max(80).optional().describe('Wörtlicher Ausschnitt aus aktuellem Turn als Beleg'),
        evidence_quote: z.string().min(3).optional(),
        source_turn: z.number().int().positive().optional(),
      }),
      execute: async ({ step_title, rolle, organisationseinheit, systeme, nicht_befund_typ, evidence_span, evidence_quote, source_turn }) => {
        // Evidence validation (same pattern as record_slot)
        const userInputText = currentUserInput?.trim() ?? ''
        let resolvedQuote: string | null = null

        if (evidence_span && evidence_span.trim().length >= 2) {
          const span = evidence_span.trim()
          if (userInputText.length > 0 && userInputText.includes(span)) {
            resolvedQuote = extractSentenceAroundSpan(userInputText, span)
          } else {
            return { success: false, error: `evidence_span "${span}" nicht im aktuellen Turn gefunden.` }
          }
        }
        if (resolvedQuote === null && evidence_quote && evidence_quote.trim().length >= 3) {
          resolvedQuote = evidence_quote.trim()
        }

        const result = session.stage({
          kind: 'record_governance',
          stepTitle: step_title,
          ...(rolle !== undefined ? { rolle } : {}),
          ...(organisationseinheit !== undefined ? { organisationseinheit } : {}),
          ...(systeme !== undefined ? { systeme } : {}),
          ...(nicht_befund_typ !== undefined ? { nichtBefundTyp: nicht_befund_typ } : {}),
          quote: resolvedQuote,
          sourceTurn: source_turn ?? null,
        })
        if (result.status === 'blocked' && result.reason === 'step_not_found') {
          const avail = (result.detail?.available as Array<{ title: string }> | undefined ?? []).map((s) => `"${s.title}"`).join(', ')
          return { success: false, error: `Schritt "${step_title}" nicht gefunden. Verfügbar: ${avail || '(keine)'}.` }
        }
        return { success: true, step_title, governance: result.detail?.governance, quote: resolvedQuote, source_turn: source_turn ?? null }
      },
    }),

    record_dependency: tool({
      description: 'Erfasst eine getypte Abhängigkeitskante zwischen zwei Prozessschritten (O6/REQ-006). Kanten-Modus: source_step_id → target_step_id mit richtung + typ. Nicht-Befund-Modus: nur source_step_id + nicht_befund_typ wenn keine Abhängigkeiten bekannt. Typen depends_on: voraussetzung/ressource/ausloeser. Typen influences: beeinflusst/terminierung.',
      inputSchema: z.object({
        source_step_id: z.string().regex(/^S[0-9]{3}$/).describe('Schritt, auf dem die Kante eingetragen wird (z.B. S001)'),
        target_step_id: z.string().regex(/^S[0-9]{3}$/).optional().describe('Referenzierter Schritt — Kanten-Modus'),
        richtung: z.enum(['depends_on', 'influences']).optional().describe('depends_on: source setzt target voraus. influences: source beeinflusst target.'),
        typ: z.string().optional().describe('Kantentyp: depends_on → voraussetzung/ressource/ausloeser; influences → beeinflusst/terminierung'),
        beschreibung: z.string().nullable().optional(),
        nicht_befund_typ: z.enum(['nicht_zutreffend', 'unbekannt', 'verweigert']).optional().describe('Nicht-Befund-Modus: setze wenn Mitarbeiter explizit keine Abhängigkeiten kennt'),
      }),
      execute: async ({ source_step_id, target_step_id, richtung, typ, beschreibung, nicht_befund_typ }) => {
        const isEdgeMode = target_step_id !== undefined && richtung !== undefined && typ !== undefined
        const isNichtBefundMode = nicht_befund_typ !== undefined

        if (!isEdgeMode && !isNichtBefundMode) {
          return { success: false, error: 'Kanten-Modus (target_step_id + richtung + typ) oder Nicht-Befund-Modus (nicht_befund_typ) erforderlich.' }
        }
        if (isEdgeMode && isNichtBefundMode) {
          return { success: false, error: 'Kanten-Modus und Nicht-Befund-Modus schließen sich aus — nur eines übergeben.' }
        }

        if (isEdgeMode) {
          if (source_step_id === target_step_id) {
            return { success: false, error: 'Selbstreferenz nicht erlaubt: source_step_id und target_step_id dürfen nicht identisch sein.' }
          }
          const validDependsOnTypes = ['voraussetzung', 'ressource', 'ausloeser']
          const validInfluencesTypes = ['beeinflusst', 'terminierung']
          if (richtung === 'depends_on' && !validDependsOnTypes.includes(typ!)) {
            return { success: false, error: `Ungültiger Typ für depends_on: "${typ}". Erlaubt: ${validDependsOnTypes.join(', ')}.` }
          }
          if (richtung === 'influences' && !validInfluencesTypes.includes(typ!)) {
            return { success: false, error: `Ungültiger Typ für influences: "${typ}". Erlaubt: ${validInfluencesTypes.join(', ')}.` }
          }
        }

        const result = session.stage({
          kind: 'record_dependency',
          mode: isNichtBefundMode ? 'nicht_befund' : 'edge',
          sourceStepId: source_step_id,
          ...(target_step_id !== undefined ? { targetStepId: target_step_id } : {}),
          ...(richtung !== undefined ? { richtung } : {}),
          ...(typ !== undefined ? { typ } : {}),
          ...(beschreibung !== undefined ? { beschreibung } : {}),
          ...(nicht_befund_typ !== undefined ? { nichtBefundTyp: nicht_befund_typ } : {}),
        })
        if (result.status === 'blocked' && result.reason === 'step_not_found') {
          const available = (result.detail?.available as string[] | undefined ?? []).join(', ')
          return { success: false, error: `Quell-Schritt "${source_step_id}" nicht im step_tracker. Verfügbar: ${available || '(keine)'}.` }
        }
        if (result.status === 'blocked' && result.reason === 'target_not_found') {
          const available = (result.detail?.available as string[] | undefined ?? []).join(', ')
          return { success: false, error: `Ziel-Schritt "${target_step_id}" nicht im step_tracker. Zuerst via register_step anlegen. Verfügbar: ${available || '(keine)'}.` }
        }
        if (result.status === 'skipped' && result.reason === 'duplicate_edge') {
          return { success: true, message: 'Kante bereits vorhanden (idempotent)', skipped: true }
        }
        return { success: true, source_step_id, abhaengigkeiten: result.detail?.abhaengigkeiten }
      },
    }),

    link_bottleneck: tool({
      description: 'Verknüpft einen Pain Point mit einem konkreten Prozessschritt. Legt ein knowledge_object vom Typ pain_point mit step_ref an.',
      inputSchema: z.object({
        step_title: z.string().min(1),
        description: z.string().min(5),
        severity: z.enum(['high', 'medium', 'low']),
      }),
      execute: async ({ step_title, description, severity }) => {
        const result = session.stage({ kind: 'link_bottleneck', stepTitle: step_title, description, severity })
        return result.status === 'accepted'
          ? { success: true, step_title, severity }
          : { success: false, error: 'link_bottleneck not applied' }
      },
    }),

    update_walkthrough_data: tool({
      description: 'Aktualisiert die Ablauf- und Reibungsdaten eines Prozessschritts. SOFORT aufrufen wenn der Mitarbeiter Prozessschritte beschreibt — erkennbar an Signalwörtern wie "zuerst", "dann", "danach", "als nächstes", "am Ende". Felder sind additiv — bestehende Einträge werden nicht gelöscht.',
      inputSchema: z.object({
        step_title: z.string().min(1),
        process_steps: z.array(z.string()).optional(),
        friction_points: z.array(z.string()).optional(),
        friction_tools: z.array(z.string()).optional(),
        pain_point_primary: z.string().nullable().optional(),
      }),
      execute: async ({ step_title, process_steps, friction_points, friction_tools, pain_point_primary }) => {
        const result = session.stage({
          kind: 'update_walkthrough_data',
          stepTitle: step_title,
          ...(process_steps !== undefined ? { process_steps } : {}),
          ...(friction_points !== undefined ? { friction_points } : {}),
          ...(friction_tools !== undefined ? { friction_tools } : {}),
          ...(pain_point_primary !== undefined ? { pain_point_primary } : {}),
        })
        if (result.status === 'blocked' && result.reason === 'step_not_found') {
          const avail = (result.detail?.available as Array<{ title: string }> | undefined ?? []).map((s) => `"${s.title}"`).join(', ')
          return { success: false, error: `Schritt "${step_title}" nicht gefunden. Verfügbare Schritte: ${avail || '(keine)'}. Nutze einen dieser Titel exakt.` }
        }
        return { success: true, step_title }
      },
    }),
  }

  // When allowedTools is specified, filter the returned tool map to only the requested tools.
  // This lets analyst_catchup expose only record_slot + produce_briefing.
  if (opts?.allowedTools) {
    const allowed = new Set(opts.allowedTools)
    return Object.fromEntries(
      Object.entries(allTools).filter(([name]) => allowed.has(name))
    ) as typeof allTools
  }

  return allTools
}


// ─── Stream Factory ───────────────────────────────────────────────────────────
// Used by chat/start/reconnect routes (Iterations 1+2) and start/reconnect in Iteration 3.
// chat/route.ts switches to createTalkerStream in Iteration 3.

export interface AgentStreamOptions {
  context: InterviewContext
  history: TurnMessage[]
  userInput?: string
  isReconnect?: boolean
  isStart?: boolean
  briefing?: AnalystBriefing | null
  onFinish?: (text: string) => Promise<void>
  traceCtx?: TraceCtx
  /** TurnStore for the greeting/reconnect tool writes. Defaults to the prod Supabase store. */
  store?: TurnStore
}

export async function createInterviewStream(opts: AgentStreamOptions) {
  const modelString = process.env.INTERVIEW_MODEL ?? 'google/gemini-3.1-flash-lite'
  const model = resolveModel(modelString)

  // PROJ-34/ADR-018: open one session for this pass; the tools stage intents and
  // commit() persists at pass end (in the stream's onFinish). Default to the prod
  // Supabase store (lazy import keeps the eval/tsx graph free of supabase-admin).
  const store = opts.store ?? (await import('./turnStore/supabaseTurnStore')).createSupabaseTurnStore()
  const session = await store.openTurn(opts.context.interviewId, opts.context.workspaceId)

  const staticPart = buildStaticPrompt()
  // F1: feed last assistant turns into context for drill-stop detection.
  // F1b: also feed last user turn for refuse-detect.
  // E3.4: feed last user turns for laddering streak detection.
  const recentAssistantTurns = opts.history
    .filter((t) => t.role === 'assistant')
    .slice(-4)
    .map((t) => t.content)
  const lastUserTurn = [...opts.history].reverse().find((t) => t.role === 'user')?.content
  const recentUserTurns = opts.history
    .filter((t) => t.role === 'user')
    .slice(-4)
    .map((t) => t.content)
  const dynamicPart = buildDynamicContext(
    { ...opts.context, recentAssistantTurns, lastUserTurn, recentUserTurns },
    opts.briefing,
  )

  type PlainMessage = { role: 'user' | 'assistant'; content: string }
  type RichMessage = { role: 'user' | 'assistant'; content: string | Array<{ type: 'text'; text: string }> }

  const baseMessages: PlainMessage[] = opts.isReconnect
    ? [
        ...opts.history.map((t) => ({ role: t.role, content: t.content })),
        { role: 'user' as const, content: 'Ich bin wieder da, können wir weitermachen?' },
      ]
    : opts.isStart
    ? [{ role: 'user' as const, content: 'Bitte starte das Interview.' }]
    : opts.history.map((t) => ({ role: t.role, content: t.content }))

  // Static prompt in system (cacheable), dynamic context prepended to last user turn.
  let systemPrompt: string
  let messages: RichMessage[]

  if (baseMessages.length > 0) {
    systemPrompt = staticPart
    messages = baseMessages.map((msg, idx) => {
      if (idx === baseMessages.length - 1 && msg.role === 'user') {
        return {
          role: 'user' as const,
          content: [
            { type: 'text' as const, text: dynamicPart + '\n\n---\n\n' },
            { type: 'text' as const, text: msg.content },
          ],
        }
      }
      return msg
    })
  } else {
    systemPrompt = `${staticPart}\n\n${dynamicPart}`
    messages = baseMessages
  }

  return streamText({
    model,
    temperature: 0.5,
    system: systemPrompt,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: messages as any,
    tools: buildTools(session, opts.userInput),
    experimental_telemetry: buildTraceMetadata('interview.talker', {
      interviewId: opts.context.interviewId,
      model: modelString,
      environment: 'prod',
      component: 'talker',
      ...opts.traceCtx,
    }),
    // Stop as soon as any step has produced visible text.
    // Allow up to 8 tool-only steps before forcing a stop (Flash 3.5 uses up to 4 per turn
    // for register_step + record_slot calls; budget doubled to prevent empty responses).
    stopWhen: ({ steps }) => {
      if (steps.length === 0) return false
      const hasText = steps.some((s) => s.text.trim().length > 0)
      return hasText || steps.length >= 8
    },
    // Always commit the staged tool writes at pass end (ADR-018 D5), then run the
    // caller's onFinish. Commit runs even when the caller passes no onFinish.
    onFinish: async ({ text, usage, providerMetadata }) => {
      try {
        await session.commit()
      } catch (err) {
        console.error('[createInterviewStream] session.commit failed:', err)
      }
      const meta = providerMetadata as Record<string, unknown> | undefined
      const anthropicMeta = meta?.anthropic as Record<string, unknown> | undefined
      const details = usage.inputTokenDetails as Record<string, unknown> | undefined
      const usageData = {
        model: modelString,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cacheReadTokens: (details?.cacheReadTokens as number | undefined) ?? null,
        cacheCreationTokens: (details?.cacheWriteTokens as number | undefined) ?? (anthropicMeta?.cacheCreationInputTokens as number | undefined) ?? null,
        googleCachedTokens: (details?.cacheReadTokens as number | undefined) ?? null,
      }
      console.log('[token-usage] turn', usageData)
      if (process.env.NODE_ENV === 'development') {
        try {
          const fs = await import('fs')
          fs.writeFileSync('.eval-last-usage.json', JSON.stringify(usageData))
        } catch { /* non-blocking */ }
      }
      if (opts.onFinish) await opts.onFinish(text)
    },
  })
}
