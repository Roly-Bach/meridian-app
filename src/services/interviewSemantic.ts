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

export interface SlotValue {
  value: string | number | boolean | string[] | null
  quote: string
  confidence?: 'confirmed' | 'estimate' | 'unknown'
  qualifier?: string | null
  /** Which write path last successfully wrote this slot — used for conflict resolution */
  writeSource?: 'analyst_catchup' | 'analyst_online' | 'backfill' | 'analyst'
  /** Explicit non-finding marker — deckungsgleich mit TaziteSlot/Schema NichtBefundTyp (PROJ-28/BL-E2.1) */
  nicht_befund_typ?: NichtBefundTyp
}

export type NichtBefundTyp = 'nicht_zutreffend' | 'unbekannt' | 'verweigert' | null

/** Taziter Einzel-Slot: wörtlicher Beleg + nicht_befund_typ für Coverage-Bewertung */
export interface TaziteSlot {
  value: string | null
  quote: string | null
  confidence?: 'confirmed' | 'estimate' | 'unknown'
  nicht_befund_typ: NichtBefundTyp
}

/** Taziter Mehrwert-Slot (leeres Array [] ist ungültig → value: null + nicht_befund_typ setzen) */
export interface TaziteSlotArray {
  value: string[] | null
  quote: string | null
  confidence?: 'confirmed' | 'estimate' | 'unknown'
  nicht_befund_typ: NichtBefundTyp
}

/** Governance-Objekt: organisationale Einbettung eines Prozessschritts */
export interface GovernanceSlot {
  rolle: string | null
  organisationseinheit: string | null
  systeme: string[] | null
  nicht_befund_typ: NichtBefundTyp
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

export interface StepEntry {
  /** Stable identifier assigned by register_step: S001, S002, … (PROJ-27/BL-E1.4) */
  id?: string
  title: string
  /** 1-based position in step_tracker array (O1) — set by register_step */
  reihenfolge: number
  /** Replaces free-text role field */
  governance: GovernanceSlot | null
  /** O6 typed dependency edges — PROJ-26 */
  abhaengigkeiten: Abhaengigkeiten | null
  /** Quantitative KI-Potenzial fields (moved from slots) */
  potenzial: {
    frequency_per_month: SlotValue | null
    duration_minutes: SlotValue | null
    error_rate_percent: SlotValue | null
    media_breaks: SlotValue | null
  }
  status: 'exploring' | 'walkthrough' | 'done'
  slots: {
    /** O2 Entscheidungslogik (was: rule_based boolean) */
    entscheidungslogik: TaziteSlot | null
    /** O2 Tazite Cues / implizites Erfahrungswissen */
    tazite_cues: TaziteSlotArray | null
    /** O3 Ausnahmen und Sonderfälle */
    ausnahmen: TaziteSlotArray | null
    /** O4 Inputs */
    inputs: TaziteSlotArray | null
    /** O4 Outputs */
    outputs: TaziteSlotArray | null
    /** O5 Hilfsmittel / Systeme (was: data_sources) */
    hilfsmittel: TaziteSlotArray | null
  }
  process_steps?: string[]
  friction_points?: string[]
  friction_tools?: string[]
  pain_point_primary?: string | null
  /** Cached Jina v3 embedding of the step title — populated on register_step, used for semantic dedup */
  embedding?: number[]
}

/** Legacy JSONB shape (pre-PROJ-25) — used by normalizeStepEntry for backward compat */
interface LegacyStepEntry {
  id?: string
  title: string
  role?: string | null
  status: 'exploring' | 'walkthrough' | 'done'
  slots: {
    frequency_per_month?: SlotValue | null
    duration_minutes?: SlotValue | null
    rule_based?: SlotValue | null
    data_sources?: SlotValue | null
    error_rate_percent?: SlotValue | null
    media_breaks?: SlotValue | null
    // new tazite fields may already be present in partially-migrated entries
    entscheidungslogik?: TaziteSlot | null
    tazite_cues?: TaziteSlotArray | null
    ausnahmen?: TaziteSlotArray | null
    inputs?: TaziteSlotArray | null
    outputs?: TaziteSlotArray | null
    hilfsmittel?: TaziteSlotArray | null
  }
  potenzial?: {
    frequency_per_month?: SlotValue | null
    duration_minutes?: SlotValue | null
    error_rate_percent?: SlotValue | null
    media_breaks?: SlotValue | null
  } | null
  reihenfolge?: number
  governance?: GovernanceSlot | null
  abhaengigkeiten?: Abhaengigkeiten | null
  process_steps?: string[]
  friction_points?: string[]
  friction_tools?: string[]
  pain_point_primary?: string | null
  embedding?: number[]
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

/** Normalizes a TaziteSlotArray: empty value:[] → value:null (spec: [] is invalid). */
function normalizeArraySlot(raw: TaziteSlotArray | null | undefined): TaziteSlotArray | null {
  if (raw == null) return null
  const slot = parseJsonIfString<TaziteSlotArray>(raw) ?? raw
  if (Array.isArray(slot.value) && slot.value.length === 0) return { ...slot, value: null }
  return slot
}

/**
 * Normalizes a raw JSONB step entry into the current StepEntry shape.
 * Handles both pre-PROJ-25 (flat slots) and post-PROJ-25 (potenzial + tazite slots).
 * Call at all JSONB read points so old sessions remain readable without a code-side migration.
 */
export function normalizeStepEntry(raw: unknown, fallbackReihenfolge: number): StepEntry {
  const r = raw as LegacyStepEntry

  // Determine if this is a legacy entry (quantitative fields still in slots)
  const isLegacy =
    r.potenzial == null &&
    (r.slots?.frequency_per_month !== undefined ||
      r.slots?.duration_minutes !== undefined ||
      r.slots?.rule_based !== undefined ||
      r.slots?.data_sources !== undefined ||
      r.slots?.error_rate_percent !== undefined ||
      r.slots?.media_breaks !== undefined)

  let potenzial: StepEntry['potenzial']
  let entscheidungslogik: TaziteSlot | null
  let hilfsmittel: TaziteSlotArray | null

  if (isLegacy) {
    // Move quantitative fields from slots to potenzial
    potenzial = {
      frequency_per_month: r.slots?.frequency_per_month ?? null,
      duration_minutes: r.slots?.duration_minutes ?? null,
      error_rate_percent: r.slots?.error_rate_percent ?? null,
      media_breaks: r.slots?.media_breaks ?? null,
    }

    // rule_based (boolean SlotValue) → entscheidungslogik (TaziteSlot)
    const ruleBasedSlot = r.slots?.rule_based
    if (ruleBasedSlot != null) {
      entscheidungslogik = {
        value: `rule_based: ${String(ruleBasedSlot.value)}`,
        quote: ruleBasedSlot.quote,
        confidence: ruleBasedSlot.confidence,
        nicht_befund_typ: null,
      }
    } else {
      entscheidungslogik = r.slots?.entscheidungslogik ?? null
    }

    // data_sources (string[] SlotValue) → hilfsmittel (TaziteSlotArray)
    const dataSourcesSlot = r.slots?.data_sources
    if (dataSourcesSlot != null) {
      const val = dataSourcesSlot.value
      hilfsmittel = {
        value: Array.isArray(val) && val.length > 0 ? val : val != null && !Array.isArray(val) ? [String(val)] : null,
        quote: dataSourcesSlot.quote,
        confidence: dataSourcesSlot.confidence,
        nicht_befund_typ: null,
      }
    } else {
      hilfsmittel = r.slots?.hilfsmittel ?? null
    }
  } else {
    potenzial = {
      frequency_per_month: parseJsonIfString(r.potenzial?.frequency_per_month),
      duration_minutes: parseJsonIfString(r.potenzial?.duration_minutes),
      error_rate_percent: parseJsonIfString(r.potenzial?.error_rate_percent),
      media_breaks: parseJsonIfString(r.potenzial?.media_breaks),
    }
    entscheidungslogik = parseJsonIfString<TaziteSlot>(r.slots?.entscheidungslogik) ?? null
    hilfsmittel = parseJsonIfString<TaziteSlotArray>(r.slots?.hilfsmittel) ?? null
  }

  // Governance: migrate free-text role if governance not yet set
  let governance: GovernanceSlot | null = parseJsonIfString<GovernanceSlot>(r.governance) ?? null
  if (governance == null && r.role != null) {
    governance = {
      rolle: r.role,
      organisationseinheit: null,
      systeme: null,
      nicht_befund_typ: null,
    }
  }

  return {
    ...(r.id !== undefined ? { id: r.id } : {}),
    title: r.title,
    reihenfolge: r.reihenfolge ?? fallbackReihenfolge,
    governance,
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
      entscheidungslogik,
      tazite_cues: normalizeArraySlot(r.slots?.tazite_cues),
      ausnahmen: normalizeArraySlot(r.slots?.ausnahmen),
      inputs: normalizeArraySlot(r.slots?.inputs),
      outputs: normalizeArraySlot(r.slots?.outputs),
      hilfsmittel: normalizeArraySlot(hilfsmittel),
    },
    process_steps: r.process_steps,
    friction_points: r.friction_points,
    friction_tools: r.friction_tools,
    pain_point_primary: r.pain_point_primary ?? null,
    embedding: r.embedding,
  }
}

// ---------------------------------------------------------------------------
// Slot name constants
// ---------------------------------------------------------------------------

/** Legacy quantitative slots — kept for backward compat with existing callers */
export const MANDATORY_SLOTS = [
  'frequency_per_month',
  'duration_minutes',
  'rule_based',
  'data_sources',
] as const

export const OPTIONAL_SLOTS = ['error_rate_percent', 'media_breaks'] as const

/** @deprecated Use TAZITE_SLOT_NAMES + POTENZIAL_SLOT_NAMES instead */
export type SlotName = (typeof MANDATORY_SLOTS)[number] | (typeof OPTIONAL_SLOTS)[number]

/** Writable tazite slot keys (O2–O5) passed to record_slot */
export const TAZITE_SLOT_NAMES = [
  'entscheidungslogik',
  'tazite_cues',
  'ausnahmen',
  'inputs',
  'outputs',
  'hilfsmittel',
] as const

export type TaziteSlotName = (typeof TAZITE_SLOT_NAMES)[number]

/** Writable quantitative slot keys passed to record_slot */
export const POTENZIAL_SLOT_NAMES = [
  'frequency_per_month',
  'duration_minutes',
  'error_rate_percent',
  'media_breaks',
] as const

export type PotenzialSlotName = (typeof POTENZIAL_SLOT_NAMES)[number]

/**
 * O1–O6 coverage fields (9 total). Scored by slotCoverage.ts.
 * NOTE: potenzial-fields and governance are NOT in this list.
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
 * True iff an O1–O6 coverage field is "filled" for a step (non-null value OR an
 * explicit nicht_befund_typ). Shared by the dedup_slot_coverage eval scorer
 * (slotCoverage.ts) and the O-Drought primitive (interviewOrchestrator.ts,
 * PROJ-44 Remediation) so both stay behaviorally identical.
 */
export function isCoverageFieldFilled(step: StepEntry, field: CoverageField): boolean {
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
      // O2–O5 tazite slots — field name matches slots key directly
      const slot = step.slots[field as keyof typeof step.slots]
      if (slot == null) return false
      return slot.value != null || slot.nicht_befund_typ != null
    }
  }
}

/**
 * O2–O6 fields only — excludes the auto-filled O1 (bezeichnung/reihenfolge).
 * The "substantial" coverage fields the O-Drought primitive tracks (PROJ-44
 * Remediation): a step whose O1 alone is set (just registered) has made no
 * qualitative progress yet.
 */
export const O_SLOT_FIELDS = COVERAGE_FIELDS.filter(
  (f): f is Exclude<CoverageField, 'bezeichnung' | 'reihenfolge'> => f !== 'bezeichnung' && f !== 'reihenfolge',
)

/** Count of filled O2–O6 fields for a step — the "depth" signal the O-Drought streak tracks. */
export function countFilledOFields(step: StepEntry): number {
  return O_SLOT_FIELDS.filter((f) => isCoverageFieldFilled(step, f)).length
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

// ---------------------------------------------------------------------------
// Schema-conformant types (PROJ-25/27) — mirrors prozessschritt-schema.json
// ---------------------------------------------------------------------------

export type Konfidenz = 0.9 | 0.6 | 0.3 | null

export interface SchemaSlotString {
  wert: string | null
  konfidenz: Konfidenz
  nicht_befund_typ: NichtBefundTyp
}

export interface SchemaSlotStringArray {
  wert: string[] | null
  konfidenz: Konfidenz
  nicht_befund_typ: NichtBefundTyp
}

export interface SchemaSlotNumber {
  wert: number | null
  konfidenz: Konfidenz
  nicht_befund_typ: NichtBefundTyp
}

export interface SchemaPotenzial {
  haeufigkeit_pro_monat: SchemaSlotNumber
  dauer_minuten: SchemaSlotNumber
  fehlerquote_prozent: SchemaSlotNumber
  medienbrueche: SchemaSlotNumber
}

export interface SchemaGovernance {
  rolle: string | null
  organisationseinheit: string | null
  systeme: string[] | null
  nicht_befund_typ: NichtBefundTyp
}

export interface SchemaAbhaengigkeiten {
  depends_on: AbhaengigkeitsKante[]
  influences: EinflussKante[]
  nicht_befund_typ: NichtBefundTyp
}

/** Schema-conformant Prozessschritt object (validated against prozessschritt-schema.json#/definitions/Schritt) */
export interface Schritt {
  id: string
  bezeichnung: SchemaSlotString
  reihenfolge: number
  entscheidungslogik: SchemaSlotString
  tazite_cues: SchemaSlotStringArray
  ausnahmen: SchemaSlotStringArray
  inputs: SchemaSlotStringArray
  outputs: SchemaSlotStringArray
  hilfsmittel: SchemaSlotStringArray
  abhaengigkeiten: SchemaAbhaengigkeiten
  potenzial?: SchemaPotenzial
  governance?: SchemaGovernance
}

/**
 * Maps a StepEntry to the schema-conformant Schritt form.
 * Used by schemaConformanceRate scorer and future PROJ-26 edge extraction.
 */
export function toGrenzobjekt(step: StepEntry, fallbackIndex: number): Schritt {
  const id = step.id ?? `S${String(fallbackIndex).padStart(3, '0')}`

  function conf(c: 'confirmed' | 'estimate' | 'unknown' | undefined, hasValue: boolean): Konfidenz {
    if (c === 'confirmed') return 0.9
    if (c === 'estimate') return 0.6
    if (c === 'unknown') return 0.3
    return hasValue ? 0.9 : null
  }

  function mapTaziteSlot(ts: TaziteSlot | null): SchemaSlotString {
    if (ts == null) return { wert: null, konfidenz: null, nicht_befund_typ: null }
    return { wert: ts.value, konfidenz: conf(ts.confidence, ts.value != null), nicht_befund_typ: ts.nicht_befund_typ ?? null }
  }

  function mapTaziteSlotArray(tsa: TaziteSlotArray | null): SchemaSlotStringArray {
    if (tsa == null) return { wert: null, konfidenz: null, nicht_befund_typ: null }
    return { wert: tsa.value, konfidenz: conf(tsa.confidence, tsa.value != null), nicht_befund_typ: tsa.nicht_befund_typ ?? null }
  }

  function mapPotenzialSlot(sv: SlotValue | null): SchemaSlotNumber {
    if (sv == null) return { wert: null, konfidenz: null, nicht_befund_typ: null }
    return {
      wert: typeof sv.value === 'number' ? sv.value : null,
      konfidenz: conf(sv.confidence, sv.value != null),
      nicht_befund_typ: sv.nicht_befund_typ ?? null,
    }
  }

  const schritt: Schritt = {
    id,
    bezeichnung: { wert: step.title, konfidenz: 0.9, nicht_befund_typ: null },
    reihenfolge: step.reihenfolge,
    entscheidungslogik: mapTaziteSlot(step.slots.entscheidungslogik),
    tazite_cues: mapTaziteSlotArray(step.slots.tazite_cues),
    ausnahmen: mapTaziteSlotArray(step.slots.ausnahmen),
    inputs: mapTaziteSlotArray(step.slots.inputs),
    outputs: mapTaziteSlotArray(step.slots.outputs),
    hilfsmittel: mapTaziteSlotArray(step.slots.hilfsmittel),
    abhaengigkeiten: step.abhaengigkeiten ?? { depends_on: [], influences: [], nicht_befund_typ: null },
  }

  const p = step.potenzial
  if (p.frequency_per_month != null || p.duration_minutes != null || p.error_rate_percent != null || p.media_breaks != null) {
    schritt.potenzial = {
      haeufigkeit_pro_monat: mapPotenzialSlot(p.frequency_per_month),
      dauer_minuten: mapPotenzialSlot(p.duration_minutes),
      fehlerquote_prozent: mapPotenzialSlot(p.error_rate_percent),
      medienbrueche: mapPotenzialSlot(p.media_breaks),
    }
  }

  if (step.governance != null) {
    schritt.governance = {
      rolle: step.governance.rolle,
      organisationseinheit: step.governance.organisationseinheit,
      systeme: step.governance.systeme,
      nicht_befund_typ: step.governance.nicht_befund_typ,
    }
  }

  return schritt
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
// Slot-Compute helpers (moved from interviewAgent.ts — PROJ-35)
// ---------------------------------------------------------------------------

export interface MissingSlot {
  step_title: string
  slot: TaziteSlotName | PotenzialSlotName
  /** 'missing' = null gap; 'low_confidence' = estimate/unknown value needs confirmation (PROJ-28/BL-E2.2) */
  reason?: 'missing' | 'low_confidence'
}

export function computeMissingMandatorySlots(stepTracker: StepEntry[]): MissingSlot[] {
  const missing: MissingSlot[] = []
  for (const step of stepTracker) {
    // Potenzial (quantitative) slots — explicit filled check (PROJ-28/BL-E2.1)
    for (const slot of POTENZIAL_SLOT_NAMES) {
      const sv = step.potenzial[slot]
      const filled = sv != null && (sv.value != null || (sv.nicht_befund_typ ?? null) != null)
      if (!filled) {
        missing.push({ step_title: step.title, slot, reason: 'missing' })
      }
    }
    // Tazite (qualitative) slots
    for (const slot of TAZITE_SLOT_NAMES) {
      const sv = step.slots[slot]
      const filled = sv != null && (sv.value != null || sv.nicht_befund_typ != null)
      if (!filled) {
        missing.push({ step_title: step.title, slot, reason: 'missing' })
      }
    }
  }
  return missing
}

// L1 — Slot-Targeting für die explore Phase (PROJ-42: vormals walkthrough_step).
// Wählt deterministisch genau EINEN missing slot für den aktuell aktiven
// Step (walkthrough > exploring). Zwei-Pass-Priorität (PROJ-28/BL-E2.2):
//   Pass 1: echte Lücken (null-Slots) — potenzial zuerst, dann tazite
//   Pass 2: unsicher belegte Slots (estimate/unknown) — für Bestätigungs-Rückfrage
// Volle Gesprächsführungs-Revision ist PROJ-29.
export function computeWalkthroughSlotTarget(stepTracker: StepEntry[]): MissingSlot | null {
  const active =
    stepTracker.find((s) => s.status === 'walkthrough') ??
    stepTracker.find((s) => s.status === 'exploring')
  if (!active) return null

  // Pass 1: real gaps — potenzial null-Lücken first
  for (const slot of POTENZIAL_SLOT_NAMES) {
    const sv = active.potenzial[slot]
    const filled = sv != null && (sv.value != null || (sv.nicht_befund_typ ?? null) != null)
    if (!filled) {
      return { step_title: active.title, slot, reason: 'missing' }
    }
  }
  // Pass 1 cont: tazite null-Lücken
  for (const slot of TAZITE_SLOT_NAMES) {
    const sv = active.slots[slot]
    const filled = sv != null && (sv.value != null || sv.nicht_befund_typ != null)
    if (!filled) {
      return { step_title: active.title, slot, reason: 'missing' }
    }
  }

  // Pass 2: low-confidence slots need confirmation (estimate/unknown)
  for (const slot of POTENZIAL_SLOT_NAMES) {
    const sv = active.potenzial[slot]
    if (sv != null && sv.value != null && (sv.confidence === 'estimate' || sv.confidence === 'unknown')) {
      return { step_title: active.title, slot, reason: 'low_confidence' }
    }
  }
  for (const slot of TAZITE_SLOT_NAMES) {
    const sv = active.slots[slot]
    if (sv != null && sv.value != null && (sv.confidence === 'estimate' || sv.confidence === 'unknown')) {
      return { step_title: active.title, slot, reason: 'low_confidence' }
    }
  }

  return null
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
