import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { EvalMetrics } from './metrics'
import type { Persona } from './personas/buchhalter'

export function generateReport(
  persona: Persona,
  metrics: EvalMetrics,
  transcript: Array<{ role: string; content: string }>,
): string {
  const date = new Date().toISOString().split('T')[0]
  const verdictIcon = metrics.passesOutputContract ? '✅ PASS' : '❌ FAIL'

  const mandatoryLines = Object.entries(metrics.mandatorySlotCoverageByStep)
    .map(([title, pct]) => `  - "${title}": ${Math.round(pct * 100)} %`)
    .join('\n')

  const optionalLines = Object.entries(metrics.optionalSlotCoverageByStep)
    .map(([title, pct]) => `  - "${title}": ${Math.round(pct * 100)} %`)
    .join('\n')

  const transcriptText = transcript
    .map((t) => `**${t.role === 'user' ? persona.name : 'Agent'}:** ${t.content}`)
    .join('\n\n')

  const report = `# Eval Report — ${persona.name} (${persona.role})

**Datum:** ${date}
**Persona:** ${persona.description}
**Verdict:** ${verdictIcon}

## Metriken

| Metrik | Wert | Schwelle |
|--------|------|---------|
| Schritte identifiziert | ${metrics.stepsIdentified} | ≥ 3 |
| Ø Pflicht-Slot-Coverage | ${Math.round(metrics.avgMandatoryCoverage * 100)} % | ≥ 80 % |
| Ø Optionale-Slot-Coverage | ${Math.round(metrics.avgOptionalCoverage * 100)} % | ≥ 50 % |
| Bottlenecks verortet | ${metrics.bottlenecksLocated} | ≥ 1 |
| Use Cases generiert | ${metrics.useCasesGenerated} | ≥ 1 |

## Coverage-Detail

**Pflicht-Slots:**
${mandatoryLines || '  (keine Schritte)'}

**Optionale Slots:**
${optionalLines || '  (keine Schritte)'}

## Transkript

${transcriptText}
`

  const dir = join(process.cwd(), 'docs', 'evals', 'interview')
  mkdirSync(dir, { recursive: true })
  const filename = `${date}-${persona.name.toLowerCase().replace(/\s+/g, '-')}.md`
  writeFileSync(join(dir, filename), report, 'utf8')
  console.log(`[report] written to docs/evals/interview/${filename}`)

  return report
}
