/**
 * Pure semantic utilities for interview step handling.
 *
 * Extracted from interviewAgent.ts so off-Next.js consumers (eval replay,
 * backfill scripts, CI workflows) can import these without dragging the
 * server-only Supabase admin chain through `import 'server-only'`.
 *
 * Everything here must remain side-effect-free and free of runtime imports
 * that touch Supabase, the AI SDK, or Next.js server modules.
 */

import type { WriteSource } from './slotConflictResolver'

/**
 * PROJ-42: collapsed from six phases (intro/process_loop/walkthrough_step/
 * slot_completion/coverage_check/wrap_up/clarification) to three plus the
 * unchanged clarification step. 'explore' covers both process discovery and
 * process deepening as one continuous activity (see interviewOrchestrator.ts);
 * 'closing' covers what was wrap_up (catch-all probe → farewell → cards).
 */
export type Phase =
  | 'intro'
  | 'explore'
  | 'closing'
  | 'clarification'

export type NichtBefundTyp = 'nicht_zutreffend' | 'unbekannt' | 'verweigert' | null

/**
 * PROJ-45 (ADR-025): single unified slot shape for every scalar/array O-field —
 * replaces the four previously-distinct StepEntry slot types (SlotValue for
 * potenzial, TaziteSlot for single-string O-fields, TaziteSlotArray for
 * multi-value O-fields, GovernanceSlot for the now-removed governance object).
 * `qualifier`/`writeSource`/`einheit` only carry meaning on potenzial fields
 * (SchemaSlotNumber) — kept optional here so the qualitative O-fields don't
 * need to shed them.
 */
export interface SchemaSlotBase<T> {
  value: T | null
  /** Verbatim evidence quote grounding this value — required for KI-18 grounding checks and eval scorers (hallucinationRate, slotDepth). */
  quote: string | null
  confidence?: 'confirmed' | 'estimate' | 'unknown'
  /** Explicit non-finding marker (PROJ-28/BL-E2.1) */
  nicht_befund_typ: NichtBefundTyp
}

export type SchemaSlotString = SchemaSlotBase<string>
export type SchemaSlotStringArray = SchemaSlotBase<string[]>

export interface SchemaSlotNumber extends SchemaSlotBase<number> {
  qualifier?: string | null
  /** Which write path last successfully wrote this slot — used for conflict resolution (potenzial only) */
  writeSource?: WriteSource
  /**
   * PROJ-45 (ADR-025 D5): unit as stated by the employee — e.g. 'pro_woche' for
   * haeufigkeit, 'stunden' for dauer. Absent = the field's implicit canonical
   * unit (pro Monat / Minuten — matches how the 6 pre-PROJ-45 interviews were
   * recorded). Conversion to the canonical unit happens deterministically in
   * code at use-time (resolveHaeufigkeitProMonat/resolveDauerMinuten below),
   * never by the LLM at elicitation time (KI-18's largest documented cause).
   */
  einheit?: string | null
  /**
   * PROJ-43 (AC1/AC2): a coarse tendency the employee gave when they answered
   * the Talker's direction question ("eher selten"/"zieht sich lange") instead
   * of a number. Lives directly on the field, like `einheit` — no separate
   * turn-scoped transport needed, it survives to the Closing-phase Card round
   * automatically. Does NOT fill the slot (value/nicht_befund_typ stay the
   * source of truth for "is this slot done") — it only steers the eventual
   * Clarification Card's bucket options and Card-priority ordering.
   */
  richtung?: 'niedrig' | 'hoch' | null
}

/** Getypte Abhängigkeitskante (depends_on-Array) — PROJ-26/BL-E1.2 */
export interface AbhaengigkeitsKante {
  schritt_id: string
  typ: 'voraussetzung' | 'ressource' | 'ausloeser'
  beschreibung: string | null
}

/** Getypte Einfluss-Kante (influences-Array) — PROJ-26/BL-E1.2 */
export interface EinflussKante {
  schritt_id: string
  typ: 'beeinflusst' | 'terminierung'
  beschreibung: string | null
}

/** Strukturierte Abhängigkeiten eines Prozessschritts (O6) — PROJ-26 */
export interface Abhaengigkeiten {
  depends_on: AbhaengigkeitsKante[]
  influences: EinflussKante[]
  nicht_befund_typ: NichtBefundTyp
}

// ─── PROJ-45: AI-Wert-Faktoren enums ──────────────────────────────────────────

export const AUFGABENTYP_VALUES = [
  'entscheidung',
  'informationsuebertragung',
  'zusammenfassung',
  'suche',
  'klassifikation',
  'generierung',
] as const
export type Aufgabentyp = (typeof AUFGABENTYP_VALUES)[number]

export const RISIKO_SCHWERE_VALUES = [
  'leicht_korrigierbar',
  'teuer',
  'rechtlich_kritisch',
  'kundenkontakt_relevant',
] as const
export type RisikoSchwere = (typeof RISIKO_SCHWERE_VALUES)[number]

export const STANDARDISIERUNGSGRAD_VALUES = [
  'standardisiert',
  'teilweise_standardisiert',
  'stark_variabel',
] as const
export type Standardisierungsgrad = (typeof STANDARDISIERUNGSGRAD_VALUES)[number]

export const INFORMATIONSDICHTE_VALUES = ['strukturiert', 'gemischt', 'unstrukturiert'] as const
export type Informationsdichte = (typeof INFORMATIONSDICHTE_VALUES)[number]

export interface StepEntry {
  /** Stable identifier assigned by register_step: S001, S002, … (PROJ-27/BL-E1.4) */
  id?: string
  title: string
  /** 1-based position in step_tracker array (O1) — set by register_step */
  reihenfolge: number
  status: 'exploring' | 'walkthrough' | 'done'
  /** O6 typed dependency edges — PROJ-26 */
  abhaengigkeiten: Abhaengigkeiten | null
  /** Quantitative KI-Potenzial fields */
  potenzial: {
    frequency: SchemaSlotNumber | null
    duration: SchemaSlotNumber | null
    error_rate_percent: SchemaSlotNumber | null
    media_breaks: SchemaSlotNumber | null
  }
  slots: {
    /** O2 Entscheidungslogik (reguläre, wiederkehrende Verzweigungsregel) */
    entscheidungslogik: SchemaSlotString | null
    /** O2 Tazite Cues / implizites Erfahrungswissen — Aspekt (i), opportunistisch (kein target_o_field) */
    tazite_cues: SchemaSlotStringArray | null
    /** O3 Ausnahmen und Sonderfälle (seltene Abweichungen vom Normalablauf) */
    ausnahmen: SchemaSlotStringArray | null
    /** O4 Inputs — Dateninhalt, keine Systemnamen (die gehören in hilfsmittel) */
    inputs: SchemaSlotStringArray | null
    /** O4 Outputs — Dateninhalt, keine Systemnamen */
    outputs: SchemaSlotStringArray | null
    /** O5 Hilfsmittel / Systeme */
    hilfsmittel: SchemaSlotStringArray | null
    /** PROJ-45: befördert von friction_points (Legacy-Nebenkanal) zu vollwertigem O-Feld */
    reibungspunkte: SchemaSlotStringArray | null
    /** PROJ-45 (neu): externer Auslöser einer Tätigkeit — Freitext. Ein Trigger, der ein anderer registrierter Schritt ist, gehört in abhaengigkeiten (Kantentyp ausloeser), nicht hierher. */
    ausloeser: SchemaSlotString | null
    /** PROJ-45 (neu): Mehrfachauswahl, koexistiert mit entscheidungslogik (bleibt Freitext-Beschreibung der Regel) */
    aufgabentyp: SchemaSlotBase<Aufgabentyp[]> | null
    /** PROJ-45 (neu): Mehrfachauswahl, Konsequenzen nicht gegenseitig exklusiv */
    risiko_schwere: SchemaSlotBase<RisikoSchwere[]> | null
    /** PROJ-45 (neu): Klassifikation aus bereits erhobenem ausnahmen-Inhalt — kein eigenes target_o_field, keine eigene Frage */
    standardisierungsgrad: SchemaSlotBase<Standardisierungsgrad> | null
    /** PROJ-45 (neu): Klassifikation aus bereits erhobenem inputs-/hilfsmittel-Inhalt — kein eigenes target_o_field, keine eigene Frage */
    informationsdichte: SchemaSlotBase<Informationsdichte> | null
  }
  /** Ordered walkthrough sub-steps — additive, unwrapped (no confidence/nicht_befund semantics). Renamed from process_steps (PROJ-45: collided with the process_steps table name). */
  teilschritte?: string[]
  /** Cached Jina v3 embedding of the step title — populated on register_step, used for semantic dedup */
  embedding?: number[]
}

/**
 * Backward-compat read shape: raw JSONB step_tracker entries written before
 * PROJ-45 may still carry these now-removed fields (governance, friction_tools,
 * pain_point_primary, process_steps, top-level friction_points) or the pre-rename
 * potenzial key names (frequency_per_month/duration_minutes, renamed to
 * frequency/duration as part of the H-1 remediation — see interviewAnalyst.ts
 * remediation handoff). Only used by normalizeStepEntry to safely read/ignore
 * them — never written again.
 */
interface RawStepEntry extends Omit<StepEntry, 'slots' | 'teilschritte' | 'potenzial'> {
  slots?: Partial<StepEntry['slots']>
  process_steps?: string[]
  teilschritte?: string[]
  friction_points?: string[]
  potenzial?: Partial<StepEntry['potenzial']> & {
    frequency_per_month?: SchemaSlotNumber | null
    duration_minutes?: SchemaSlotNumber | null
  }
}

/**
 * Backward compat: before B1 fix, patch_interview_step_field received JSON.stringify(value),
 * so objects were stored as JSONB strings. Parse them back to objects on read.
 */
function parseJsonIfString<T>(v: unknown): T | null {
  if (v == null) return null
  if (typeof v !== 'string') return v as T
  try {
    return JSON.parse(v) as T
  } catch {
    return v as T
  }
}

/** Normalizes a SchemaSlotStringArray: empty value:[] → value:null (spec: [] is invalid). */
function normalizeArraySlot<T>(raw: SchemaSlotBase<T[]> | null | undefined): SchemaSlotBase<T[]> | null {
  if (raw == null) return null
  const slot = parseJsonIfString<SchemaSlotBase<T[]>>(raw) ?? raw
  if (Array.isArray(slot.value) && slot.value.length === 0) return { ...slot, value: null }
  return slot
}

/**
 * Normalizes a raw JSONB step entry into the current StepEntry shape.
 * Call at all JSONB read points so old sessions remain readable without a
 * code-side migration. PROJ-45: the pre-PROJ-25 flat-slot legacy branch was
 * removed (verified: 0 real records in that format across all 6 real
 * interviews) — this now only handles the post-PROJ-25/pre-PROJ-45 shape,
 * silently dropping fields removed by PROJ-45 (governance, friction_tools,
 * pain_point_primary) if present in older step_tracker JSONB.
 */
export function normalizeStepEntry(raw: unknown, fallbackReihenfolge: number): StepEntry {
  const r = raw as RawStepEntry

  const potenzial: StepEntry['potenzial'] = {
    // PROJ-45 H-1 remediation: frequency_per_month/duration_minutes renamed to
    // frequency/duration. Fall back to the pre-rename keys so pre-existing
    // step_tracker/schritt_daten JSONB (real interviews + the two eval sessions
    // from the /qa run) remains readable without a data migration.
    frequency: parseJsonIfString(r.potenzial?.frequency ?? r.potenzial?.frequency_per_month),
    duration: parseJsonIfString(r.potenzial?.duration ?? r.potenzial?.duration_minutes),
    error_rate_percent: parseJsonIfString(r.potenzial?.error_rate_percent),
    media_breaks: parseJsonIfString(r.potenzial?.media_breaks),
  }

  return {
    ...(r.id !== undefined ? { id: r.id } : {}),
    title: r.title,
    reihenfolge: r.reihenfolge ?? fallbackReihenfolge,
    abhaengigkeiten: (() => {
      // KI-1 read-compat (decode legacy string) + PROJ-26 typed-edge normalization
      const a = parseJsonIfString<Abhaengigkeiten>(r.abhaengigkeiten)
      return a != null
        ? {
            depends_on: Array.isArray(a.depends_on) ? a.depends_on : [],
            influences: Array.isArray(a.influences) ? a.influences : [],
            nicht_befund_typ: a.nicht_befund_typ ?? null,
          }
        : null
    })(),
    potenzial,
    status: parseJsonIfString<string>(r.status) as StepEntry['status'],
    slots: {
      entscheidungslogik: parseJsonIfString<SchemaSlotString>(r.slots?.entscheidungslogik) ?? null,
      tazite_cues: normalizeArraySlot(r.slots?.tazite_cues),
      ausnahmen: normalizeArraySlot(r.slots?.ausnahmen),
      inputs: normalizeArraySlot(r.slots?.inputs),
      outputs: normalizeArraySlot(r.slots?.outputs),
      hilfsmittel: normalizeArraySlot(r.slots?.hilfsmittel),
      reibungspunkte: normalizeArraySlot(r.slots?.reibungspunkte),
      ausloeser: parseJsonIfString<SchemaSlotString>(r.slots?.ausloeser) ?? null,
      aufgabentyp: normalizeArraySlot(r.slots?.aufgabentyp),
      risiko_schwere: normalizeArraySlot(r.slots?.risiko_schwere),
      standardisierungsgrad: parseJsonIfString(r.slots?.standardisierungsgrad) ?? null,
      informationsdichte: parseJsonIfString(r.slots?.informationsdichte) ?? null,
    },
    teilschritte: r.teilschritte ?? r.process_steps,
    embedding: r.embedding,
  }
}

/**
 * Parses the process_steps.schritt_daten JSONB column (PROJ-45/ADR-025 D1) —
 * a single StepEntry-shaped object (not an array), written verbatim from the
 * step_tracker entry at createProcessStepsFromTracker time. Returns null for
 * pre-PROJ-45 rows that predate this column (no backfill — spec edge case).
 */
export function parseSchrittDaten(raw: unknown): StepEntry | null {
  if (raw == null) return null
  return normalizeStepEntry(raw, 1)
}

// ---------------------------------------------------------------------------
// Slot name constants
// ---------------------------------------------------------------------------

/** Writable quantitative slot keys passed to record_slot */
export const POTENZIAL_SLOT_NAMES = [
  'frequency',
  'duration',
  'error_rate_percent',
  'media_breaks',
] as const

export type PotenzialSlotName = (typeof POTENZIAL_SLOT_NAMES)[number]

/**
 * PROJ-43 (AC3/AC4/AC5): the three potenzial fields that get the new
 * deterministic Card mechanism — `media_breaks` stays out of scope (derived
 * only, never live-asked, unchanged since the original Strom-3 decision, see
 * PROJ-43 spec "Out of Scope").
 */
export const MANDATORY_NUMERIC_SLOTS = ['frequency', 'duration', 'error_rate_percent'] as const

export type MandatoryNumericSlot = (typeof MANDATORY_NUMERIC_SLOTS)[number]

/** Single free-text string slots (SchemaSlotString) writable via record_slot. */
export const TAZITE_STRING_SLOT_NAMES = ['entscheidungslogik', 'ausloeser'] as const

/** Free-text array slots (SchemaSlotStringArray) writable via record_slot. */
export const TAZITE_ARRAY_SLOT_NAMES = [
  'tazite_cues',
  'ausnahmen',
  'inputs',
  'outputs',
  'hilfsmittel',
  'reibungspunkte',
] as const

/** Enum-constrained multi-select slots (PROJ-45 AI-Wert-Faktoren) writable via record_slot. */
export const TAZITE_ENUM_ARRAY_SLOT_NAMES = ['aufgabentyp', 'risiko_schwere'] as const

/** Enum-constrained single-value classification slots — Analyst-derived, no target_o_field, no SLOT_PROMPT_HINT. */
export const TAZITE_ENUM_SINGLE_SLOT_NAMES = ['standardisierungsgrad', 'informationsdichte'] as const

/** All slot-object keys (excludes teilschritte, which is a bare unwrapped array). */
export const TAZITE_SLOT_NAMES = [
  ...TAZITE_STRING_SLOT_NAMES,
  ...TAZITE_ARRAY_SLOT_NAMES,
  ...TAZITE_ENUM_ARRAY_SLOT_NAMES,
  ...TAZITE_ENUM_SINGLE_SLOT_NAMES,
] as const

export type TaziteSlotName = (typeof TAZITE_SLOT_NAMES)[number]

/**
 * O1–O6 coverage fields (9 total). Scored by slotCoverage.ts's dedup_slot_coverage
 * eval metric — bound to the frozen (meridian-ma v1.2) thesis schema.
 * PROJ-45 (ADR-025 D3): stays UNCHANGED, including tazite_cues, even though the
 * Interview-Engine's own target_o_field set (O_SLOT_FIELDS below) has diverged
 * from it — kept as two independent lists so historical KI-18/KI-27 eval
 * comparability isn't broken by the AI-Wert-Faktoren additions.
 * NOTE: potenzial-fields are NOT in this list.
 */
export const COVERAGE_FIELDS = [
  'bezeichnung',       // O1 — maps to StepEntry.title
  'reihenfolge',       // O1 — maps to StepEntry.reihenfolge
  'entscheidungslogik', // O2 — maps to StepEntry.slots.entscheidungslogik
  'tazite_cues',       // O2 — maps to StepEntry.slots.tazite_cues
  'ausnahmen',         // O3 — maps to StepEntry.slots.ausnahmen
  'inputs',            // O4 — maps to StepEntry.slots.inputs
  'outputs',           // O4 — maps to StepEntry.slots.outputs
  'hilfsmittel',       // O5 — maps to StepEntry.slots.hilfsmittel
  'abhaengigkeiten',   // O6 — maps to StepEntry.abhaengigkeiten
] as const

export type CoverageField = (typeof COVERAGE_FIELDS)[number]

/**
 * PROJ-46 (ADR-023 D1) target_o_field set — the Interview-Engine's OWN active
 * elicitation target, independent from COVERAGE_FIELDS (ADR-025 D3). PROJ-45:
 * −tazite_cues (Aspekt-i, opportunistic only), +reibungspunkte/aufgabentyp/
 * risiko_schwere/ausloeser (7 → 10 fields). standardisierungsgrad/
 * informationsdichte are intentionally excluded — Analyst-classified, never a
 * Talker target.
 */
export const O_SLOT_FIELDS = [
  'entscheidungslogik',
  'ausnahmen',
  'inputs',
  'outputs',
  'hilfsmittel',
  'abhaengigkeiten',
  'reibungspunkte',
  'aufgabentyp',
  'risiko_schwere',
  'ausloeser',
] as const

/** The 10 O2–O6 field names as a type (PROJ-46: Analyst's target_o_field enum). */
export type OSlotField = (typeof O_SLOT_FIELDS)[number]

function isFieldFilled(step: StepEntry, field: CoverageField | OSlotField): boolean {
  switch (field) {
    case 'bezeichnung':
      // O1 — title always present (non-empty string = filled)
      return typeof step.title === 'string' && step.title.trim().length > 0
    case 'reihenfolge':
      // O1 — integer set by register_step; always filled for PROJ-25+ entries
      return typeof step.reihenfolge === 'number'
    case 'abhaengigkeiten': {
      const dep = step.abhaengigkeiten
      if (dep == null) return false
      return (
        (Array.isArray(dep.depends_on) && dep.depends_on.length > 0) ||
        (Array.isArray(dep.influences) && dep.influences.length > 0) ||
        dep.nicht_befund_typ != null
      )
    }
    default: {
      const slot = step.slots[field as keyof typeof step.slots]
      if (slot == null) return false
      return slot.value != null || slot.nicht_befund_typ != null
    }
  }
}

/**
 * True iff an O1–O6 coverage field is "filled" for a step (non-null value OR an
 * explicit nicht_befund_typ). Used by the dedup_slot_coverage eval scorer
 * (slotCoverage.ts) — bound to COVERAGE_FIELDS (frozen thesis schema).
 */
export function isCoverageFieldFilled(step: StepEntry, field: CoverageField): boolean {
  return isFieldFilled(step, field)
}

/**
 * True iff an Interview-Engine target_o_field is "filled" for a step. Used by
 * the O-Drought primitive (interviewOrchestrator.ts) — bound to O_SLOT_FIELDS
 * (PROJ-45/46, diverges from COVERAGE_FIELDS per ADR-025 D3).
 */
export function isOFieldFilled(step: StepEntry, field: OSlotField): boolean {
  return isFieldFilled(step, field)
}

/** Count of filled target_o_field fields for a step — the "depth" signal the O-Drought streak tracks. */
export function countFilledOFields(step: StepEntry): number {
  return O_SLOT_FIELDS.filter((f) => isOFieldFilled(step, f)).length
}

/**
 * PROJ-46 QA H-1 Fix D: true iff the total count of filled target_o_field
 * fields across the WHOLE tracker increased between before/after — "real new
 * process depth", as opposed to "any applied knowledge-tool write" (interviewAnalyst.ts's
 * former hasAppliedExtraction), which also fired on re-records, potenzial-only writes
 * (frequency/duration/error_rate/media_breaks) and floskel-triggered slots (run1
 * t34: 16 record_slot calls on a goodbye courtesy phrase). That over-broad signal
 * powered both the No-New-Extraction streak (interviewAnalyst.ts's
 * computeNextBriefing) and the M7-b closing-reentry veto
 * (runInterviewTurn.ts's hadExtractionThisTurn) — noise on either kept resetting
 * the streak AND kept bouncing Closing back to Explore every turn, so the two
 * deterministic termination floors (O-Drought exhaustion, no-new-extraction
 * streak) never actually got a chance to fire. Sum-based (not id-matched) so a
 * same-pass step merge (computeMergedSteps) can't spuriously flip the result.
 */
export function hasNewOField(beforeTracker: StepEntry[], afterTracker: StepEntry[]): boolean {
  const sumFilled = (tracker: StepEntry[]) => tracker.reduce((sum, s) => sum + countFilledOFields(s), 0)
  return sumFilled(afterTracker) > sumFilled(beforeTracker)
}

// ---------------------------------------------------------------------------
// Einheiten-Unabhängigkeit (PROJ-45/ADR-025 D5) — deterministic unit conversion
// ---------------------------------------------------------------------------
// Converts a potenzial SchemaSlotNumber to its canonical unit (Monat für
// Häufigkeit, Minuten für Dauer) at USE time (ROI-Berechnung, Reports, Use-Case
// Engine) — never by the LLM at elicitation time. Absent/unrecognized `einheit`
// defaults to the canonical unit (matches how the 6 pre-PROJ-45 interviews were
// recorded — spec edge case: "als implizite Einheit Monat/Minuten interpretieren").

const HAEUFIGKEIT_TO_MONATLICH: Record<string, number> = {
  pro_tag: 30,
  pro_woche: 30 / 7,
  pro_monat: 1,
  pro_quartal: 1 / 3,
  pro_jahr: 1 / 12,
}

const DAUER_TO_MINUTEN: Record<string, number> = {
  minuten: 1,
  stunden: 60,
  tage: 480, // 1 Arbeitstag = 8h
}

function resolveWithFactorTable(slot: SchemaSlotNumber | null | undefined, table: Record<string, number>): number | null {
  if (slot?.value == null) return null
  // Absent einheit → intentional default (ADR-025 D5, canonical unit). A PRESENT but
  // unrecognized einheit (e.g. a ratio like "pro_100_rechnungen") is a different case:
  // we have no idea how to convert it, so signal "not computable" instead of silently
  // guessing factor 1 (KI-33 — that guess previously corrupted ROI numbers).
  if (slot.einheit == null) return Math.round(slot.value * 100) / 100
  const factor = table[slot.einheit]
  if (factor == null) return null
  return Math.round(slot.value * factor * 100) / 100
}

/** Resolves a haeufigkeit (frequency) slot to its canonical "pro Monat" value. */
export function resolveHaeufigkeitProMonat(slot: SchemaSlotNumber | null | undefined): number | null {
  return resolveWithFactorTable(slot, HAEUFIGKEIT_TO_MONATLICH)
}

/** Resolves a dauer (duration) slot to its canonical "Minuten" value. */
export function resolveDauerMinuten(slot: SchemaSlotNumber | null | undefined): number | null {
  return resolveWithFactorTable(slot, DAUER_TO_MINUTEN)
}

const STEP_STOPWORDS = new Set(['und', 'oder', 'per', 'bei', 'im', 'von', 'mit', 'der', 'die', 'das'])

export function normalizeToken(t: string): string {
  return t
    .replace(/(prozess|wesen|ablauf|vorgang|schritt|bearbeitung|handling|verwaltung|management)$/i, '')
    .trim()
}

export function colonParent(title: string): string | null {
  const idx = title.indexOf(':')
  return idx > 2 ? title.slice(0, idx).trim().toLowerCase() : null
}

export function tokenJaccard(a: string, b: string): number {
  const tokenize = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[-().,&/: ]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length >= 4 && !STEP_STOPWORDS.has(t)),
    )
  const ta = tokenize(a)
  const tb = tokenize(b)
  if (ta.size === 0 || tb.size === 0) return 0
  let intersection = 0
  for (const t of ta) if (tb.has(t)) intersection++
  return intersection / (ta.size + tb.size - intersection)
}

function normalizedTokenSet(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[-().,&/: ]/g, ' ')
      .split(/\s+/)
      .map((t) => normalizeToken(t))
      .filter((t) => t.length >= 4 && !STEP_STOPWORDS.has(t)),
  )
}

export function tokenJaccardNorm(a: string, b: string): number {
  const ta = normalizedTokenSet(a)
  const tb = normalizedTokenSet(b)
  if (ta.size === 0 || tb.size === 0) return 0
  let intersection = 0
  for (const t of ta) if (tb.has(t)) intersection++
  return intersection / (ta.size + tb.size - intersection)
}

/**
 * Groups semantically equivalent steps into clusters.
 *
 * Matching priority:
 *   1. Shared colon-parent ("Foo: a" and "Foo: b" → same group)
 *   2. tokenJaccardNorm ≥ threshold
 */
export function groupSemanticSteps(tracker: StepEntry[], threshold = 0.4): StepEntry[][] {
  const groups: StepEntry[][] = []
  for (const step of tracker) {
    const parent = colonParent(step.title)
    let idx = -1
    if (parent !== null) {
      idx = groups.findIndex((g) => g.some((s) => colonParent(s.title) === parent))
    }
    if (idx < 0) {
      idx = groups.findIndex((g) => g.some((s) => tokenJaccardNorm(s.title, step.title) >= threshold))
    }
    if (idx >= 0) groups[idx].push(step)
    else groups.push([step])
  }
  return groups
}

// ---------------------------------------------------------------------------
// Knowledge-extraction shared types (moved from extraction.ts — #20, 2026-07-14)
// Referenced by InterviewContext.extractionsLog; kept here (not in extraction.ts,
// which is Prozessbasis) so Interview-Engine consumers (talkerPrompt.ts,
// runInterviewTurn.ts, start/reconnect routes, turnStore) don't import from
// Prozessbasis merely for this type. extraction.ts imports both back.
// ---------------------------------------------------------------------------

export type KnowledgeObjectType = 'process_step' | 'pain_point' | 'tool'

export interface RawExtraction {
  type: KnowledgeObjectType
  content: Record<string, unknown>
  source_quote: string
}
