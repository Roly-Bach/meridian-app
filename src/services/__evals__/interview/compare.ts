#!/usr/bin/env tsx
/**
 * A/B comparison of two eval runs by eval_run_id.
 *
 * Usage:
 *   npm run eval:interview:compare <baseline-run-id> <candidate-run-id>
 *
 * Scans docs/evals/interview/**\/*.md, finds reports matching the given
 * eval_run_ids, computes score deltas, and prints a Markdown comparison
 * to stdout.
 */

import path from 'path'
import { config } from 'dotenv'

config({ path: path.resolve(process.cwd(), '.env.local') })

import fs from 'fs'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReportFrontmatter {
  interview_model: string
  tester_model: string
  eval_date: string
  persona: string
  interview_id: string
  eval_run_id: string
  langfuse_session?: string
  turns_total: number
  status: string
  baseline_label: string | null
  scores: {
    slot_coverage: number
    phase_adherence: number
    anchoring_violations: number
    tool_call_plausibility: number
    dialog_naturalness: number
    completion_correctness: boolean
    depth_score?: number | null
  }
}

interface ParsedReport {
  frontmatter: ReportFrontmatter
  filepath: string
  conversationLines: string[]
}

// ─── Frontmatter parser ───────────────────────────────────────────────────────

function parseFrontmatter(content: string): ReportFrontmatter | null {
  const match = content.match(/^---\n([\s\S]+?)\n---/)
  if (!match) return null

  const yamlText = match[1]
  const result: Record<string, unknown> = {}
  const scores: Record<string, unknown> = {}
  let inScores = false

  for (const rawLine of yamlText.split('\n')) {
    const line = rawLine
    if (line === 'scores:') { inScores = true; continue }
    if (inScores && line.startsWith('  ')) {
      const [k, v] = line.trim().split(/:\s*/)
      scores[k] = parseValue(v)
      continue
    }
    inScores = false
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    const val = line.slice(colonIdx + 1).trim()
    result[key] = parseValue(val)
  }

  result['scores'] = scores
  return result as unknown as ReportFrontmatter
}

function parseValue(v: string): unknown {
  if (v === 'true') return true
  if (v === 'false') return false
  if (v === 'null') return null
  const n = Number(v)
  if (!isNaN(n) && v !== '') return n
  return v
}

function extractConversationLines(content: string): string[] {
  const afterFrontmatter = content.replace(/^---[\s\S]+?---\n/, '')
  const match = afterFrontmatter.match(/## Gesprächsverlauf\n([\s\S]+?)(?:\n##|$)/)
  if (!match) return []
  return match[1]
    .split('\n')
    .filter(l => l.startsWith('[Turn '))
}

// ─── Report scanner ───────────────────────────────────────────────────────────

function scanReports(rootDir: string): ParsedReport[] {
  const reports: ParsedReport[] = []

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) { walk(fullPath); continue }
      if (!entry.name.endsWith('.md')) continue
      try {
        const content = fs.readFileSync(fullPath, 'utf8')
        const fm = parseFrontmatter(content)
        if (!fm?.eval_run_id) continue
        reports.push({
          frontmatter: fm,
          filepath: fullPath,
          conversationLines: extractConversationLines(content),
        })
      } catch {
        // skip unreadable files
      }
    }
  }

  if (fs.existsSync(rootDir)) walk(rootDir)
  return reports
}

// ─── Example turn picker ──────────────────────────────────────────────────────

function pickExampleTurns(lines: string[]): string[] {
  const agentLines = lines.filter(l => l.includes('] Agent:'))
  if (agentLines.length === 0) return []

  const first = agentLines[0]
  const middle = agentLines[Math.floor(agentLines.length / 2)]
  const last = agentLines[agentLines.length - 1]

  return [...new Set([first, middle, last])].slice(0, 3)
}

// ─── Comparison report builder ────────────────────────────────────────────────

interface RunGroup {
  evalRunId: string
  reports: ParsedReport[]
}

function buildComparison(baseline: RunGroup, candidate: RunGroup): string {
  const lines: string[] = [
    '# Eval A/B Comparison',
    '',
    `**Baseline:** \`${baseline.evalRunId}\``,
    `**Candidate:** \`${candidate.evalRunId}\``,
    `**Generated:** ${new Date().toISOString()}`,
    '',
  ]

  // Pair reports by persona × model
  const allKeys = new Set([
    ...baseline.reports.map(r => `${r.frontmatter.interview_model}::${r.frontmatter.persona}`),
    ...candidate.reports.map(r => `${r.frontmatter.interview_model}::${r.frontmatter.persona}`),
  ])

  for (const key of [...allKeys].sort()) {
    const [model, persona] = key.split('::')
    const base = baseline.reports.find(
      r => r.frontmatter.interview_model === model && r.frontmatter.persona === persona,
    )
    const cand = candidate.reports.find(
      r => r.frontmatter.interview_model === model && r.frontmatter.persona === persona,
    )

    lines.push(`## ${model} / ${persona}`)
    lines.push('')

    if (!base && !cand) continue

    if (!base) {
      lines.push('_Baseline run missing for this combination._')
      lines.push('')
      continue
    }
    if (!cand) {
      lines.push('_Candidate run missing for this combination._')
      lines.push('')
      continue
    }

    // Score delta table
    lines.push('### Score Deltas (candidate − baseline)')
    lines.push('')
    lines.push('| Metrik | Baseline | Candidate | Delta |')
    lines.push('|--------|----------|-----------|-------|')

    const bs = base.frontmatter.scores
    const cs = cand.frontmatter.scores

    const numericScores: Array<[string, keyof typeof bs]> = [
      ['slot_coverage', 'slot_coverage'],
      ['phase_adherence', 'phase_adherence'],
      ['anchoring_violations', 'anchoring_violations'],
      ['tool_call_plausibility', 'tool_call_plausibility'],
      ['dialog_naturalness', 'dialog_naturalness'],
      ['depth_score', 'depth_score'] as [string, keyof typeof bs],
    ]

    for (const [label, key] of numericScores) {
      const bv = bs[key] as number | null | undefined
      const cv = cs[key] as number | null | undefined
      if (bv == null && cv == null) continue
      if (bv == null || cv == null) {
        lines.push(`| ${label} | ${bv ?? 'n/a'} | ${cv ?? 'n/a'} | (incomplete) |`)
        continue
      }
      const delta = Math.round((cv - bv) * 100) / 100
      const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '='
      const sign = delta > 0 ? '+' : ''
      lines.push(`| ${label} | ${bv} | ${cv} | ${arrow} ${sign}${delta} |`)
    }

    const bComplete = bs.completion_correctness
    const cComplete = cs.completion_correctness
    lines.push(
      `| completion_correctness | ${bComplete} | ${cComplete} | ${bComplete === cComplete ? '=' : cComplete ? '▲ improved' : '▼ regressed'} |`,
    )
    lines.push('')

    // Example turns
    lines.push('### Example Turns')
    lines.push('')
    lines.push('**Baseline:**')
    for (const t of pickExampleTurns(base.conversationLines)) {
      lines.push(`> ${t}`)
    }
    lines.push('')
    lines.push('**Candidate:**')
    for (const t of pickExampleTurns(cand.conversationLines)) {
      lines.push(`> ${t}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const [baselineRunId, candidateRunId] = process.argv.slice(2)

  if (!baselineRunId || !candidateRunId) {
    console.error('Usage: npm run eval:interview:compare <baseline-run-id> <candidate-run-id>')
    process.exit(1)
  }

  const evalsDir = path.resolve(process.cwd(), 'docs', 'evals', 'interview')
  console.error(`[compare] Scanning ${evalsDir} ...`)

  const allReports = scanReports(evalsDir)
  console.error(`[compare] Found ${allReports.length} reports`)

  const baselineReports = allReports.filter(r => r.frontmatter.eval_run_id === baselineRunId)
  const candidateReports = allReports.filter(r => r.frontmatter.eval_run_id === candidateRunId)

  if (baselineReports.length === 0) {
    console.error(`[compare] No reports found for baseline eval_run_id: ${baselineRunId}`)
    process.exit(1)
  }
  if (candidateReports.length === 0) {
    console.error(`[compare] No reports found for candidate eval_run_id: ${candidateRunId}`)
    process.exit(1)
  }

  console.error(`[compare] Baseline: ${baselineReports.length} report(s), Candidate: ${candidateReports.length} report(s)`)

  const output = buildComparison(
    { evalRunId: baselineRunId, reports: baselineReports },
    { evalRunId: candidateRunId, reports: candidateReports },
  )

  process.stdout.write(output + '\n')
}

main().catch(err => {
  console.error('[compare] Fatal:', err)
  process.exit(1)
})
