import { generateText } from 'ai'
import { resolveModel } from '@/lib/llm-provider'

export interface SubStep {
  id: string
  title: string
  step_type: 'action' | 'decision'
  condition_text?: string | null
  branch_yes?: string | null
  branch_no?: string | null
  order: number
}

const SUBSTEP_SYSTEM_PROMPT = `Du bist ein Prozessanalyst für Meridian. Zerlege einen Prozessschritt in seine atomaren Einzelschritte.

Schritt-Typen:
- "action": Eine konkrete Handlung (z.B. "Ticket in Jira öffnen", "Remote Desktop verbinden")
- "decision": Eine Entscheidung/Verzweigung (z.B. "Problem im Wiki gefunden?", "Freigabe erforderlich?")

Für decision-Schritte:
- condition_text: Die Bedingung/Frage als kurzer Text
- branch_yes: Was passiert bei Ja (kurz, max. 5 Wörter)
- branch_no: Was passiert bei Nein (kurz, max. 5 Wörter)

Regeln:
- Maximal 8 Schritte
- Halte dich strikt an die Informationen aus dem Interview-Zitat
- Keine Schritte erfinden, die nicht im Zitat erwähnt werden
- Vermeide zu granulare Aufteilung — ein Schritt = eine semantische Einheit

Antworte NUR als valides JSON-Array, kein Text davor oder danach:
[
  { "id": "1", "title": "Aktion beschreiben", "step_type": "action", "order": 1 },
  { "id": "2", "title": "Entscheidung", "step_type": "decision", "condition_text": "Bedingung?", "branch_yes": "Ja-Pfad", "branch_no": "Nein-Pfad", "order": 2 }
]`

export async function generateSubsteps(params: {
  title: string
  description: string | null
  sourceQuote: string | null
  dataSources: string[]
}): Promise<SubStep[]> {
  const { title, description, sourceQuote, dataSources } = params

  const userPrompt = [
    `Prozessschritt: ${title}`,
    description ? `Beschreibung: ${description}` : null,
    sourceQuote ? `Interview-Zitat: "${sourceQuote}"` : null,
    dataSources.length > 0 ? `Verwendete Systeme: ${dataSources.join(', ')}` : null,
    '',
    'Zerlege diesen Prozessschritt in atomare Einzelschritte.',
  ].filter(Boolean).join('\n')

  const { text } = await generateText({
    model: resolveModel(process.env.INTERVIEW_MODEL),
    system: SUBSTEP_SYSTEM_PROMPT,
    prompt: userPrompt,
    temperature: 0,
  })

  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error('LLM returned no valid JSON array')

  const parsed = JSON.parse(jsonMatch[0]) as SubStep[]
  return parsed.map((s, i) => ({ ...s, order: s.order ?? i + 1 }))
}
