import { resolveModel } from '@/lib/llm-provider'
import { streamText, tool } from 'ai'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { RawExtraction } from './extraction'

// ─── Types ───────────────────────────────────────────────────────────────────

export type Phase = 'intro' | 'process_loop' | 'walkthrough_step' | 'slot_completion' | 'coverage_check' | 'wrap_up'

export const MANDATORY_SLOTS = ['frequency_per_month', 'duration_minutes', 'rule_based', 'data_sources'] as const
export const OPTIONAL_SLOTS = ['error_rate_percent', 'media_breaks'] as const
export type SlotName = typeof MANDATORY_SLOTS[number] | typeof OPTIONAL_SLOTS[number]

export interface SlotValue {
  value: string | number | boolean | string[]
  quote: string
  confidence?: 'confirmed' | 'estimate' | 'unknown'
  qualifier?: string | null
}

export interface StepEntry {
  title: string
  role?: string | null
  status: 'exploring' | 'walkthrough' | 'done'
  slots: {
    frequency_per_month: SlotValue | null
    duration_minutes: SlotValue | null
    rule_based: SlotValue | null
    data_sources: SlotValue | null
    error_rate_percent: SlotValue | null
    media_breaks: SlotValue | null
  }
  process_steps?: string[]
  friction_points?: string[]
  friction_tools?: string[]
  pain_point_primary?: string | null
}

export interface MissingSlot {
  step_title: string
  slot: SlotName
}

export interface InterviewContext {
  interviewId: string
  workspaceId: string
  employeeName: string
  employeeRole: string | null
  department: string
  focusTopics: string | null
  phase: Phase
  timerMinutes: number
  topicsCovered: string[]
  topicsOpen: string[]
  extractionsLog: RawExtraction[]
  maxDurationMinutes: number
  stepTracker: StepEntry[]
  missingSlotsForCoverageCheck?: MissingSlot[]
}

export interface TurnMessage {
  role: 'user' | 'assistant'
  content: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function computeMissingMandatorySlots(stepTracker: StepEntry[]): MissingSlot[] {
  const missing: MissingSlot[] = []
  for (const step of stepTracker) {
    for (const slot of MANDATORY_SLOTS) {
      if (step.slots[slot] === null) {
        missing.push({ step_title: step.title, slot })
      }
    }
  }
  return missing
}

// Strip markdown headings and control characters from LLM-generated strings
// before injecting them back into the system prompt.
function sanitizeForPrompt(s: string): string {
  return s
    .replace(/^#{1,6}\s+/gm, '')   // strip heading markers
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')  // strip non-printable
    .slice(0, 300)
}

function formatStepTracker(steps: StepEntry[]): string {
  if (steps.length === 0) return '- Noch kein Prozessschritt identifiziert.'

  return steps.map((step) => {
    const title = sanitizeForPrompt(step.title)
    const role = step.role ? sanitizeForPrompt(step.role) : null

    function fmtSlot(sv: SlotValue | null, label: string): string {
      if (!sv) return `  ${label}: fehlt`
      const conf = sv.confidence ? ` [${sv.confidence}]` : ''
      const qual = sv.qualifier ? ` ("${sv.qualifier}")` : ''
      return `  ${label}: ${sv.value} ✓${conf}${qual}`
    }

    const slotLines = [
      fmtSlot(step.slots.frequency_per_month, 'frequency_per_month'),
      fmtSlot(step.slots.duration_minutes,    'duration_minutes   '),
      `  rule_based:          ${step.slots.rule_based != null && step.slots.rule_based.value !== undefined ? `${step.slots.rule_based.value} ✓` : 'fehlt'}`,
      fmtSlot(step.slots.data_sources,        'data_sources       '),
      `  error_rate_percent:  ${step.slots.error_rate_percent ? `${step.slots.error_rate_percent.value} ✓` : 'fehlt'}`,
      `  media_breaks:        ${step.slots.media_breaks ? `${step.slots.media_breaks.value} ✓` : 'fehlt'}`,
    ]

    const walkthrough: string[] = []
    if (step.process_steps?.length) walkthrough.push(`  process_steps: ${step.process_steps.join(' → ')}`)
    if (step.friction_points?.length) walkthrough.push(`  friction_points: ${step.friction_points.join(', ')}`)
    if (step.friction_tools?.length) walkthrough.push(`  friction_tools: ${step.friction_tools.join(', ')}`)
    if (step.pain_point_primary) walkthrough.push(`  pain_point_primary: "${step.pain_point_primary}"`)

    return `[${step.status}] "${title}"${role ? ` (${role})` : ''}\n${slotLines.join('\n')}${walkthrough.length ? '\n' + walkthrough.join('\n') : ''}`
  }).join('\n\n')
}

function formatExtractionsLog(log: RawExtraction[]): string {
  if (log.length === 0) return '- Noch nichts extrahiert.'

  const lines: string[] = []
  for (const item of log) {
    if (item.type === 'pain_point') {
      const c = item.content as Record<string, unknown>
      lines.push(`- [pain_point] "${c.description}"`)
    } else if (item.type === 'tool') {
      const c = item.content as Record<string, unknown>
      lines.push(`- [tool] "${c.name}"`)
    } else if (item.type === 'role') {
      const c = item.content as Record<string, unknown>
      lines.push(`- [role] "${c.title}"`)
    }
  }
  return lines.join('\n')
}

// ─── System Prompt ────────────────────────────────────────────────────────────
// Split into static (invariant, cacheable) and dynamic (turn-specific) parts.
// Static part (D2): persona identity, turn_format, silence rules, tool rules.
//   No phase-specific content — stable across all turns for prompt caching.
// Dynamic part (D2): interview context, phase methodology, READ_ONLY_STATE tracker, extractions log.

function buildStaticPrompt(): string {
  return `Du bist KI-Interviewer. Erhebe implizites Prozesswissen von Mitarbeitern strukturiert.
Führe das Gespräch auf Deutsch — sachlich, direkt, präzise.
Sprich den Mitarbeiter mit Du an. Kein Sie, kein formeller Nachname.

Phasenmodell: intro → process_loop (explore_step) → walkthrough_step (Ablauf + opportunistische Quantifizierung) → slot_completion (verbleibende Pflichtslots) → (nächster Prozess: zurück zu process_loop, oder coverage_check) → wrap_up

<turn_format>
Jeder Agent-Turn (ab Turn 2) besteht aus maximal zwei Elementen in dieser Reihenfolge:
1. Optional: eine kurze Reaktion auf die letzte Antwort — maximal ein Satz.
2. Pflicht: eine direkte Frage.
Mehr nicht.

Ausnahmen:
- Turn 1 (Opener): Kontext + Einstiegsfrage — kein Werturteil.
- Abschluss-Turn nach complete_interview: kurze Verabschiedung.
- coverage_check mit mehreren offenen Slots: Slots in einer Frage bündeln.

Ab Turn 2 beginnt jeder Turn mit dem inhaltlichen Kern:
Richtig: "Die Rechnungsprüfung ist ein guter Einstieg — wie viele Rechnungen bearbeitest du pro Monat?"
Richtig: "90 Rechnungen — wie lange sitzt du typischerweise an einer, über alle Fälle gerechnet?"
Falsch: "Hallo Andreas, schön dass du dir die Zeit nimmst. Das klingt nach einem zeitintensiven Prozess. Wie viele..."
Falsch: "Hallo Andreas, danke für den Überblick."
Falsch: "Vielen Dank, das hilft mir sehr weiter."

Ab Turn 2: NIEMALS mit Name, "Hallo", "Danke", "Vielen Dank" oder ähnlichen Formeln beginnen.
</turn_format>

<silence>
Tool-Calls, Slot-Werte, Klassifikationsentscheidungen, Arithmetik, technische Fehler und interne Zwecke erscheinen nie im Text-Output.

Falsch: "Entschuldige, da habe ich mich bei der Eingabe vertan."
Falsch: "gehen wir von 1.440 Minuten aus, um das einheitlich zu erfassen."
Falsch: "würde ich dies als regelbasiert einstufen."
Falsch: "um das für meine Auswertung zu quantifizieren"
Falsch: "das hilft mir, den ROI zu berechnen"
Falsch: "das brauche ich für die Dokumentation"
Richtig: Wenn ein Tool-Call korrigiert wird, passiert das still. Der nächste Turn beginnt direkt mit der Frage.
Richtig: Fragen werden direkt gestellt, ohne Begründung warum die Information benötigt wird.

Anti-Anker-Pflicht: Zahlen-Vorschläge des Agenten sind verboten. Der Agent nennt keine eigene Zahl, die der Mitarbeiter nur noch bestätigen muss.
Falsch: "Soll ich mit 90 als Mittelwert rechnen?"
Falsch: "Dann rechne ich mit 90 als soliden Mittelwert."
Falsch: "daher rechne ich mit 90 als Orientierungswert"
Falsch: "dann notiere ich für die Dauer der Mahnrunde im Schnitt 150 Minuten"
(Gilt für alle Formulierungen wie "rechne ich mit", "notiere ich", "halte ich fest" mit eigenen Zahlenwerten — auch wenn der Wert vom Mitarbeiter stammt, darf der Agent ihn nicht verbalisiert zurückspiegeln.)
Richtig: "Du hast '80 bis 100' genannt — welche Zahl ist repräsentativer?"

PFLICHT: Generiere in JEDER Antwort zuerst mindestens einen vollständigen Satz sichtbaren Text, dann rufe Tools auf.
</silence>

<tools>
- register_step: Einmalig aufrufen wenn Schritt klar benannt. Vor Neuanlage Schritt-Tracker auf semantisch gleichwertige Einträge prüfen.
  NIEMALS register_step für Ausnahmen, Varianten oder Sonderfälle eines bereits registrierten Prozesses aufrufen. "Rechnungsprüfung ohne Bestellreferenz" ist KEIN eigenständiger Prozess — das ist ein friction_point auf "Rechnungsprüfung". Ausnahmen gehören in update_walkthrough_data(friction_points=["..."]). Erkennungsmuster: "aber wenn...", "außer wenn...", "Sonderfall", "nur wenn", "normalerweise schon, aber".
- record_slot: evidence_quote MUSS wörtliches Zitat aus dem Mitarbeiter-Statement sein — kein Paraphrasieren. Wird server-seitig validiert. Slot mit ✓ im Tracker nicht erneut setzen. Slot data_sources nicht nachfragen wenn bereits im Tracker gefüllt (✓).
- update_walkthrough_data: Aufrufen wenn Mitarbeiter Prozessschritte, Reibungspunkte, Tools oder primären Schmerzpunkt nennt. Felder sind additiv.
- enter_coverage_check: Einmalig beim Übergang zur coverage_check-Phase. Nur aufrufen wenn alle Fokusthemen mindestens einen Walkthrough-Durchgang hatten (im Schritt-Tracker registriert). Falls noch Fokusthemen fehlen: zuerst via transition_phase zu process_loop zurück.
- link_bottleneck: Aufrufen wenn Pain Point explizit an einem Schritt verortet werden kann.
- transition_phase: Beim Phasenwechsel aufrufen — nicht im Text erwähnen.
- update_topics: Nach jedem Turn mit aktualisierten Listen aufrufen.
- complete_interview: Nur in wrap_up, erst nachdem der Mitarbeiter auf die Abschlussfrage geantwortet hat.
- Halluzinations-Guard: Slot nur setzen wenn Mitarbeiter den Wert explizit genannt hat.
</tools>

`
}

// ─── Phase Methodology Sections (D2) ─────────────────────────────────────────
// Injected per-turn in buildDynamicContext so the static prompt stays invariant.

function buildPhaseMethodology(phase: Phase): string {
  if (phase === 'intro') {
    return `## Methodik: intro
Erkläre kurz den Zweck des Gesprächs und stelle eine offene Einstiegsfrage.

**Framing-Regeln (Pflicht):**
Verwende ausschließlich Formulierungen, die auf Arbeitserleichterung für den Mitarbeiter abzielen.
Richtig: "um zu verstehen, wo deine Arbeit unnötig aufwändig ist und wo wir das leichter machen können"
Richtig: "um herauszufinden, wo Prozesse reibungsloser laufen könnten"
Falsch: "um Prozesse zu optimieren" (ohne Bezug auf den Mitarbeiter)
Falsch: "um Automatisierungspotenzial zu identifizieren"
Falsch: jede Formulierung, die impliziert, dass die Arbeit des Mitarbeiters wegfallen könnte

**Opener-Einstiegsfrage (Pflicht):**
Turn 1: Offene Frage — niemals vorab bekannte oder konfigurierte Prozesse im ersten Turn namentlich nennen.
Richtig: "Erzähl mir kurz: Was sind deine Hauptaufgaben und wie sieht ein typischer Arbeitstag bei dir aus?"
Falsch: "Ich würde gerne mit der Rechnungsprüfung starten — wie läuft das bei dir ab?"

Ab Turn 2: Beginne mit dem inhaltlichen Kern — dem ersten Wort der Reaktion oder Frage.
Richtig: "Die Rechnungsprüfung ist ein guter Einstieg, da du sie täglich machst — wie viele Rechnungen bearbeitest du pro Monat?"
Richtig: "90 Rechnungen im Schnitt — wie lange sitzt du typischerweise an einer, über alle Fälle gerechnet?"
Falsch: "Hallo Andreas, schön dass du dir die Zeit nimmst. Das klingt nach einem zeitintensiven Prozess..."

Wechsle nach 1–2 Austauschen zu process_loop via transition_phase.`
  }

  if (phase === 'process_loop') {
    return `## Methodik: process_loop / explore_step
Ziel: Konkreten Prozessschritt identifizieren und mit register_step eintragen.
- Nutze Critical Incident Technique: "Erzähl mir von einem konkreten Fall, wo du [Tätigkeit] durchgeführt hast."
- Nutze CTA-Walkthrough: "Geh mir durch, was du genau tust, von Anfang bis Ende."
- Sobald der Schritt klar benannt ist: register_step aufrufen (title, optional role). PFLICHT-Reihenfolge: erst register_step, dann transition_phase(walkthrough_step). Kein Übergang zu walkthrough_step ohne erfolgreichen register_step-Call in diesem Turn.

Prozessauswahl: Wenn die Übersichtsantwort einen klaren Frequenz- oder Komplexitäts-Anker enthält (z.B. "80–100 Rechnungen pro Monat"), wähle den Einstiegsprozess selbst und begründe mit einem Satz warum — z.B.: "Da du sagst, die Rechnungsprüfung läuft täglich, fangen wir damit an — das ist die Basis für den Rest." Wenn kein klarer Anker vorhanden ist, frage nach dem Prozess, der dem Mitarbeiter die meisten Schwierigkeiten bereitet.

## Methodik: process_loop / bottleneck_probe
Ziel: Pain Points an konkreten Schritten verorten.
- Trigger-Phrasen: "zeitaufwändig", "umständlich", "geht oft schief", "manuell", "nervig", "Fehler"
- Wenn Bottleneck identifiziert: link_bottleneck aufrufen mit step_title, description und severity (high/medium/low).
- Danach: Entscheide ob weiterer Schritt erkundet oder coverage_check eingeleitet wird.`
  }

  if (phase === 'walkthrough_step') {
    return `## Methodik: walkthrough_step
Ziel: Den Mitarbeiter durch den Prozessablauf führen und dabei Reibungspunkte, Engpässe und Schmerzpunkte erfassen. Slots werden opportunistisch gefüllt — nur wenn sie im natürlichen Gesprächsfluss spontan entstehen.

**Fünf Leitfragen (über mehrere Turns entfalten — eine Frage pro Turn):**

1. Einstieg (variiert je nach rule_based des Schritts):
   - rule_based=true: "Wie fängt der Prozess konkret an — was ist der erste Schritt?"
   - rule_based=false: "Wie laufen solche Situationen typischerweise ab — was passiert meistens zuerst?"
2. Ablauf: "Was passiert als nächstes?" (wiederholt, bis der Prozess endet oder Reibung auftaucht)
3. Reibung: "Wo hakt es dabei am häufigsten — was kostet die meiste Zeit oder Energie?"
4. Ursache: "Was macht das an dieser Stelle schwierig — ein bestimmtes System, eine fehlende Information, eine Abhängigkeit?"
5. Persönliche Priorität: "Wenn du einen Punkt an diesem Prozess ändern könntest — was wäre das?"

Folge der Erzählung — wenn der Mitarbeiter bei Schritt 2 bereits Reibungspunkte nennt, vertiefe dort direkt (Schritt 4), ohne zurückzuspringen.

**Direkte Slot-Fragen verboten:**
In dieser Phase niemals direkt fragen: "Wie viele [Einheiten] pro Monat?", "Wie lange dauert das?",
"Läuft das immer gleich ab?", "Welche Daten nutzt du dabei?". Diese Fragen gehören in slot_completion.
In walkthrough_step gilt: Folge dem Ablauf. Wenn der Mitarbeiter einen Wert spontan nennt
→ record_slot aufrufen. Wenn nicht → kein Nachhaken, der Wert wird in slot_completion erhoben.

**Walkthrough-Daten erfassen:**
Rufe update_walkthrough_data auf wenn:
- Der Mitarbeiter einen konkreten Schritt beschreibt → process_steps
- Der Mitarbeiter einen Engpass oder Wartezeit nennt → friction_points
- Der Mitarbeiter ein System als Ursache benennt → friction_tools
- Der Mitarbeiter seinen wichtigsten Störpunkt nennt → pain_point_primary (Direktzitat bevorzugt)

**Opportunistische Quantifizierung (nur bei spontanen Angaben):**
Wenn der Mitarbeiter einen Wert von sich aus nennt (nicht als Reaktion auf eine Frage von dir):
- Mitarbeiter nennt Häufigkeit spontan → record_slot mit evidence_quote
- Mitarbeiter nennt Dauer spontan → record_slot mit evidence_quote — ABER: Wenn die Angabe "pro Woche" oder "pro Monat" lautet (z.B. "ca. 1 Stunde pro Woche für die Suche"), ist das ein Teilaufwand eines friction_point, KEIN duration_minutes-Wert (der ist pro Durchführung). Als friction_point via update_walkthrough_data eintragen, NICHT als record_slot(duration_minutes=...).
- Mitarbeiter nennt ein System → registriere als data_source via update_walkthrough_data

Bei Duration/Frequency: record_slot mit Konfidenz-Feld setzen:
- "confirmed" wenn Persona explizit akzeptiert
- "estimate" wenn als Orientierung bezeichnet, nicht gemessen
- "unknown" wenn keine Zahl genannt werden kann
qualifier setzen wenn Persona eine Einschränkung macht ("nie gemessen", "Sonderfälle länger", "variiert stark").

**Spannen-Pflicht:** Wenn Persona eine Spanne nennt (z.B. "zwei bis drei Tage"), erst Mittelwert bestätigen lassen: "Du hast '[Spanne]' gesagt — welcher Wert trifft es besser, wenn du an einen typischen Fall denkst?"

**Exception-Klassifikation:**
Wenn der Mitarbeiter eine Ausnahme oder einen Sonderfall beschreibt — erkennbar an Phrasen wie
"aber wenn", "nur wenn", "normalerweise schon, aber", "Sonderfall", "meistens geht das, außer" —
ist das ein friction_point auf dem aktuellen Prozess, kein eigenständiger Prozess.

Falsch: register_step("Rechnungsprüfung bei fehlender Bestellreferenz")
Richtig: update_walkthrough_data mit friction_points=["Bestellreferenz fehlt: manuelle Suche in drei Systemen, bis zu 60min"] und friction_tools=["ERP", "E-Mail", "Archive"]

**Abschluss:** Wenn der Ablauf natürlich endet (Mitarbeiter kommt zum Ende) oder alle 5 Leitfragen gestellt wurden: transition_phase zu slot_completion.

Beispiel — Opportunistische System-Erfassung:
Mitarbeiter: "Ich schaue zuerst in unserem ERP-System nach."
Agent: [update_walkthrough_data aufrufen mit friction_tools: ["ERP-System"]] "Und was passiert dann als nächstes?"

Beispiel — Priorität-Direktzitat:
Mitarbeiter: "Das Nervigste ist definitiv, dass ich dieselbe Zahl dreimal eingeben muss."
Agent: [update_walkthrough_data aufrufen mit pain_point_primary: "dass ich dieselbe Zahl dreimal eingeben muss"] "Warum passiert das — gibt es keine Schnittstelle zwischen den Systemen?"`
  }

  if (phase === 'slot_completion') {
    return `## Methodik: slot_completion
Ziel: Verbleibende Pflichtslots eines Schritts gezielt nachfragen. Kein sichtbarer Phasenwechsel — keine Ankündigung "jetzt noch ein paar Zahlen".

VORAUSSETZUNG: Der aktuell explorierte Schritt MUSS im Schritt-Tracker registriert sein (register_step aufgerufen). Wenn der Tracker keinen passenden Eintrag zeigt: register_step SOFORT aufrufen, dann mit record_slot fortfahren.

Pflichtslots: frequency_per_month, duration_minutes, rule_based, data_sources.

Vorgehen:
- Prüfe intern welche Pflichtslots noch fehlen (sichtbar im Schritt-Tracker).
- Frage max 2–3 fehlende Slots in direkten, natürlichen Fragen nach.
- data_sources-Fallback: Falls data_sources noch leer: "Welche Systeme oder Tools nutzt du dabei?" — Wenn keine Antwort: data_sources: [] setzen (leeres Array, nicht null).
- Konfidenz-Heuristik beim record_slot:
  * "confirmed" wenn Persona explizit akzeptiert
  * "estimate" wenn als Schätzung oder "ungefähr" bezeichnet
  * "unknown" wenn Persona keine Zahl nennen kann oder will
- Spannen: Mittelwert bestätigen lassen vor record_slot.

Abschluss-Signal: Wenn record_slot { step_complete: true } zurückgibt → alle Pflichtslots dieses Schritts sind gefüllt.
- Gibt es noch Fokusthemen, die im Schritt-Tracker fehlen (noch nicht exploriert)? → transition_phase(process_loop)
- Alle Fokusthemen im Tracker vorhanden → enter_coverage_check aufrufen.
Wenn die Persona keine Werte liefern kann (Slots bleiben 'unknown'): trotzdem enter_coverage_check aufrufen.

Default-Fragen für fehlende Slots:
- frequency_per_month: "Wie oft kommt das vor?" / Probe: "Eher täglich, wöchentlich oder seltener?" — Vage Angaben ("manchmal", "mehrmals", "regelmäßig") VOR record_slot konkretisieren: "Mehrmals pro Woche — wie viele Male ungefähr?"
- duration_minutes: "Wie lange dauert eine Durchführung davon im Schnitt — also pro Mal, über alle Fälle gerechnet, auch die aufwändigeren?" (Einheit: Minuten pro Durchführung — NICHT Minuten pro Monat oder Woche)
  ACHTUNG Scoping: Wenn die Persona einen Teilaufwand nennt ("ca. 1 Stunde pro Woche für die Suche bei fehlender Bestellreferenz"), ist das KEIN duration_minutes-Wert — es ist ein friction_point. Nicht in record_slot eintragen. Stattdessen nach der Gesamtdauer fragen: "Das ist der Suchaufwand für Ausnahmen — wie lange dauert [Prozess] insgesamt, von Anfang bis Ende?"
- rule_based: "Läuft das immer gleich ab?" / Probe: "Gibt es eine feste Reihenfolge oder Checkliste?"
- data_sources: "Welche Systeme oder Tools nutzt du dabei?" — NUR fragen wenn im Schritt-Tracker noch nicht gefüllt (kein ✓).`
  }

  if (phase === 'coverage_check') {
    return `## Methodik: coverage_check
Ziel: Fehlende Pflicht-Slots aller Schritte nachfüllen.

PFLICHT-PRÜFUNG VOR DEM START: Sind alle Fokusthemen im Schritt-Tracker registriert und haben mindestens einen Walkthrough-Durchgang? Falls ein Fokusthema fehlt: sofort transition_phase zurück zu process_loop — kein Slot-Filling ohne vorherigen Walkthrough. Erst wenn alle Fokusthemen exploriert wurden, darf coverage_check starten.

- Coverage-Check läuft intern. Kein "lass mich kurz prüfen", kein "ich möchte sicherstellen". Kein sichtbarer Übergangskommentar.
- Nach enter_coverage_check: direkt fehlende Werte in natürlichem Kontext nachfragen, ohne Ankündigung.
- Frage fehlende Werte in natürlichem Kontext nach, nicht als Liste.
- Wenn alle Pflicht-Slots gefüllt: transition_phase zu wrap_up.
- Sobald der Mitarbeiter in dieser Phase einen Prozess oder eine Tätigkeit nennt, die noch nicht im Schritt-Tracker registriert ist: den Prozess direkt aufnehmen und explorieren. Kein Erlaubnis-Fragen ("Sollen wir den noch kurz mit aufnehmen?") — stattdessen: direkt handeln ("Erzähl kurz, wie [Prozess] bei euch abläuft.").`
  }

  // wrap_up
  return `## Methodik: wrap_up
Ziel: Interview geordnet abschließen.

Abschluss-Sequenz (exakt in dieser Reihenfolge):
1. Puffer-Satz: "Ich glaube, wir haben die wichtigsten Abläufe gut zusammen."
2. Abschlussfrage: "Gibt es noch Prozesse oder Tätigkeiten, die wir nicht besprochen haben?"
3. Antwort abwarten.
4. Auswerten: Neuer Prozess → direkt aufnehmen und explorieren (kein Erlaubnis-Fragen). Keine neuen Inhalte → complete_interview.
5. Abschluss-Turn: kurze Verabschiedung, keine inhaltliche Frage.

Kein "Danke" vor der Abschlussfrage. Keine zweite Abschlussrunde.

Neuer Prozess in wrap_up: Sobald der Mitarbeiter in der Wrap-up-Phase einen Prozess oder eine Tätigkeit nennt, die noch nicht im Schritt-Tracker registriert ist, gilt das als Explorations-Signal — unabhängig davon, ob gerade die Abschlussfrage gestellt wurde. Reaktion: Direkt aufnehmen und explorieren — kein Erlaubnis-Fragen ("Sollen wir den noch kurz mit aufnehmen?" ist verboten). Richtig: "Erzähl kurz, wie [Prozess] bei euch abläuft." Einzige Ausnahme: Der Mitarbeiter signalisiert selbst, dass er die Details gerade nicht parat hat — dann separaten Termin anbieten und Interview ohne diesen Prozess abschließen.

Slot-Audit vor complete_interview: Prüfe den Schritt-Tracker — hat jeder Schritt frequency_per_month, duration_minutes und rule_based gefüllt? Fehlende Werte in einem Turn nachfragen. Kann der Mitarbeiter nicht liefern: complete_interview trotzdem aufrufen.`
}

// ─── Few-shot examples for walkthrough_step (D6) ─────────────────────────────
const WALKTHROUGH_EXAMPLES = `
<EXAMPLE phase="walkthrough_step">
  USER: "Normalerweise dauert eine Rechnung 5 Minuten. Aber wenn die Bestellreferenz fehlt,
         muss ich in drei Systemen suchen — das kann eine Stunde werden."
  AGENT: "Das klingt nach einem Prozess, der bei Ausnahmen besonders aufwändig wird.
          Was passiert genau, wenn die Bestellreferenz fehlt — was ist dein erster Schritt?"
  // Richtig: Agent ruft update_walkthrough_data(friction_points=["Bestellreferenz fehlt: manuelle Suche in drei Systemen, bis zu 60min"], friction_tools=["ERP", "E-Mail", "Archive"]) auf — kein register_step.
  // Richtig: Agent fragt NICHT "wie lange dauert das im Schnitt?".
  // Richtig: Agent erkundet den Ausnahmepfad als Reibungspunkt, nicht als eigenständigen Prozess.
</EXAMPLE>

<EXAMPLE phase="walkthrough_step">
  USER: "Das dauert schon mal zwei bis drei Tage."
  AGENT: "Du hast 'zwei bis drei Tage' gesagt — welcher Wert trifft es besser, wenn du an einen typischen Fall denkst?"
  // Richtig: Agent nennt KEINE eigene Zahl ("also 2,5 Tage").
  // Richtig: Agent ankert an Formulierung des Mitarbeiters.
</EXAMPLE>

<EXAMPLE phase="walkthrough_step">
  USER: [Startet den Walkthrough]
  AGENT: "Geh mir einmal durch, wie das bei euch typischerweise abläuft — von Anfang bis Ende. Was ist der erste Schritt?"
  // Richtig: Agent fragt NICHT "Wie oft kommt das pro Monat vor?" oder "Wie lange dauert Schritt 1?".
  // Richtig: Agent öffnet narrativ, keine Slot-Frage.
</EXAMPLE>

<EXAMPLE phase="walkthrough_step">
  USER: "Das machen wir ungefähr zweimal pro Woche, also etwa 8-mal im Monat."
  AGENT: [ruft record_slot(field="frequency_per_month", value=8, evidence_quote="zweimal pro Woche, also etwa 8-mal im Monat") auf, antwortet dann narrativ weiter]
  // Richtig: Agent erfasst spontan genannten Wert still via record_slot.
  // Richtig: Agent stellt KEINE Bestätigungsfrage zurück ("also 8-mal?").
</EXAMPLE>`

// ─── Dynamic Context Builder ──────────────────────────────────────────────────

function buildDynamicContext(ctx: InterviewContext): string {
  const focusLine = ctx.focusTopics
    ? `Fokusthemen (NUR interne Steuerung — im Opener niemals namentlich nennen): ${ctx.focusTopics}`
    : 'Keine spezifischen Fokusthemen — führe eine offene Prozessexploration durch.'

  const warnAt = ctx.maxDurationMinutes - 5
  const hardAt = ctx.maxDurationMinutes

  const timingWarning =
    ctx.timerMinutes >= hardAt
      ? `\n⚠️ KRITISCH: ${hardAt} Minuten erreicht. Beende das Interview sofort mit complete_interview.`
      : ctx.timerMinutes >= warnAt
      ? `\n⚠️ HINWEIS: ${warnAt} Minuten erreicht. Leite aktiv in die wrap_up-Phase über.`
      : ''

  const shortModeHint =
    ctx.maxDurationMinutes <= 10
      ? '\n- Kurzmodus aktiv: Halte Übergänge zwischen Phasen kurz und komm zügig zum Abschluss.'
      : ''

  const coverageCheckSection = (ctx.phase === 'coverage_check' || ctx.phase === 'slot_completion') && ctx.missingSlotsForCoverageCheck && ctx.missingSlotsForCoverageCheck.length > 0
    ? `\n## Fehlende Pflicht-Slots (${ctx.phase})\n${ctx.missingSlotsForCoverageCheck.map(m => `- Schritt "${m.step_title}" → ${m.slot}`).join('\n')}\nFrage diese Werte gezielt und natürlich nach, bevor du zur nächsten Phase übergehst.`
    : ctx.phase === 'coverage_check'
    ? '\n## Coverage vollständig\nAlle Pflicht-Slots gefüllt. Wechsle direkt zu wrap_up via transition_phase.'
    : ctx.phase === 'slot_completion' && ctx.missingSlotsForCoverageCheck !== undefined
    ? '\n## Slot-Completion vollständig\nAlle bisher registrierten Schritte haben vollständige Pflicht-Slots. Nächste Aktion: enter_coverage_check aufrufen.'
    : ''

  // D1 — READ_ONLY_STATE: In walkthrough_step only show filled slots to avoid
  // Observable-Goal pull on empty fields. In all other phases show the full tracker.
  let stepTrackerSection: string
  if (ctx.phase === 'walkthrough_step') {
    const filledLines = ctx.stepTracker.flatMap((step) => {
      const filledSlots = (Object.entries(step.slots) as [string, SlotValue | null][])
        .filter(([, sv]) => sv !== null)
        .map(([name, sv]) => `  ${name}: ${sv!.value} ✓`)
      if (filledSlots.length === 0 && !step.process_steps?.length && !step.friction_points?.length) return []
      const header = `[${step.status}] "${sanitizeForPrompt(step.title)}"${step.role ? ` (${sanitizeForPrompt(step.role)})` : ''}`
      const walkLines: string[] = []
      if (step.process_steps?.length) walkLines.push(`  process_steps: ${step.process_steps.join(' → ')}`)
      if (step.friction_points?.length) walkLines.push(`  friction_points: ${step.friction_points.join(', ')}`)
      if (step.friction_tools?.length) walkLines.push(`  friction_tools: ${step.friction_tools.join(', ')}`)
      return [header, ...filledSlots, ...walkLines]
    })

    stepTrackerSection = filledLines.length > 0
      ? `\n<READ_ONLY_STATE>\nProtokoll bisher erfasster Daten — zur Orientierung, nicht zur Optimierung.\nDiese Felder beschreiben was bereits gesagt wurde. Leere Felder sind kein Gesprächsziel. Nicht auf Basis leerer Felder fragen.\n${filledLines.join('\n')}\n</READ_ONLY_STATE>`
      : ''
  } else {
    stepTrackerSection = `\n## Schritt-Tracker (aktueller Slot-Filling-Stand)\n${formatStepTracker(ctx.stepTracker)}`
  }

  // D6 — Few-shot examples only injected in walkthrough_step
  const fewShotSection = ctx.phase === 'walkthrough_step' ? WALKTHROUGH_EXAMPLES : ''

  // D2 — Phase methodology injected here (not in static prompt)
  const methodologySection = `\n<methodology>\n${buildPhaseMethodology(ctx.phase)}\n</methodology>`

  return `## Interview-Kontext
- Mitarbeiter: ${ctx.employeeName}${ctx.employeeRole ? `, ${ctx.employeeRole}` : ''}
- Abteilung: ${ctx.department}
- ${focusLine}
- Phase: ${ctx.phase}
- Verstrichene Zeit: ${ctx.timerMinutes} / ${ctx.maxDurationMinutes} Minuten${timingWarning}${shortModeHint}

## Extrahierte Wissensobjekte
${formatExtractionsLog(ctx.extractionsLog)}${coverageCheckSection}${methodologySection}${stepTrackerSection}${fewShotSection}`
}

// ─── Tools ────────────────────────────────────────────────────────────────────

export function buildTools(interviewId: string, workspaceId: string, currentUserInput?: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabaseAdmin() as any

  return {
    transition_phase: tool({
      description: 'Wechselt die Interview-Phase. Aufrufen beim Übergang von einer Phase zur nächsten.',
      inputSchema: z.object({
        new_phase: z.enum(['process_loop', 'walkthrough_step', 'slot_completion', 'coverage_check', 'wrap_up']),
      }),
      execute: async ({ new_phase }) => {
        try {
          await supabase
            .from('interview_state')
            .update({ phase: new_phase, updated_at: new Date().toISOString() })
            .eq('interview_id', interviewId)
          return { success: true, phase: new_phase }
        } catch (err) {
          console.error('[transition_phase] failed:', err)
          return { success: false, error: (err as Error).message }
        }
      },
    }),

    update_topics: tool({
      description: 'Aktualisiert die Liste der abgedeckten und offenen Themen nach einem Turn.',
      inputSchema: z.object({
        covered: z.array(z.string()),
        open: z.array(z.string()),
      }),
      execute: async ({ covered, open }) => {
        try {
          await supabase
            .from('interview_state')
            .update({
              topics_covered: covered,
              topics_open: open,
              updated_at: new Date().toISOString(),
            })
            .eq('interview_id', interviewId)
          return { success: true }
        } catch (err) {
          console.error('[update_topics] failed:', err)
          return { success: false, error: (err as Error).message }
        }
      },
    }),

    complete_interview: tool({
      description: 'Schließt das Interview ab. Nur in wrap_up, erst nachdem der Mitarbeiter auf die Abschlussfrage geantwortet hat.',
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const admin = getSupabaseAdmin()
          const { error: interviewError } = await admin
            .from('interviews')
            .update({ status: 'completed', extractions_pending: true })
            .eq('id', interviewId)
          if (interviewError) throw new Error(interviewError.message)

          const { error: stateError } = await admin
            .from('interview_state')
            .update({ phase: 'wrap_up', updated_at: new Date().toISOString() })
            .eq('interview_id', interviewId)
          if (stateError) console.error('[complete_interview] state update failed:', stateError.message)

          return { success: true }
        } catch (err) {
          console.error('[complete_interview] failed:', err)
          return { success: false, error: (err as Error).message }
        }
      },
    }),

    register_step: tool({
      description: 'Legt einen neuen Prozessschritt im Slot-Tracker an. Einmalig pro Schritt aufrufen sobald der Schritt klar benannt ist.',
      inputSchema: z.object({
        title: z.string().min(1),
        role: z.string().optional(),
      }),
      execute: async ({ title, role }) => {
        try {
          const { data: stateRow } = await supabase
            .from('interview_state')
            .select('step_tracker')
            .eq('interview_id', interviewId)
            .maybeSingle()

          const current: StepEntry[] = (stateRow?.step_tracker as StepEntry[] | null) ?? []

          // Deduplicate: case-insensitive title match
          const normalizedTitle = title.trim().toLowerCase()
          const exists = current.some((s) => s.title.trim().toLowerCase() === normalizedTitle)
          if (exists) {
            return { success: true, deduplicated: true, message: 'Schritt bereits vorhanden' }
          }

          const newEntry: StepEntry = {
            title: title.trim(),
            role: role ?? null,
            status: 'exploring',
            slots: {
              frequency_per_month: null,
              duration_minutes: null,
              rule_based: null,
              data_sources: null,
              error_rate_percent: null,
              media_breaks: null,
            },
            process_steps: [],
            friction_points: [],
            friction_tools: [],
            pain_point_primary: null,
          }

          const updated = [...current, newEntry]
          await supabase
            .from('interview_state')
            .update({ step_tracker: updated, updated_at: new Date().toISOString() })
            .eq('interview_id', interviewId)

          return {
            success: true,
            step_tracker: updated,
            existing_step_titles: updated.map((s) => s.title),
            reminder: 'Prüfe: Enthält existing_step_titles einen semantisch gleichwertigen Eintrag (z.B. Umformulierung, anderer Begriff für denselben Prozess)? Falls ja: lösche den neuen Eintrag nicht — nutze stattdessen record_slot mit dem bestehenden Titel.',
          }
        } catch (err) {
          console.error('[register_step] failed:', err)
          return { success: false, error: (err as Error).message }
        }
      },
    }),

    record_slot: tool({
      description: 'Füllt einen Slot im Schritt-Tracker. In `walkthrough_step`: Nur aufrufen, wenn der Mitarbeiter den Wert spontan nannte — niemals nach direkter Nachfrage. In `slot_completion` / `coverage_check`: Aktiv nach Werten fragen und erfassen. evidence_quote MUSS wörtliches Zitat sein.',
      inputSchema: z.object({
        step_title: z.string().min(1),
        slot: z.enum(['frequency_per_month', 'duration_minutes', 'rule_based', 'data_sources', 'error_rate_percent', 'media_breaks']),
        value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
        evidence_quote: z.string().min(3, 'evidence_quote muss ein wörtliches Zitat enthalten'),
        confidence: z.enum(['confirmed', 'estimate', 'unknown']).optional(),
        qualifier: z.string().nullable().optional(),
      }),
      execute: async ({ step_title, slot, value, evidence_quote, confidence, qualifier }) => {
        if (!evidence_quote || evidence_quote.trim().length < 3) {
          return { success: false, error: 'evidence_quote fehlt oder zu kurz. Zitiere wörtlich aus der Mitarbeiter-Antwort.' }
        }
        // Use verbatim user turn text as quote — LLM evidence_quote is fallback only
        const verbatimQuote = currentUserInput?.trim() || evidence_quote

        try {
          const { data: stateRow } = await supabase
            .from('interview_state')
            .select('step_tracker')
            .eq('interview_id', interviewId)
            .maybeSingle()

          const current: StepEntry[] = (stateRow?.step_tracker as StepEntry[] | null) ?? []
          const normalizedTitle = step_title.trim().toLowerCase()
          const stepIndex = current.findIndex((s) => s.title.trim().toLowerCase() === normalizedTitle)

          if (stepIndex === -1) {
            return { success: false, error: `Schritt "${step_title}" nicht gefunden. Zuerst register_step aufrufen.` }
          }

          const updated = [...current]
          updated[stepIndex] = {
            ...updated[stepIndex],
            status: updated[stepIndex].status === 'exploring' ? 'walkthrough' : updated[stepIndex].status,
            slots: {
              ...updated[stepIndex].slots,
              [slot]: {
                value,
                quote: verbatimQuote,
                ...(confidence !== undefined ? { confidence } : {}),
                ...(qualifier !== undefined ? { qualifier } : {}),
              },
            },
          }

          // Auto-transition to 'done' when all mandatory slots are filled
          const allMandatoryFilled = MANDATORY_SLOTS.every(
            (s) => updated[stepIndex].slots[s] !== null
          )
          if (allMandatoryFilled) {
            updated[stepIndex] = { ...updated[stepIndex], status: 'done' }
          }

          await supabase
            .from('interview_state')
            .update({ step_tracker: updated, updated_at: new Date().toISOString() })
            .eq('interview_id', interviewId)

          return { success: true, step_title, slot, value, step_complete: allMandatoryFilled }
        } catch (err) {
          console.error('[record_slot] failed:', err)
          return { success: false, error: (err as Error).message }
        }
      },
    }),

    enter_coverage_check: tool({
      description: 'Leitet die coverage_check-Phase ein. Gibt eine Liste aller leeren Pflicht-Slots zurück, die noch nachgefragt werden müssen.',
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const { data: stateRow } = await supabase
            .from('interview_state')
            .select('step_tracker')
            .eq('interview_id', interviewId)
            .maybeSingle()

          const steps: StepEntry[] = (stateRow?.step_tracker as StepEntry[] | null) ?? []
          const missing = computeMissingMandatorySlots(steps)

          await supabase
            .from('interview_state')
            .update({ phase: 'coverage_check', updated_at: new Date().toISOString() })
            .eq('interview_id', interviewId)

          return {
            success: true,
            phase: 'coverage_check',
            missing_mandatory_slots: missing,
            all_covered: missing.length === 0,
          }
        } catch (err) {
          console.error('[enter_coverage_check] failed:', err)
          return { success: false, error: (err as Error).message }
        }
      },
    }),

    link_bottleneck: tool({
      description: 'Verknüpft einen Pain Point mit einem konkreten Prozessschritt. Legt ein knowledge_object vom Typ pain_point mit step_ref an.',
      inputSchema: z.object({
        step_title: z.string().min(1),
        description: z.string().min(5),
        severity: z.enum(['high', 'medium', 'low']),
      }),
      execute: async ({ step_title, description, severity }) => {
        try {
          await supabase
            .from('knowledge_objects')
            .insert({
              interview_id: interviewId,
              workspace_id: workspaceId,
              type: 'pain_point',
              content: {
                description,
                severity,
                step_ref: step_title,
              },
              source_quote: null,
            })

          // Append to extractions_log so subsequent system prompts reflect this pain point
          const { data: stateForLog } = await supabase
            .from('interview_state')
            .select('extractions_log')
            .eq('interview_id', interviewId)
            .maybeSingle()

          const currentLog = (stateForLog?.extractions_log as RawExtraction[] | null) ?? []
          const logEntry: RawExtraction = {
            type: 'pain_point',
            content: { description, severity, step_ref: step_title },
            source_quote: '',
          }
          await supabase
            .from('interview_state')
            .update({
              extractions_log: [...currentLog, logEntry],
              updated_at: new Date().toISOString(),
            })
            .eq('interview_id', interviewId)

          return { success: true, step_title, severity }
        } catch (err) {
          console.error('[link_bottleneck] failed:', err)
          return { success: false, error: (err as Error).message }
        }
      },
    }),

    update_walkthrough_data: tool({
      description: 'Aktualisiert die Ablauf- und Reibungsdaten eines Prozessschritts während walkthrough_step. Felder sind additiv — bestehende Einträge werden nicht gelöscht.',
      inputSchema: z.object({
        step_title: z.string().min(1),
        process_steps: z.array(z.string()).optional(),
        friction_points: z.array(z.string()).optional(),
        friction_tools: z.array(z.string()).optional(),
        pain_point_primary: z.string().nullable().optional(),
      }),
      execute: async ({ step_title, process_steps, friction_points, friction_tools, pain_point_primary }) => {
        try {
          const { data: stateRow } = await supabase
            .from('interview_state')
            .select('step_tracker')
            .eq('interview_id', interviewId)
            .maybeSingle()

          const current: StepEntry[] = (stateRow?.step_tracker as StepEntry[] | null) ?? []
          const normalizedTitle = step_title.trim().toLowerCase()
          const stepIndex = current.findIndex((s) => s.title.trim().toLowerCase() === normalizedTitle)

          if (stepIndex === -1) {
            return { success: false, error: `Schritt "${step_title}" nicht gefunden. Zuerst register_step aufrufen.` }
          }

          const existing = current[stepIndex]
          const updated = [...current]
          updated[stepIndex] = {
            ...existing,
            status: existing.status === 'exploring' ? 'walkthrough' : existing.status,
            process_steps: process_steps !== undefined
              ? [...(existing.process_steps ?? []), ...process_steps]
              : (existing.process_steps ?? []),
            friction_points: friction_points !== undefined
              ? [...(existing.friction_points ?? []), ...friction_points]
              : (existing.friction_points ?? []),
            friction_tools: friction_tools !== undefined
              ? [...(existing.friction_tools ?? []), ...friction_tools]
              : (existing.friction_tools ?? []),
            pain_point_primary: pain_point_primary !== undefined ? pain_point_primary : existing.pain_point_primary,
          }

          await supabase
            .from('interview_state')
            .update({ step_tracker: updated, updated_at: new Date().toISOString() })
            .eq('interview_id', interviewId)

          return { success: true, step_title }
        } catch (err) {
          console.error('[update_walkthrough_data] failed:', err)
          return { success: false, error: (err as Error).message }
        }
      },
    }),
  }
}

// ─── Stream Factory ───────────────────────────────────────────────────────────

export interface AgentStreamOptions {
  context: InterviewContext
  history: TurnMessage[]
  userInput?: string
  isReconnect?: boolean
  isStart?: boolean
  onFinish?: (text: string) => Promise<void>
}

export function createInterviewStream(opts: AgentStreamOptions) {
  const modelString = process.env.INTERVIEW_MODEL ?? 'google/gemini-3.1-flash-lite'
  const model = resolveModel(modelString)

  // D2: static prompt is now invariant (no phase arg) — cacheable across turns.
  // Dynamic context (phase methodology + READ_ONLY_STATE) is injected per-turn.
  const staticPart = buildStaticPrompt()
  const dynamicPart = buildDynamicContext(opts.context)

  type PlainMessage = { role: 'user' | 'assistant'; content: string }
  type RichMessage = { role: 'user' | 'assistant'; content: string | Array<{ type: 'text'; text: string }> }

  const baseMessages: PlainMessage[] = opts.isReconnect
    ? [
        ...opts.history.map((t) => ({ role: t.role, content: t.content })),
        { role: 'user' as const, content: 'Ich bin wieder da, können wir weitermachen?' },
      ]
    : opts.isStart
    ? [{ role: 'user' as const, content: 'Bitte starte das Interview.' }]
    : opts.history.map((t) => ({ role: t.role, content: t.content }))

  // D2: Unified provider path — static prompt in system (cacheable), dynamic
  // context prepended to the last user turn so it stays turn-specific.
  // Fallback: if messages is empty (edge case), dynamic goes into system.
  let systemPrompt: string
  let messages: RichMessage[]

  if (baseMessages.length > 0) {
    systemPrompt = staticPart
    messages = baseMessages.map((msg, idx) => {
      if (idx === baseMessages.length - 1 && msg.role === 'user') {
        return {
          role: 'user' as const,
          content: [
            { type: 'text' as const, text: dynamicPart + '\n\n---\n\n' },
            { type: 'text' as const, text: msg.content },
          ],
        }
      }
      return msg
    })
  } else {
    // Defensive fallback: no user messages yet — inject dynamic into system
    systemPrompt = `${staticPart}\n\n${dynamicPart}`
    messages = baseMessages
  }

  return streamText({
    model,
    system: systemPrompt,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: messages as any,
    tools: buildTools(opts.context.interviewId, opts.context.workspaceId, opts.userInput),
    // Stop as soon as any step has produced visible text — prevents duplicate output.
    // Allow up to 4 tool-only steps before forcing a stop (phase transitions can
    // require 2-3 consecutive tool calls before the model generates visible text).
    stopWhen: ({ steps }) => {
      if (steps.length === 0) return false
      const hasText = steps.some((s) => s.text.trim().length > 0)
      return hasText || steps.length >= 4
    },
    onFinish: opts.onFinish
      ? async ({ text, usage, providerMetadata }) => {
          const meta = providerMetadata as Record<string, unknown> | undefined
          const anthropicMeta = meta?.anthropic as Record<string, unknown> | undefined
          const googleMeta = meta?.google as Record<string, unknown> | undefined
          // googleCachedTokens: @ai-sdk/google does not yet expose cachedContentTokenCount
          // via providerMetadata (open issue: vercel/ai#3212, vercel/ai#11513).
          // The field stays null until the SDK surfaces it. ADR-010 tracks this.
          const usageData = {
            model: modelString,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            cacheReadTokens: anthropicMeta?.cacheReadInputTokens ?? null,
            cacheCreationTokens: anthropicMeta?.cacheCreationInputTokens ?? null,
            googleCachedTokens: googleMeta?.cachedContentTokenCount ?? null,
          }
          console.log('[token-usage] turn', usageData)
          if (process.env.NODE_ENV === 'development') {
            try {
              const fs = await import('fs')
              fs.writeFileSync('.eval-last-usage.json', JSON.stringify(usageData))
            } catch { /* non-blocking */ }
          }
          await opts.onFinish!(text)
        }
      : undefined,
  })
}
