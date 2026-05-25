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

export interface Persona {
  identity: PersonaIdentity
  description: string
  style: PersonaStyle
  processKnowledge: PersonaProcessKnowledge
}
