import { z } from 'zod'
import { tool } from 'ai'
import type { TurnSession } from './turnStore/port'
import type { WriteSource } from './slotConflictResolver'
import { generateEmbedding } from './embeddings'
import { classifyStepSimilarity, generateMissingEmbeddings, HARD_THRESHOLD } from './stepIdentity'
import {
  POTENZIAL_SLOT_NAMES,
  TAZITE_STRING_SLOT_NAMES,
  TAZITE_ARRAY_SLOT_NAMES,
  TAZITE_ENUM_ARRAY_SLOT_NAMES,
  TAZITE_ENUM_SINGLE_SLOT_NAMES,
  AUFGABENTYP_VALUES,
  RISIKO_SCHWERE_VALUES,
  STANDARDISIERUNGSGRAD_VALUES,
  INFORMATIONSDICHTE_VALUES,
  colonParent,
  tokenJaccardNorm,
  type StepEntry,
} from './interviewSemantic'

// PROJ-45: enum value sets for record_slot's tazite-enum slots (aufgabentyp/
// risiko_schwere are multi-select; standardisierungsgrad/informationsdichte are
// single-select, Analyst-classified — see interviewAnalyst.ts's system prompt).
const ENUM_ARRAY_VALUES: Record<string, readonly string[]> = {
  aufgabentyp: AUFGABENTYP_VALUES,
  risiko_schwere: RISIKO_SCHWERE_VALUES,
}
const ENUM_SINGLE_VALUES: Record<string, readonly string[]> = {
  standardisierungsgrad: STANDARDISIERUNGSGRAD_VALUES,
  informationsdichte: INFORMATIONSDICHTE_VALUES,
}

// PROJ-44: moved out of interviewAgent.ts (deleted — legacy createInterviewStream/
// buildStaticPrompt path). buildTools is now a Deep-Module-internal detail of the
// Analyst (interviewAnalyst.ts is the only remaining consumer).

// Normalize step title for substring-based dedup — strips whole-string
// process noun suffix. Used only inside register_step for title dedup.
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

// ─── Tools ────────────────────────────────────────────────────────────────────
// Iteration 2: phase-management tools (transition_phase, complete_interview, enter_coverage_check)
// removed — Orchestrator (interviewOrchestrator.ts) handles all phase transitions deterministically.

export function buildTools(
  session: TurnSession,
  currentUserInput?: string,
  opts?: {
    source?: 'analyst' | 'analyst_online' | 'analyst_catchup'
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
              reibungspunkte: null,
              ausloeser: null,
              aufgabentyp: null,
              risiko_schwere: null,
              standardisierungsgrad: null,
              informationsdichte: null,
            },
            teilschritte: [],
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
      description: 'Füllt einen Slot im Schritt-Tracker. Schreibbare Slots: potenzial (frequency_per_month, duration_minutes, error_rate_percent, media_breaks), qualitative O-Felder (entscheidungslogik, tazite_cues, ausnahmen, inputs, outputs, hilfsmittel, reibungspunkte, ausloeser, aufgabentyp, risiko_schwere) und die Analyst-Klassifikationsfelder (standardisierungsgrad, informationsdichte — aus bereits erhobenen Antworten abgeleitet, keine eigene Frage) sowie teilschritte (additive Ablauf-Liste). EVIDENZ-MODELL (ADR-015, Fix 3): Übergib evidence_span — einen kurzen WÖRTLICHEN Ausschnitt (5–60 Zeichen) aus dem aktuellen Mitarbeiter-Turn. Das System erweitert ihn deterministisch zum vollständigen Satz. Fallback: evidence_quote + source_turn. ⚠️ NIEMALS einen Wert eintragen, den der Mitarbeiter nicht selbst genannt hat. is_correction=true NUR wenn der Mitarbeiter einen früher genannten Wert explizit korrigiert. Nicht-Befund (PROJ-28): Für potenzial-Slots kann statt value ein nicht_befund_typ gesetzt werden wenn der Mitarbeiter keine Angabe machen konnte.',
      inputSchema: z.object({
        step_id: z.string().regex(/^S[0-9]{3}$/).optional().describe('Stabiler Schritt-ID (z.B. S001). Bevorzugt gegenüber step_title. Aus register_step-Antwort.'),
        step_title: z.string().min(1),
        slot: z.enum([
          // Potenzial (quantitativ)
          'frequency_per_month', 'duration_minutes', 'error_rate_percent', 'media_breaks',
          // Qualitative O-Felder (Freitext, einzeln)
          'entscheidungslogik', 'ausloeser',
          // Qualitative O-Felder (Freitext, Mehrwert)
          'tazite_cues', 'ausnahmen', 'inputs', 'outputs', 'hilfsmittel', 'reibungspunkte',
          // PROJ-45 AI-Wert-Faktoren (Enum, Mehrfachauswahl)
          'aufgabentyp', 'risiko_schwere',
          // PROJ-45 Klassifikation (Enum, Einzelauswahl — Analyst-derived, keine eigene Frage)
          'standardisierungsgrad', 'informationsdichte',
          // Additive Ablauf-Liste (PROJ-45/ADR-025 D4: absorbiert von update_walkthrough_data)
          'teilschritte',
        ]),
        value: z.union([z.string(), z.number(), z.array(z.string())]).optional().describe('String für Einzel-Slots (entscheidungslogik, ausloeser, standardisierungsgrad, informationsdichte), String-Array für Mehrwert-/Enum-/Ablauf-Slots (tazite_cues/ausnahmen/inputs/outputs/hilfsmittel/reibungspunkte/aufgabentyp/risiko_schwere/teilschritte), Zahl für potenzial-Slots. Optional wenn nicht_befund_typ gesetzt.'),
        nicht_befund_typ: z.enum(['nicht_zutreffend', 'unbekannt', 'verweigert']).optional().describe('Nur für potenzial-Slots: Setze wenn Mitarbeiter keine belegbare Angabe machen konnte. unbekannt=weiß nicht, verweigert=Auskunft abgelehnt, nicht_zutreffend=nicht anwendbar. Nicht setzen wenn value vorhanden.'),
        einheit: z.string().optional().describe('Nur für frequency_per_month/duration_minutes: die vom Mitarbeiter genannte Einheit — z.B. "pro_tag"/"pro_woche"/"pro_quartal"/"pro_jahr" (Häufigkeit, Default pro_monat) oder "stunden"/"tage" (Dauer, Default minuten). Speichere den Wert in der genannten Einheit — rechne NIEMALS selbst um, die Umrechnung passiert deterministisch im Code.'),
        evidence_span: z.string().min(2).max(80).optional().describe('Wörtlicher Ausschnitt aus dem aktuellen Mitarbeiter-Turn. System extrahiert den umgebenden Satz als Beleg.'),
        evidence_quote: z.string().min(3).optional().describe('Fallback wenn evidence_span nicht im aktuellen Turn vorkommt (Catch-up). Pflicht: source_turn setzen.'),
        confidence: z.enum(['confirmed', 'estimate', 'unknown']).optional(),
        qualifier: z.string().nullable().optional(),
        source_turn: z.number().int().positive().optional(),
        is_correction: z.boolean().optional().describe('Setze auf true wenn der Mitarbeiter einen früher genannten Wert explizit widerspricht oder korrigiert. Hebt Prioritäts-Konflikt-Sperre auf.'),
      }),
      execute: async ({ step_id, step_title, slot, value, nicht_befund_typ, einheit, evidence_span, evidence_quote, confidence, qualifier, source_turn, is_correction }) => {
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
        const isTeilschritte = slot === 'teilschritte'
        const isTaziteArray = (TAZITE_ARRAY_SLOT_NAMES as readonly string[]).includes(slot)
        const isEnumArray = (TAZITE_ENUM_ARRAY_SLOT_NAMES as readonly string[]).includes(slot)
        const isTaziteString = (TAZITE_STRING_SLOT_NAMES as readonly string[]).includes(slot)
        const isEnumSingle = (TAZITE_ENUM_SINGLE_SLOT_NAMES as readonly string[]).includes(slot)

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
            return { success: false, error: `nicht_befund_typ ist nur für potenzial-Slots gültig (frequency_per_month, duration_minutes, error_rate_percent, media_breaks). Für alle anderen Slots: Slot leer lassen.` }
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
          } else if (isTeilschritte) {
            if (!Array.isArray(value) || (value as string[]).length === 0) {
              return { success: false, error: `teilschritte erwartet ein nicht-leeres String-Array (die VOLLSTÄNDIGE bisherige Ablauf-Liste inkl. neuem Schritt), z.B. ["Rechnung prüfen", "Kontieren", "Freigeben"].` }
            }
          } else if (isEnumArray) {
            if (!Array.isArray(value) || (value as string[]).length === 0) {
              return { success: false, error: `${slot} erwartet ein nicht-leeres Array aus: ${ENUM_ARRAY_VALUES[slot].join(', ')}.` }
            }
            const invalid = (value as string[]).filter((v) => !ENUM_ARRAY_VALUES[slot].includes(v))
            if (invalid.length > 0) {
              return { success: false, error: `${slot}: ungültige Werte ${JSON.stringify(invalid)}. Erlaubt: ${ENUM_ARRAY_VALUES[slot].join(', ')}.` }
            }
          } else if (isTaziteArray) {
            if (!Array.isArray(value)) {
              return { success: false, error: `${slot} erwartet ein String-Array, z.B. ["SAP FI", "Excel"]. Nicht: "${value}".` }
            }
            // Reject empty arrays — spec requires value: null + nicht_befund_typ instead
            if ((value as string[]).length === 0) {
              return { success: false, error: `Leeres Array für "${slot}" ist ungültig. Wenn nichts bekannt: lass den Slot leer, oder frag nochmals nach.` }
            }
          } else if (isEnumSingle) {
            if (typeof value !== 'string' || !ENUM_SINGLE_VALUES[slot].includes(value)) {
              return { success: false, error: `${slot} erwartet genau einen Wert aus: ${ENUM_SINGLE_VALUES[slot].join(', ')}. Nicht: "${value}".` }
            }
          } else if (isTaziteString && typeof value !== 'string') {
            return { success: false, error: `${slot} erwartet einen String, nicht "${value}".` }
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
          ...(einheit !== undefined ? { einheit } : {}),
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
