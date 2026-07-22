// Use Case Heuristic Engine — pure TypeScript, no LLM, no external services.
// Rules: R1–R8 (per process_step), P1–P4 (per interview/workspace), C1–C3 (per cluster).
// Per process step + type: only the highest ROI use case is kept.

// ── Configurable Thresholds ──────────────────────────────────────────────────
export const SCORE_HIGH_THRESHOLD = 5000   // Q1 / priority high
export const SCORE_MEDIUM_THRESHOLD = 1000 // Q2 / priority medium
export const EFFORT_FACTORS = { low: 1, medium: 2, high: 3 } as const

// ── Use Case Cluster (derived from effort + type, no DB field needed) ─────────
export type UseCaseCluster = 'no_regret_foundation' | 'near_term_mvp' | 'strategic_bet'

export const CLUSTER_META: Record<UseCaseCluster, { label: string; description: string; order: number }> = {
  no_regret_foundation: { label: 'No-regret Foundation', description: 'Sofort starten — Aufwand niedrig, Nutzen sicher', order: 0 },
  near_term_mvp:        { label: 'Near-term Business MVP', description: 'Klarer ROI, bewährte Technologie — fokussierte MVPs vorbereiten', order: 1 },
  strategic_bet:        { label: 'Strategic Bets', description: 'Hohes Differenzierungspotenzial — Scope sorgfältig definieren', order: 2 },
}

export function getCluster(uc: { effort: string | null; type: string }): UseCaseCluster {
  if (uc.effort === 'low') return 'no_regret_foundation'
  if (uc.effort === 'high' || uc.type === 'decision_support') return 'strategic_bet'
  return 'near_term_mvp'
}

const DOC_SOURCES = ['e-mail', 'email', 'pdf', 'word']
const SEARCH_KEYWORDS = ['suchen', 'nachschlagen', 'klären', 'prüfen', 'finden', 'recherchieren']
const P4_SIMILARITY_THRESHOLD = 0.78

// ── Input / Output Types ─────────────────────────────────────────────────────

export interface EngineProcessStep {
  id: string
  workspace_id: string
  interview_id: string
  title: string
  description: string | null
  frequency: number | null
  duration: number | null
  data_sources: string[]
  rule_based: boolean
  error_rate_percent: number | null
  media_breaks: number
  embedding?: number[] | null
}

export interface KnowledgeObjectContext {
  type: 'pain_point' | 'tool'
  content: Record<string, unknown>
  interview_id: string
  embedding?: number[] | null
}

export interface RoiBreakdown {
  [key: string]: number
  freq: number
  duration: number
  hourly_rate: number
  reduction_rate: number
  participant_count: number
  total_eur: number
}

export interface ClusterParticipant {
  interview_id: string
  employee_name: string
  employee_role: string | null
  process_step_id: string
  step: EngineProcessStep
}

export interface ClusterContext {
  id: string
  workspace_id: string
  canonical_title: string
  canonical_description: string | null
  participant_count: number
  participants: ClusterParticipant[]
}

export interface PainPointForP4 {
  interview_id: string
  description: string
  severity: string
  embedding: number[]
}

export interface P4Group {
  points: PainPointForP4[]
}

export interface GeneratedUseCase {
  process_step_id: string | null
  cluster_id: string | null
  workspace_id: string
  type: string
  title: string
  description: string
  reasoning: string
  effort: 'low' | 'medium' | 'high'
  roi_hours_per_year: number | null
  roi_eur_per_year: number | null
  roi_breakdown: RoiBreakdown | null
  score: number
  priority: 'high' | 'medium' | 'low'
  quarter: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function r2(n: number): number {
  return Math.round(n * 100) / 100
}

function roi(step: EngineProcessStep, rate: number, hourlyRate: number): number {
  return r2((step.frequency! * step.duration! / 60) * 12 * rate * hourlyRate)
}

function hours(step: EngineProcessStep, rate: number): number {
  return r2((step.frequency! * step.duration! / 60) * 12 * rate)
}

// DB column is numeric(12,2) — no cap needed (20260522000000_fix_use_cases_score_precision.sql)
function score(roiEur: number, effort: keyof typeof EFFORT_FACTORS): number {
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

function hasSearchKeywordsInText(text: string): boolean {
  return SEARCH_KEYWORDS.some((kw) => text.toLowerCase().includes(kw))
}

function canCompute(step: EngineProcessStep): boolean {
  return step.frequency != null && step.duration != null
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
  return {
    process_step_id: step.id,
    cluster_id: null,
    workspace_id: step.workspace_id,
    type,
    title,
    description,
    reasoning,
    effort,
    roi_hours_per_year: hours(step, rate),
    roi_eur_per_year: roiEur,
    roi_breakdown: {
      freq: step.frequency!,
      duration: step.duration!,
      hourly_rate: hourlyRate,
      reduction_rate: rate,
      participant_count: 1,
      total_eur: roiEur,
    },
    score: sc,
    priority: priority(sc),
    quarter: quarter(sc),
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
    cluster_id: null,
    workspace_id: step.workspace_id,
    type,
    title,
    description,
    reasoning,
    effort,
    roi_hours_per_year: null,
    roi_eur_per_year: null,
    roi_breakdown: null,
    score: pri === 'high' ? 50 : pri === 'medium' ? 30 : 10,
    priority: pri,
    quarter: pri === 'high' ? 'Q1' : pri === 'medium' ? 'Q2' : 'Q3',
  }
}

// ── Cluster Use Case builder ──────────────────────────────────────────────────

function sumParticipantRoi(cluster: ClusterContext, rate: number, hourlyRate: number): number {
  return r2(
    cluster.participants
      .filter(p => canCompute(p.step))
      .reduce((sum, p) => sum + (p.step.frequency! * p.step.duration! / 60) * 12 * rate * hourlyRate, 0)
  )
}

function sumParticipantHours(cluster: ClusterContext, rate: number): number {
  return r2(
    cluster.participants
      .filter(p => canCompute(p.step))
      .reduce((sum, p) => sum + (p.step.frequency! * p.step.duration! / 60) * 12 * rate, 0)
  )
}

function makeClusterUC(
  cluster: ClusterContext,
  type: string,
  title: string,
  description: string,
  reasoning: string,
  effort: 'low' | 'medium' | 'high',
  rate: number,
  hourlyRate: number,
  totalRoiEur: number,
  avgFreq: number,
  avgDuration: number,
): GeneratedUseCase {
  // Score boost: more participants = higher priority
  const baseScore = score(totalRoiEur, effort)
  const boostedScore = r2(baseScore * Math.log2(cluster.participant_count + 1))
  return {
    process_step_id: null,
    cluster_id: cluster.id,
    workspace_id: cluster.workspace_id,
    type,
    title,
    description,
    reasoning,
    effort,
    roi_hours_per_year: sumParticipantHours(cluster, rate),
    roi_eur_per_year: totalRoiEur,
    roi_breakdown: {
      freq: avgFreq,
      duration: avgDuration,
      hourly_rate: hourlyRate,
      reduction_rate: rate,
      participant_count: cluster.participant_count,
      total_eur: totalRoiEur,
    },
    score: boostedScore,
    priority: priority(boostedScore),
    quarter: quarter(boostedScore),
  }
}

// ── Cluster Rules (C1–C3) ────────────────────────────────────────────────────

function runClusterRules(
  clusters: ClusterContext[],
  hourlyRate: number,
): { useCases: GeneratedUseCase[]; coveredStepIds: Set<string> } {
  const results: GeneratedUseCase[] = []
  const coveredStepIds = new Set<string>()

  for (const cluster of clusters) {
    if (cluster.participant_count < 2) continue

    const computeParticipants = cluster.participants.filter(p => canCompute(p.step))
    if (computeParticipants.length === 0) continue

    const avgFreq = r2(
      computeParticipants.reduce((s, p) => s + p.step.frequency!, 0) / computeParticipants.length
    )
    const avgDuration = r2(
      computeParticipants.reduce((s, p) => s + p.step.duration!, 0) / computeParticipants.length
    )

    const candidates: GeneratedUseCase[] = []

    // C1 — Automation at Scale
    // ≥2 participants + avg_frequency ≥ 5/month → workspace-wide automation
    if (avgFreq >= 5) {
      const totalRoi = sumParticipantRoi(cluster, 0.85, hourlyRate)
      const roiPerMonth = Math.round(totalRoi / 12)
      candidates.push(makeClusterUC(
        cluster,
        'automation_at_scale',
        `${cluster.canonical_title} — Automatisierung (${cluster.participant_count} Mitarbeiter)`,
        `${cluster.participant_count} Mitarbeiter führen denselben Prozess durch. Workspace-weites Einsparpotential: ${roiPerMonth.toLocaleString('de')}€/Monat.`,
        `C1: ${cluster.participant_count} Mitarbeiter, Ø ${avgFreq}×/Monat — Skalierungseffekt durch workspace-weite Automatisierung.`,
        'low', 0.85, hourlyRate, totalRoi, avgFreq, avgDuration,
      ))
    }

    // C2 — Process Standardization
    // ≥2 participants + avg_error_rate ≥ 10% → cross-employee standardization
    const participantsWithErrors = cluster.participants.filter(p => p.step.error_rate_percent != null)
    if (participantsWithErrors.length > 0) {
      const avgError = participantsWithErrors.reduce((s, p) => s + p.step.error_rate_percent!, 0) / participantsWithErrors.length
      if (avgError >= 10) {
        const totalRoi = sumParticipantRoi(cluster, 0.60, hourlyRate)
        candidates.push(makeClusterUC(
          cluster,
          'process_standardization',
          `${cluster.canonical_title} — Standardisierung (${cluster.participant_count} Mitarbeiter)`,
          `${cluster.participant_count} Mitarbeiter mit Ø ${Math.round(avgError)}% Fehlerrate. Standardisierung eliminiert Fehlerkorrekturaufwand workspace-weit.`,
          `C2: Ø Fehlerrate ${Math.round(avgError)}% bei ${cluster.participant_count} Mitarbeitern — Prozessstandardisierung reduziert Fehlerkorrekturaufwand.`,
          'medium', 0.60, hourlyRate, totalRoi, avgFreq, avgDuration,
        ))
      }
    }

    // C3 — Knowledge RAG at Scale
    // ≥3 participants + canonical_description contains search keywords
    if (cluster.participant_count >= 3 && (
      hasSearchKeywordsInText(cluster.canonical_title) ||
      (cluster.canonical_description && hasSearchKeywordsInText(cluster.canonical_description))
    )) {
      const totalRoi = sumParticipantRoi(cluster, 0.50, hourlyRate)
      candidates.push(makeClusterUC(
        cluster,
        'knowledge_rag_at_scale',
        `${cluster.canonical_title} — Wissensassistent (${cluster.participant_count} Mitarbeiter)`,
        `${cluster.participant_count} Mitarbeiter recherchieren in diesem Prozess. Ein workspace-weiter Wissensassistent halbiert die Suchzeit für alle.`,
        `C3: ${cluster.participant_count} Mitarbeiter + Suche/Nachschlagen erkannt — RAG-Wissensassistent workspace-weit amortisiert gut.`,
        'medium', 0.50, hourlyRate, totalRoi, avgFreq, avgDuration,
      ))
    }

    if (candidates.length === 0) continue

    // Per cluster: only the highest-score candidate
    const winner = candidates.reduce((best, c) => c.score > best.score ? c : best)
    results.push(winner)

    // Suppress individual R-rules for all steps in this cluster
    for (const p of cluster.participants) {
      coveredStepIds.add(p.process_step_id)
    }
  }

  return { useCases: results, coveredStepIds }
}

// ── P4: Cross-Interview Pain Point Clustering ─────────────────────────────────

function localCosineSim(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

export function clusterPainPointsByEmbedding(
  painPoints: PainPointForP4[],
  threshold = P4_SIMILARITY_THRESHOLD
): P4Group[] {
  const groups: P4Group[] = []
  const assigned = new Set<number>()

  for (let i = 0; i < painPoints.length; i++) {
    if (assigned.has(i)) continue
    const group: P4Group = { points: [painPoints[i]] }
    assigned.add(i)

    for (let j = i + 1; j < painPoints.length; j++) {
      if (assigned.has(j)) continue
      if (localCosineSim(painPoints[i].embedding, painPoints[j].embedding) >= threshold) {
        group.points.push(painPoints[j])
        assigned.add(j)
      }
    }
    groups.push(group)
  }

  return groups
}

// ── Main Engine ───────────────────────────────────────────────────────────────

// Find best anchor step for a pain point: step_ref → cosine sim → first step
function findBestAnchorStep(
  interviewId: string,
  stepRef: string | null | undefined,
  painEmbedding: number[] | null | undefined,
  stepsByInterview: Map<string, EngineProcessStep[]>
): EngineProcessStep | undefined {
  const candidates = stepsByInterview.get(interviewId) ?? []
  if (candidates.length === 0) return undefined

  if (stepRef) {
    const exact = candidates.find(s => s.title === stepRef)
    if (exact) return exact
    const fuzzy = candidates.find(s => s.title.toLowerCase().includes(stepRef.toLowerCase()))
    if (fuzzy) return fuzzy
  }

  if (painEmbedding && candidates.some(s => s.embedding != null)) {
    let best: EngineProcessStep | undefined
    let bestSim = -1
    for (const s of candidates) {
      if (!s.embedding) continue
      const sim = localCosineSim(painEmbedding, s.embedding)
      if (sim > bestSim) { bestSim = sim; best = s }
    }
    if (best) return best
  }

  return candidates[0]
}

export function runHeuristicEngine(
  steps: EngineProcessStep[],
  hourlyRate: number,
  knowledgeObjects: KnowledgeObjectContext[] = [],
  clusters: ClusterContext[] = [],
  qualitativeContext: Map<string, string[]> = new Map()
): GeneratedUseCase[] {
  const results: GeneratedUseCase[] = []

  // Phase 1: Cluster rules (C1–C3) — run first, collect suppressed step IDs
  const { useCases: clusterUCs, coveredStepIds } = runClusterRules(clusters, hourlyRate)
  results.push(...clusterUCs)

  // Phase 2: Individual rules (R1–R8) — skip steps covered by cluster UCs
  for (const step of steps) {
    if (coveredStepIds.has(step.id)) continue
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
    if (
      step.frequency! >= 20 &&
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
    if (hasDocSources(step.data_sources) && step.duration! >= 15) {
      add(makeUC(step, 'llm_extraction',
        `${step.title} — Dokumenten-Extraktion`,
        'LLM extrahiert strukturierte Informationen aus E-Mails, PDFs oder Word-Dokumenten.',
        `Datenquellen (${step.data_sources.join(', ')}) enthalten unstrukturierte Infos — LLM-Extraktion spart Lesezeit.`,
        'medium', 0.40, hourlyRate))
    }

    // R3 — Entscheidungsunterstützung
    if (
      !step.rule_based &&
      step.duration! >= 30 &&
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
    if (step.media_breaks >= 3) {
      add(makeUC(step, 'automation',
        `${step.title} — Medienbrüche eliminieren`,
        'Automatische Datenübertragung zwischen Systemen via API-Integration oder RPA.',
        `${step.media_breaks} Medienbrüche identifiziert — Systemintegration spart manuelle Übertragungsarbeit.`,
        'low', 0.60, hourlyRate))
    }

    // R5 — RAG Wissensassistent
    if (hasSearchKeywords(step) && step.duration! >= 10) {
      add(makeUC(step, 'rag',
        `${step.title} — Wissensassistent`,
        'RAG-System beantwortet Fragen sofort aus der Unternehmenswissensbasis.',
        'Prozess enthält Suchen oder Nachschlagen — KI-Wissensassistent reduziert Recherchezeit um 50%.',
        'medium', 0.50, hourlyRate))
    }

    // R6 — Fehlerhafte Regelautomatisierung
    if (
      step.rule_based &&
      step.frequency! >= 5 &&
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
    if (
      !step.rule_based &&
      step.frequency! >= 10 &&
      step.duration! >= 20 &&
      (step.error_rate_percent == null || step.error_rate_percent < 10)
    ) {
      add(makeUC(step, 'llm_extraction',
        `${step.title} — KI-Unterstützung`,
        'KI übernimmt Routineanteile und beschleunigt den Prozess ohne vollständige Regelstruktur.',
        'Wiederkehrender Prozess ohne Fehlersignal — KI-Unterstützung spart 30% der Bearbeitungszeit.',
        'medium', 0.30, hourlyRate))
    }

    // R8 — Daten-Aggregation für Entscheidungen
    if (
      !step.rule_based &&
      step.duration! >= 30 &&
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

  // ── Phase 3: Qualitative Track P1–P3 (pain_point + tool, no ROI) ──────────────
  interface PainEntry { description: string; severity: string; step_ref?: string | null; embedding?: number[] | null }
  const painPointsByInterview = new Map<string, PainEntry[]>()
  const toolsByInterview = new Map<string, string[]>()

  for (const ko of knowledgeObjects) {
    if (ko.type === 'pain_point') {
      const c = ko.content as { description?: string; severity?: string; step_ref?: string }
      if (!c.description) continue
      const list = painPointsByInterview.get(ko.interview_id) ?? []
      list.push({ description: c.description, severity: c.severity ?? 'medium', step_ref: c.step_ref ?? null, embedding: ko.embedding })
      painPointsByInterview.set(ko.interview_id, list)
    } else if (ko.type === 'tool') {
      const c = ko.content as { name?: string }
      if (!c.name) continue
      const list = toolsByInterview.get(ko.interview_id) ?? []
      if (!list.includes(c.name)) list.push(c.name)
      toolsByInterview.set(ko.interview_id, list)
    }
  }

  // Also aggregate tools from process_steps.data_sources so P2 sees all tool usage,
  // not just what the extraction pipeline captured in knowledge_objects.
  for (const step of steps) {
    for (const toolName of step.data_sources) {
      if (!toolName.trim()) continue
      const list = toolsByInterview.get(step.interview_id) ?? []
      if (!list.includes(toolName)) list.push(toolName)
      toolsByInterview.set(step.interview_id, list)
    }
  }

  // Per-interview step lists for anchor resolution (M1)
  const stepsByInterview = new Map<string, EngineProcessStep[]>()
  for (const step of steps) {
    const list = stepsByInterview.get(step.interview_id) ?? []
    list.push(step)
    stepsByInterview.set(step.interview_id, list)
  }

  // stepByInterview still needed for P4 anchor
  const stepByInterview = new Map<string, EngineProcessStep>()
  for (const step of steps) {
    if (!stepByInterview.has(step.interview_id)) stepByInterview.set(step.interview_id, step)
  }

  const qualitativeKeys = new Set<string>() // deduplicate per interview+type

  for (const interviewId of new Set([...painPointsByInterview.keys(), ...toolsByInterview.keys()])) {
    const painPoints = painPointsByInterview.get(interviewId) ?? []
    const tools = toolsByInterview.get(interviewId) ?? []
    const qualContext = qualitativeContext.get(interviewId) ?? []

    const qualContextSuffix = qualContext.length > 0
      ? ` Zusätzlicher Kontext: ${qualContext.join(' | ')}`
      : ''

    // P1 — High-severity pain point → process improvement
    const highPains = painPoints.filter(p => p.severity === 'high')
    if (highPains.length > 0) {
      const topPain = highPains[0]
      const anchorStep = findBestAnchorStep(interviewId, topPain.step_ref, topPain.embedding, stepsByInterview)
      if (anchorStep) {
        const key = `${interviewId}:process_improvement`
        if (!qualitativeKeys.has(key)) {
          qualitativeKeys.add(key)
          results.push(makeQualitativeUC(
            anchorStep,
            'process_improvement',
            `${anchorStep.title} — Prozessverbesserung`,
            `KI adressiert identifizierte Engpässe und reduziert manuelle Aufwände gezielt.${qualContextSuffix}`,
            `Kritischer Engpass: "${topPain.description}"`,
            'medium', 'high',
          ))
        }
      }
    }

    // P2 — ≥3 distinct tools → tool consolidation / integration
    if (tools.length >= 3) {
      const anchorStep = stepsByInterview.get(interviewId)?.[0]
      if (anchorStep) {
        const key = `${interviewId}:tool_consolidation`
        if (!qualitativeKeys.has(key)) {
          qualitativeKeys.add(key)
          results.push(makeQualitativeUC(
            anchorStep,
            'tool_consolidation',
            `${anchorStep.title} — Tool-Integration`,
            `Systemintegration der genutzten Tools (${tools.slice(0, 3).join(', ')}) eliminiert Medienbrüche.${qualContextSuffix}`,
            `${tools.length} verschiedene Systeme identifiziert — Integrationsansatz reduziert manuelle Übergaben.`,
            'medium', 'medium',
          ))
        }
      }
    }

    // P3 — Pain point with manual/Excel keywords → automation candidate
    const manualPains = painPoints.filter(p =>
      MANUAL_KEYWORDS.some(kw => p.description.toLowerCase().includes(kw))
    )
    if (manualPains.length > 0) {
      const topManual = manualPains[0]
      const anchorStep = findBestAnchorStep(interviewId, topManual.step_ref, topManual.embedding, stepsByInterview)
      if (anchorStep) {
        const key = `${interviewId}:automation_candidate`
        if (!qualitativeKeys.has(key)) {
          qualitativeKeys.add(key)
          results.push(makeQualitativeUC(
            anchorStep,
            'automation_candidate',
            `${anchorStep.title} — Automatisierungskandidat`,
            `Manuelle Schritte durch KI-gestützte Automatisierung ersetzen.${qualContextSuffix}`,
            `Manueller Aufwand identifiziert: "${topManual.description}"`,
            'low', 'medium',
          ))
        }
      }
    }
  }

  // ── Phase 4: P4 — Cross-Interview Pain Point Clustering ──────────────────────
  const painPointsForP4: PainPointForP4[] = []
  for (const ko of knowledgeObjects) {
    if (ko.type !== 'pain_point') continue
    if (!ko.embedding || !Array.isArray(ko.embedding) || ko.embedding.length === 0) continue
    const c = ko.content as { description?: string; severity?: string }
    if (!c.description) continue
    painPointsForP4.push({
      interview_id: ko.interview_id,
      description: c.description,
      severity: c.severity ?? 'medium',
      embedding: ko.embedding as number[],
    })
  }

  if (painPointsForP4.length >= 2) {
    const severityOrder: Record<string, number> = { high: 3, medium: 2, low: 1 }
    const p4Groups = clusterPainPointsByEmbedding(painPointsForP4)

    for (const group of p4Groups) {
      if (group.points.length < 2) continue
      const uniqueInterviews = new Set(group.points.map(p => p.interview_id))
      if (uniqueInterviews.size < 2) continue

      const sorted = [...group.points].sort(
        (a, b) => (severityOrder[b.severity] ?? 2) - (severityOrder[a.severity] ?? 2)
      )
      const topPain = sorted[0]
      const maxSeverity = topPain.severity as 'high' | 'medium' | 'low'

      const anchorStep = findBestAnchorStep(topPain.interview_id, null, topPain.embedding, stepsByInterview)

      if (!anchorStep) continue

      const key = `p4:${[...group.points.map(p => p.description)].sort().join('|')}`
      if (qualitativeKeys.has(key)) continue
      qualitativeKeys.add(key)

      const p4uc = makeQualitativeUC(
        anchorStep,
        'cross_team_pain_resolution',
        topPain.description,
        `Workspace-weites Problem: ${uniqueInterviews.size} Mitarbeiter beschreiben dasselbe Pain Point. Konsolidierte Lösung adressiert alle Betroffenen gleichzeitig.`,
        `P4: "${topPain.description}" — ${uniqueInterviews.size} Interviews mit ähnlichen Pain Points (cosine ≥ ${P4_SIMILARITY_THRESHOLD}).`,
        'medium', maxSeverity,
      )
      p4uc.process_step_id = null
      results.push(p4uc)
    }
  }

  results.sort((a, b) => b.score - a.score)
  return results
}
