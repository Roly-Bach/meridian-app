// Use Case Heuristic Engine — pure TypeScript, no LLM, no external services.
// 8 rules covering all relevant KI automation patterns.
// Per process step + type: only the highest ROI use case is kept.

// ── Configurable Thresholds ──────────────────────────────────────────────────
export const SCORE_HIGH_THRESHOLD = 5000   // Q1 / priority high
export const SCORE_MEDIUM_THRESHOLD = 1000 // Q2 / priority medium
export const EFFORT_FACTORS = { low: 1, medium: 2, high: 3 } as const

const DOC_SOURCES = ['e-mail', 'email', 'pdf', 'word']
const SEARCH_KEYWORDS = ['suchen', 'nachschlagen', 'klären', 'prüfen', 'finden', 'recherchieren']

// ── Input / Output Types ─────────────────────────────────────────────────────

export interface EngineProcessStep {
  id: string
  workspace_id: string
  interview_id: string
  title: string
  description: string | null
  frequency_per_month: number | null
  duration_minutes: number | null
  data_sources: string[]
  rule_based: boolean
  error_rate_percent: number | null
  media_breaks: number
}

export interface KnowledgeObjectContext {
  type: 'pain_point' | 'tool'
  content: Record<string, unknown>
  interview_id: string
}

export interface GeneratedUseCase {
  process_step_id: string
  workspace_id: string
  type: string
  title: string
  description: string
  reasoning: string
  effort: 'low' | 'medium' | 'high'
  roi_hours_per_year: number | null
  roi_eur_per_year: number | null
  score: number
  priority: 'high' | 'medium' | 'low'
  quarter: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function r2(n: number): number {
  return Math.round(n * 100) / 100
}

function roi(step: EngineProcessStep, rate: number, hourlyRate: number): number {
  return r2((step.frequency_per_month! * step.duration_minutes! / 60) * 12 * rate * hourlyRate)
}

function hours(step: EngineProcessStep, rate: number): number {
  return r2((step.frequency_per_month! * step.duration_minutes! / 60) * 12 * rate)
}

function score(roiEur: number, effort: keyof typeof EFFORT_FACTORS): number {
  // Raw score for priority/quarter logic; stored value capped at 999.99
  // to fit numeric(5,2) DB column until schema migration runs.
  return Math.min(r2(roiEur / EFFORT_FACTORS[effort]), 999.99)
}

function rawScore(roiEur: number, effort: keyof typeof EFFORT_FACTORS): number {
  return r2(roiEur / EFFORT_FACTORS[effort])
}

function priority(sc: number): 'high' | 'medium' | 'low' {
  if (sc > SCORE_HIGH_THRESHOLD) return 'high'
  if (sc > SCORE_MEDIUM_THRESHOLD) return 'medium'
  return 'low'
}

function quarter(sc: number): string {
  if (sc > SCORE_HIGH_THRESHOLD) return 'Q1'
  if (sc > SCORE_MEDIUM_THRESHOLD) return 'Q2'
  return 'Q3'
}

function hasDocSources(sources: string[]): boolean {
  return sources.some((s) => DOC_SOURCES.includes(s.toLowerCase()))
}

export function hasSearchKeywords(step: EngineProcessStep): boolean {
  const text = `${step.title} ${step.description ?? ''}`.toLowerCase()
  return SEARCH_KEYWORDS.some((kw) => text.includes(kw))
}

function canCompute(step: EngineProcessStep): boolean {
  return step.frequency_per_month != null && step.duration_minutes != null
}

function makeUC(
  step: EngineProcessStep,
  type: string,
  title: string,
  description: string,
  reasoning: string,
  effort: 'low' | 'medium' | 'high',
  rate: number,
  hourlyRate: number
): GeneratedUseCase {
  const roiEur = roi(step, rate, hourlyRate)
  const sc = score(roiEur, effort)
  const scRaw = rawScore(roiEur, effort)
  return {
    process_step_id: step.id,
    workspace_id: step.workspace_id,
    type,
    title,
    description,
    reasoning,
    effort,
    roi_hours_per_year: hours(step, rate),
    roi_eur_per_year: roiEur,
    score: sc,
    priority: priority(scRaw),
    quarter: quarter(scRaw),
  }
}

// ── Engine ───────────────────────────────────────────────────────────────────

const MANUAL_KEYWORDS = ['manuell', 'händisch', 'excel', 'copy', 'kopier', 'abtippen', 'per hand']

// ── Qualitative Use Case builder (no ROI) ────────────────────────────────────

function makeQualitativeUC(
  step: EngineProcessStep,
  type: string,
  title: string,
  description: string,
  reasoning: string,
  effort: 'low' | 'medium' | 'high',
  pri: 'high' | 'medium' | 'low',
): GeneratedUseCase {
  return {
    process_step_id: step.id,
    workspace_id: step.workspace_id,
    type,
    title,
    description,
    reasoning,
    effort,
    roi_hours_per_year: null,
    roi_eur_per_year: null,
    score: pri === 'high' ? 50 : pri === 'medium' ? 30 : 10,
    priority: pri,
    quarter: pri === 'high' ? 'Q1' : pri === 'medium' ? 'Q2' : 'Q3',
  }
}

export function runHeuristicEngine(
  steps: EngineProcessStep[],
  hourlyRate: number,
  knowledgeObjects: KnowledgeObjectContext[] = []
): GeneratedUseCase[] {
  const results: GeneratedUseCase[] = []

  for (const step of steps) {
    if (!canCompute(step)) continue

    // Per type: track best (highest ROI) candidate
    const best = new Map<string, GeneratedUseCase>()

    function add(uc: GeneratedUseCase) {
      const existing = best.get(uc.type)
      if (!existing || (uc.roi_eur_per_year ?? 0) > (existing.roi_eur_per_year ?? 0)) {
        best.set(uc.type, uc)
      }
    }

    // R1 — Vollautomatisierung
    // Häufiger, regelbasierter Prozess ohne Fehlerprobleme → vollständig automatisierbar
    if (
      step.frequency_per_month! >= 20 &&
      step.rule_based &&
      (step.error_rate_percent == null || step.error_rate_percent < 10)
    ) {
      add(makeUC(step, 'automation',
        `${step.title} automatisieren`,
        'Vollständige Automatisierung durch RPA oder Scripting eliminiert manuelle Arbeit.',
        'Häufiger, regelbasierter Prozess mit niedriger Fehlerrate — optimaler Automatisierungskandidat.',
        'low', 0.85, hourlyRate))
    }

    // R2 — LLM-Extraktion
    // Dokumente werden manuell gelesen → LLM extrahiert Informationen automatisch
    if (hasDocSources(step.data_sources) && step.duration_minutes! >= 15) {
      add(makeUC(step, 'llm_extraction',
        `${step.title} — Dokumenten-Extraktion`,
        'LLM extrahiert strukturierte Informationen aus E-Mails, PDFs oder Word-Dokumenten.',
        `Datenquellen (${step.data_sources.join(', ')}) enthalten unstrukturierte Infos — LLM-Extraktion spart Lesezeit.`,
        'medium', 0.40, hourlyRate))
    }

    // R3 — Entscheidungsunterstützung
    // Urteilsbasierter Prozess mit hoher Fehlerrate → KI reduziert Fehlentscheidungen
    if (
      !step.rule_based &&
      step.duration_minutes! >= 30 &&
      step.error_rate_percent != null &&
      step.error_rate_percent >= 10
    ) {
      add(makeUC(step, 'decision_support',
        `${step.title} — KI-Entscheidungshilfe`,
        'KI gibt Empfehlungen und reduziert Entscheidungsfehler durch Mustererkennung.',
        `Nicht-regelbasierter Prozess mit ${step.error_rate_percent}% Fehlerrate — KI-Empfehlungen verbessern Qualität.`,
        'high', 0.40, hourlyRate))
    }

    // R4 — Medienbruch-Automatisierung
    // Manuelle Datenübertragung zwischen Systemen → API-Integration oder RPA
    if (step.media_breaks >= 3) {
      add(makeUC(step, 'automation',
        `${step.title} — Medienbrüche eliminieren`,
        'Automatische Datenübertragung zwischen Systemen via API-Integration oder RPA.',
        `${step.media_breaks} Medienbrüche identifiziert — Systemintegration spart manuelle Übertragungsarbeit.`,
        'low', 0.60, hourlyRate))
    }

    // R5 — RAG Wissensassistent
    // Prozess enthält Suchen/Nachschlagen → KI beantwortet Fragen sofort
    if (hasSearchKeywords(step) && step.duration_minutes! >= 10) {
      add(makeUC(step, 'rag',
        `${step.title} — Wissensassistent`,
        'RAG-System beantwortet Fragen sofort aus der Unternehmenswissensbasis.',
        'Prozess enthält Suchen oder Nachschlagen — KI-Wissensassistent reduziert Recherchezeit um 50%.',
        'medium', 0.50, hourlyRate))
    }

    // R6 — Fehlerhafte Regelautomatisierung
    // Regelbasiert aber hohe Fehlerrate → KI setzt Regeln strenger durch
    if (
      step.rule_based &&
      step.frequency_per_month! >= 5 &&
      step.error_rate_percent != null &&
      step.error_rate_percent >= 10
    ) {
      add(makeUC(step, 'automation',
        `${step.title} — Regelkonformität sicherstellen`,
        'KI setzt bestehende Regeln konsistent durch und eliminiert Flüchtigkeitsfehler.',
        `Regelbasierter Prozess mit ${step.error_rate_percent}% Fehlerrate — KI-Enforcement reduziert Fehler auf nahe 0%.`,
        'medium', 0.60, hourlyRate))
    }

    // R7 — KI-unterstützte Routinearbeit
    // Wiederkehrend, nicht regelbasiert, funktioniert gut → KI übernimmt Teile
    if (
      !step.rule_based &&
      step.frequency_per_month! >= 10 &&
      step.duration_minutes! >= 20 &&
      (step.error_rate_percent == null || step.error_rate_percent < 10)
    ) {
      add(makeUC(step, 'llm_extraction',
        `${step.title} — KI-Unterstützung`,
        'KI übernimmt Routineanteile und beschleunigt den Prozess ohne vollständige Regelstruktur.',
        'Wiederkehrender Prozess ohne Fehlersignal — KI-Unterstützung spart 30% der Bearbeitungszeit.',
        'medium', 0.30, hourlyRate))
    }

    // R8 — Daten-Aggregation für Entscheidungen
    // Lange, urteilsbasierte Entscheidung ohne Fehlerprobleme → KI aggregiert Datenbasis
    if (
      !step.rule_based &&
      step.duration_minutes! >= 30 &&
      (step.error_rate_percent == null || step.error_rate_percent < 10) &&
      !hasSearchKeywords(step)
    ) {
      add(makeUC(step, 'rag',
        `${step.title} — Daten-Aggregation`,
        'KI aggregiert alle relevanten Daten und bereitet die Entscheidungsgrundlage strukturiert auf.',
        'Zeitaufwändige Entscheidung ohne Fehlerprobleme — KI beschleunigt Datenaggregation um 40%.',
        'medium', 0.40, hourlyRate))
    }

    results.push(...best.values())
  }

  // ── Qualitative Track: P1-P3 (pain_point + tool based, no ROI) ──────────────
  // Group knowledge objects by interview_id for fast lookup
  const painPointsByInterview = new Map<string, { description: string; severity: string }[]>()
  const toolsByInterview = new Map<string, string[]>()

  for (const ko of knowledgeObjects) {
    if (ko.type === 'pain_point') {
      const c = ko.content as { description?: string; severity?: string }
      if (!c.description) continue
      const list = painPointsByInterview.get(ko.interview_id) ?? []
      list.push({ description: c.description, severity: c.severity ?? 'medium' })
      painPointsByInterview.set(ko.interview_id, list)
    } else if (ko.type === 'tool') {
      const c = ko.content as { name?: string }
      if (!c.name) continue
      const list = toolsByInterview.get(ko.interview_id) ?? []
      if (!list.includes(c.name)) list.push(c.name)
      toolsByInterview.set(ko.interview_id, list)
    }
  }

  // Per interview: pick the first process_step as anchor for qualitative UCs
  const stepByInterview = new Map<string, EngineProcessStep>()
  for (const step of steps) {
    if (!stepByInterview.has(step.interview_id)) {
      stepByInterview.set(step.interview_id, step)
    }
  }

  const qualitativeKeys = new Set<string>() // deduplicate per interview+type

  for (const [interviewId, anchorStep] of stepByInterview) {
    const painPoints = painPointsByInterview.get(interviewId) ?? []
    const tools = toolsByInterview.get(interviewId) ?? []

    // P1 — High-severity pain point → process improvement
    const highPains = painPoints.filter(p => p.severity === 'high')
    if (highPains.length > 0) {
      const key = `${interviewId}:process_improvement`
      if (!qualitativeKeys.has(key)) {
        qualitativeKeys.add(key)
        results.push(makeQualitativeUC(
          anchorStep,
          'process_improvement',
          `${anchorStep.title} — Prozessverbesserung`,
          'KI adressiert identifizierte Engpässe und reduziert manuelle Aufwände gezielt.',
          `Kritischer Engpass: "${highPains[0].description}"`,
          'medium', 'high',
        ))
      }
    }

    // P2 — ≥3 distinct tools → tool consolidation / integration
    if (tools.length >= 3) {
      const key = `${interviewId}:tool_consolidation`
      if (!qualitativeKeys.has(key)) {
        qualitativeKeys.add(key)
        results.push(makeQualitativeUC(
          anchorStep,
          'tool_consolidation',
          `${anchorStep.title} — Tool-Integration`,
          `Systemintegration der genutzten Tools (${tools.slice(0, 3).join(', ')}) eliminiert Medienbrüche.`,
          `${tools.length} verschiedene Systeme identifiziert — Integrationsansatz reduziert manuelle Übergaben.`,
          'medium', 'medium',
        ))
      }
    }

    // P3 — Pain point with manual/Excel keywords → automation candidate
    const manualPains = painPoints.filter(p =>
      MANUAL_KEYWORDS.some(kw => p.description.toLowerCase().includes(kw))
    )
    if (manualPains.length > 0) {
      const key = `${interviewId}:automation_candidate`
      if (!qualitativeKeys.has(key)) {
        qualitativeKeys.add(key)
        results.push(makeQualitativeUC(
          anchorStep,
          'automation_candidate',
          `${anchorStep.title} — Automatisierungskandidat`,
          'Manuelle Schritte durch KI-gestützte Automatisierung ersetzen.',
          `Manueller Aufwand identifiziert: "${manualPains[0].description}"`,
          'low', 'medium',
        ))
      }
    }
  }

  results.sort((a, b) => b.score - a.score)
  return results
}
