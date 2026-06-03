/**
 * Parses an eval MD file into a TranscriptFixture.
 * Best-effort: tolerates missing fields in older MDs.
 * Returns null when the file cannot be parsed as an eval MD at all.
 */

import fs from 'fs'
import type { TranscriptFixture } from './types'
import type { TurnRecord } from '../scorers/types'
import type { Phase, StepEntry } from '@/services/interviewSemantic'

interface FrontmatterData {
  interview_model?: string
  persona?: string
  interview_id?: string
  eval_run_id?: string
  status?: string
  turns_total?: string
  scores?: Record<string, string>
  [key: string]: unknown
}

function parseFrontmatter(content: string): FrontmatterData | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return null

  const raw = match[1]
  const result: FrontmatterData = {}
  let currentKey: string | null = null
  let inScores = false
  const scores: Record<string, string> = {}

  for (const line of raw.split('\n')) {
    if (line.startsWith('scores:')) {
      inScores = true
      currentKey = 'scores'
      continue
    }
    if (inScores && line.startsWith('  ')) {
      const [k, v] = line.trim().split(': ')
      if (k && v !== undefined) scores[k] = v.trim()
      continue
    }
    inScores = false

    const colonIdx = line.indexOf(': ')
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim()
      const val = line.slice(colonIdx + 2).trim()
      result[key] = val
      currentKey = key
    } else if (currentKey && line.startsWith('  ')) {
      // Multi-line value — append
      const existing = result[currentKey]
      result[currentKey] = (typeof existing === 'string' ? existing + '\n' : '') + line.trim()
    }
  }

  if (Object.keys(scores).length > 0) result.scores = scores
  return result
}

function parseTurns(content: string): TurnRecord[] {
  const turns: TurnRecord[] = []

  // Match pairs: [Turn N] Persona: ... followed by [Turn N] Agent: "..."
  const turnRegex = /\[Turn (\d+)\] Persona: ([\s\S]*?)\n\[Turn \1\] Agent: "?([\s\S]*?)"?\n/g
  let match: RegExpExecArray | null
  while ((match = turnRegex.exec(content)) !== null) {
    const turnNumber = parseInt(match[1], 10)
    const userInput = match[2].trim()
    const agentText = match[3].trim()
    turns.push({
      turnNumber,
      userInput,
      agentText,
      phase: 'intro' as Phase, // phase not stored in MD — default
      toolCalls: [],
    })
  }

  return turns
}

function parseScores(frontmatter: FrontmatterData) {
  const s = frontmatter.scores
  if (!s) return {}
  return {
    slotCoverage: s.slot_coverage !== undefined ? parseFloat(s.slot_coverage) : undefined,
    dedupSlotCoverage: s.dedup_slot_coverage !== undefined ? parseFloat(s.dedup_slot_coverage) : undefined,
    phaseAdherence: s.phase_adherence !== undefined ? parseFloat(s.phase_adherence) : undefined,
    phaseProgression: s.phase_progression !== undefined ? parseFloat(s.phase_progression) : undefined,
    anchoringViolations: s.anchoring_violations !== undefined ? parseFloat(s.anchoring_violations) : undefined,
    toolCallPlausibility: s.tool_call_plausibility !== undefined ? parseFloat(s.tool_call_plausibility) : undefined,
    dialogNaturalness: s.dialog_naturalness !== undefined ? parseFloat(s.dialog_naturalness) : undefined,
    completionCorrectness: s.completion_correctness !== undefined ? s.completion_correctness === 'true' : undefined,
    stepRegistrationCoverage: s.step_registration_coverage !== undefined ? parseFloat(s.step_registration_coverage) : undefined,
  }
}

export function parseEvalMd(filePath: string): TranscriptFixture | null {
  let content: string
  try {
    content = fs.readFileSync(filePath, 'utf8')
  } catch {
    return null
  }

  const frontmatter = parseFrontmatter(content)
  if (!frontmatter) return null

  const evalRunId = (frontmatter.eval_run_id as string | undefined) ?? 'unknown'
  const interviewId = (frontmatter.interview_id as string | undefined) ?? 'unknown'
  const model = (frontmatter.interview_model as string | undefined) ?? 'unknown'
  const persona = (frontmatter.persona as string | undefined) ?? 'unknown'
  const status = (frontmatter.status as string | undefined) === 'PASS' ? 'completed' : 'unknown'

  const turns = parseTurns(content)
  if (turns.length === 0) return null

  const parsedScores = parseScores(frontmatter)

  // finalStepTracker is not available from MD — return empty array
  // Scorers that need it (slotCoverage) will return default values
  const finalStepTracker: StepEntry[] = []

  return {
    evalRunId,
    interviewId,
    model,
    persona,
    status,
    turns,
    finalStepTracker,
    scores: parsedScores,
    sourceMd: filePath,
    generatedAt: new Date().toISOString(),
  }
}
