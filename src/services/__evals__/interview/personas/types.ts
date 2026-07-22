export interface PersonaIdentity {
  name: string
  role: string
  department: string
  yearsExperience: number
}

export interface PersonaStyle {
  verbosity: 'concise' | 'detailed'
  tone: 'formal' | 'informal'
  tendencies: string[]
}

export interface ProcessEntry {
  name: string
  description: string
  tools: string[]
  pain_points: string[]
  frequency: string
}

export interface ToolEntry {
  name: string
  purpose: string
  satisfaction: 'high' | 'medium' | 'low'
}

export interface PersonaProcessKnowledge {
  processes: ProcessEntry[]
  tools: ToolEntry[]
  additionalContext?: string
}

/**
 * Tester-Offenlegungs-Modus (PROJ-40 Kriterium C). Steuert, wie viel der Persona-Simulator
 * unaufgefordert preisgibt. Von der Persona-Persönlichkeit ENTKOPPELT — ein einheitlicher,
 * kontrollierter Faktor über alle Personas, nicht akzidentell in den Tendencies versteckt.
 *  - withhold_numbers_only: Systeme/Tools dürfen beim Erzählen genannt werden, quantitative
 *    Potenzial-Werte (Frequenz, Dauer, Fehlerquote) nur auf direkte Nachfrage. (realistisch, Default)
 *  - withhold_tools_and_numbers: auch Tool-/Systemnamen nur auf direkte Nachfrage. (maximale
 *    Nachfrage-Herausforderung)
 */
export type DisclosureMode = 'withhold_numbers_only' | 'withhold_tools_and_numbers'

/**
 * Scorer-only Ground Truth für KI-Potenzial-Korrektheits-Metriken (PROJ-40 Kriterium C / §7 Review).
 * Liegt bewusst auf Persona-Ebene, NICHT in processKnowledge — damit es NIE in den Tester-System-Prompt
 * serialisiert wird (der Tester improvisiert weiter aus der vagen Narration, kanonische Werte sieht nur
 * der Scorer). `process` matcht ProcessEntry.name.
 */
export interface ProcessGroundTruth {
  process: string
  /** Ist dieser Prozess ein KI-/Automatisierungs-Kandidat? (hohe Frequenz, regelbasiert, Medienbrüche) */
  aiCandidate: boolean
  /** Kanonische Soll-Werte (Punkt statt Range), nur befüllt wo aus der Narration ableitbar. */
  potenzial: {
    frequency?: number
    duration?: number
    error_rate_percent?: number
    media_breaks?: number
  }
  /** Soll-Abhängigkeiten (Namen anderer Prozesse, von denen dieser abhängt). */
  dependsOn?: string[]
}

export interface Persona {
  identity: PersonaIdentity
  description: string
  style: PersonaStyle
  processKnowledge: PersonaProcessKnowledge
  expectedProcessCount?: number
  /** Scorer-only, NIE an den Tester serialisiert (s. ProcessGroundTruth). */
  groundTruth?: ProcessGroundTruth[]
}
