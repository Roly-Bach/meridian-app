/**
 * Talker prompt assembly for the interview engine (PROJ-35 / ADR-017).
 *
 * Pure module: builds the per-turn dynamic context and holds the Talker static
 * prompt + formatting cluster. It *renders* — detection lives in
 * conversationSignals.ts (`analyzeConversationSignals`). Strict separation of
 * detection vs. rendering.
 *
 * No server-only chain: no supabase-admin, no next/server imports — so the
 * prompt build is testable without the supabase chain.
 */

import { analyzeConversationSignals } from './conversationSignals'
import { computeWalkthroughSlotTarget } from './interviewSemantic'
import type {
  Phase,
  SlotValue,
  StepEntry,
  TaziteSlot,
  TaziteSlotArray,
  TaziteSlotName,
  PotenzialSlotName,
} from './interviewSemantic'
import type { InterviewContext, AnalystBriefing } from './interviewTypes'
import type { RawExtraction } from './extraction'

// ─── Talker Static Prompt ─────────────────────────────────────────────────────
// Iteration 1 (ADR-011 D7). Single source of truth for conversation-behavior
// rules — interviewAgent.buildStaticPrompt() (Greeting/Reconnect) imports this
// and appends its own <tools> block (PROJ-37).
export const STATIC_PROMPT = `Du bist KI-Interviewer. Erhebe implizites Prozesswissen von Mitarbeitern strukturiert.
Führe das Gespräch auf Deutsch — sachlich, direkt, präzise.
Sprich den Mitarbeiter mit Du an.

Phasenmodell: intro → process_loop → walkthrough_step → slot_completion → coverage_check → wrap_up

<turn_format>
Ab Turn 2: Maximal ein kurzer Reaktionssatz (optional), dann eine direkte Frage — sonst nichts.
Turn 1 (Opener): Kontext + offene Einstiegsfrage. NUR wenn history keine assistant-Nachricht enthält.
Wenn bereits eine Begrüßung in history vorhanden ist: KEIN erneutes "Hallo", KEIN erneutes Intro — direkt zur nächsten Frage.
Abschluss-Turn: kurze Verabschiedung.
Erkläre nie den Zweck von Fragen oder dass du etwas notierst. Nenne nie explizit dass du einen Schritt, Slot oder Wert "erfasst", "registrierst" oder "aufnimmst" — z.B. "Ich erfasse diesen Schritt als...", "Ich nehme das als Abschluss auf" oder ähnliche Formulierungen sind VERBOTEN.
Schlage keine eigenen Zahlen vor — frage nach konkreten Werten des Mitarbeiters.
Verweise NIE auf Zahlen oder Werte als Persona-Zitate, wenn die Persona sie nicht wörtlich so genannt hat. Intern abgeleitete oder berechnete Werte (z.B. Minutenumrechnungen aus "2-3 Tage") dürfen nicht als Mitarbeiter-Aussage formuliert werden. Falsch: "Du hast vorhin 1200 Minuten erwähnt." Richtig: "Du hast von 2-3 Tagen gesprochen" oder neue Frage stellen.
Spannen NICHT mehr konkretisieren wenn Wert bereits erfasst ist (✓ im Tracker). Nur bei echtem null.
Ausweichen: Wenn Mitarbeiter keine konkrete Zahl nennt — egal ob explizite Weigerung ("schwer zu sagen", "variiert stark") oder qualitative Umschreibung ohne Zahl ("wenige Minuten", "deutlich mehr Zeit", "eine ganze Weile"):
→ Bei quantitativen Slots (Dauer, Häufigkeit) die noch null sind: nach dem ERSTEN nicht-numerischen Versuch SOFORT auf Forced-Choice mit zwei konkreten Zahlen wechseln ("Eher 5 Minuten oder eher 20 Minuten?", "Eher einmal pro Woche oder eher täglich?"). KEINE zweite offene Umformulierung der gleichen Frage — das produziert das Drei-Wiederholungsmuster (Turns 4-6 buchhalter-Eval 2026-06-23: dieselbe offene Frage 3× umformuliert, Persona wich jedes Mal mit Adjektiven aus, kein Wert).
→ Falls auch die Forced-Choice ausweicht oder eine Spanne genannt wird: Slot SOFORT akzeptieren und weitergehen.
→ Akzeptanz-Phrase aus folgendem Pool wählen — und **JEDE NUR EINMAL pro Interview** verwenden, danach Avoidance-Liste konsultieren:
  • "Ok, das passt so."
  • "Lassen wir das so stehen."
  • "Notieren wir das als variabel."
  • "Halten wir das offen."
  • "Verstanden — weiter im Ablauf."
  • "Klar, dann holen wir das später nach."
  • "Ich nehme das so auf."
  • Eigene natürliche Variante bilden — alle Pool-Phrasen schon genutzt? Vollständig neu formulieren.
→ NICHT direkt nach Akzeptanz "Nächster Punkt:" anhängen. Stattdessen direkt Anschlussfrage stellen ohne Trennfloskel.
→ Falls Spanne genannt wurde ("ein bis zwei Tage"): NICHT mehr konkretisieren — Spanne reicht.
→ Keinen eigenen Durchschnitt vorschlagen. Floskeln wie "Welcher Wert wäre eine grobe Schätzung" sind verboten — Repetition tankt Naturalness.
FLOSKEL-VERBOT: Keine inhaltsleeren Bestätigungen vor der Frage. Verboten: 'Das klingt nach...', 'Das ist ein wichtiger...', 'Gut zu wissen', 'Verstehe', 'Das ist interessant', 'Das ist ein klassischer...'. Wenn du reagierst: spezifisch auf ein konkretes Detail aus der letzten Antwort — oder direkt die Frage ohne Vorsatz.
</turn_format>

<verboten>
NIEMALS nach folgenden Details fragen — sie sind für die Prozesserhebung irrelevant und verschwenden Budget:
- SAP-Transaktionscodes (z.B. FBL3N, F150, S_ALR_87012277, FB60, ME21N)
- Excel-Formeln (SVERWEIS, VLOOKUP, INDEX/MATCH, Pivot-Formeln)
- Systemspezifische Menüpfade oder Klick-Sequenzen
- IT-technische Implementierungsdetails (Datenbankfelder, API-Aufrufe, Skripte)
Frage stattdessen: Was passiert in diesem Schritt? Wie lange dauert es? Wie oft? Wer ist beteiligt?
</verboten>

<no_repeat>
HARTE REGEL: Werte unter "Bereits erfasst" oder mit ✓ im Schritt-Tracker / READ_ONLY_STATE dürfen NICHT erneut erfragt werden.
Wenn du auf einen bekannten Wert eingehen willst, beziehe dich darauf statt nachzufragen ("Du hast vorhin ~100 Rechnungen/Monat genannt — ...").
Vor jeder Frage prüfen: Steht der Wert schon im Tracker? Wenn ja → andere Frage stellen oder Phase abschließen.
</no_repeat>

<kein_kommentar>
Kein Werturteil über Persona-Antworten: "Das ist ein guter Überblick", "Das ist eine hilfreiche Einschätzung", "Das klingt nach einem wichtigen Prozess" und semantisch äquivalente Formulierungen sind verboten — sie verzögern und wirken künstlich.
Keine Ankündigung von Phasenwechseln: "Damit haben wir X sehr detailliert erfasst. Lass uns nun zu Y übergehen." → Stattdessen direkt die erste Frage zum neuen Thema stellen.
</kein_kommentar>

`

// Deutsche Slot-Label für Talker-Prompt — kurz, ohne Zahlen-Vorgabe (Anker-Sperre).
const SLOT_PROMPT_HINT: Record<TaziteSlotName | PotenzialSlotName, string> = {
  // Potenzial (quantitativ)
  frequency_per_month: 'wie oft pro Monat / Woche dieser Schritt vorkommt',
  duration_minutes: 'wie lange eine einzelne Durchführung dieses Schritts dauert',
  error_rate_percent: 'wie häufig Fehler oder Korrekturen auftreten',
  media_breaks: 'ob es Medienbrüche zwischen Systemen gibt',
  // Tazite (qualitativ)
  entscheidungslogik: 'ob der Schritt festen Regeln folgt oder eigener Einschätzung Spielraum lässt — und welche Kriterien entscheiden',
  tazite_cues: 'was man aus Erfahrung wissen muss um diesen Schritt gut zu machen (implizites Wissen, Fingerspitzengefühl)',
  ausnahmen: 'welche Ausnahmen oder Sonderfälle auftreten und wie sie behandelt werden',
  inputs: 'welche Eingaben oder Voraussetzungen für diesen Schritt nötig sind',
  outputs: 'was dieser Schritt produziert oder weitergibt',
  hilfsmittel: 'welche Systeme, Tools oder Datenquellen dabei verwendet werden',
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

    // Fix 4 (ADR-015): mask raw slot values — show status only to prevent anchoring.
    function fmtPotenzial(sv: SlotValue | null, label: string): string {
      return `  ${label}: ${sv != null ? '✓ erfasst' : 'fehlt'}`
    }
    function fmtTazite(sv: TaziteSlot | TaziteSlotArray | null, label: string): string {
      if (sv == null) return `  ${label}: fehlt`
      const filled = sv.value != null || sv.nicht_befund_typ != null
      return `  ${label}: ${filled ? '✓ erfasst' : 'fehlt'}`
    }

    const potenzialLines = [
      fmtPotenzial(step.potenzial.frequency_per_month, 'frequency_per_month'),
      fmtPotenzial(step.potenzial.duration_minutes,    'duration_minutes   '),
      fmtPotenzial(step.potenzial.error_rate_percent,  'error_rate_percent '),
      fmtPotenzial(step.potenzial.media_breaks,        'media_breaks       '),
    ]
    const taziteLines = [
      fmtTazite(step.slots.entscheidungslogik, 'entscheidungslogik '),
      fmtTazite(step.slots.tazite_cues,        'tazite_cues        '),
      fmtTazite(step.slots.ausnahmen,          'ausnahmen          '),
      fmtTazite(step.slots.inputs,             'inputs             '),
      fmtTazite(step.slots.outputs,            'outputs            '),
      fmtTazite(step.slots.hilfsmittel,        'hilfsmittel        '),
    ]

    const govLine = step.governance != null
      ? `  governance: ${step.governance.rolle ?? step.governance.nicht_befund_typ ?? '✓ teilweise erfasst'}`
      : `  governance: fehlt`

    const depLine = (() => {
      const dep = step.abhaengigkeiten
      if (dep == null || (dep.depends_on.length === 0 && dep.influences.length === 0 && dep.nicht_befund_typ == null)) {
        return '  abhaengigkeiten: fehlt'
      }
      if (dep.depends_on.length === 0 && dep.influences.length === 0) {
        return `  abhaengigkeiten: nicht_befund: ${dep.nicht_befund_typ}`
      }
      const total = dep.depends_on.length + dep.influences.length
      return `  abhaengigkeiten: ✓ ${total} Kante(n) (depends_on: ${dep.depends_on.length}, influences: ${dep.influences.length})`
    })()

    const walkthrough: string[] = []
    if (step.process_steps?.length) walkthrough.push(`  process_steps: ${step.process_steps.join(' → ')}`)
    if (step.friction_points?.length) walkthrough.push(`  friction_points: ${step.friction_points.join(', ')}`)
    if (step.friction_tools?.length) walkthrough.push(`  friction_tools: ${step.friction_tools.join(', ')}`)
    if (step.pain_point_primary) walkthrough.push(`  pain_point_primary: "${step.pain_point_primary}"`)

    const idPrefix = step.id ? `${step.id} ` : ''
    return `[${step.status}] ${idPrefix}"${title}" (Schritt ${step.reihenfolge})\n${potenzialLines.join('\n')}\n${taziteLines.join('\n')}\n${govLine}\n${depLine}${walkthrough.length ? '\n' + walkthrough.join('\n') : ''}`
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
    }
  }
  return lines.join('\n')
}

// ─── Phase Methodology Sections ───────────────────────────────────────────────
// Iteration 1 (ADR-011 D7): Max. 5 Zeilen pro Phase, taktisches Briefing.
// Injected per-turn in buildDynamicContext so static prompt stays cacheable.

function buildPhaseMethodology(phase: Phase, hasExploringSteps = false): string {
  if (phase === 'intro') {
    return `## Methodik: intro
Erkläre kurz den Gesprächszweck (Prozesswissen dokumentieren, vertraulich behandelt) und stelle eine offene Einstiegsfrage.
Frage nach Hauptaufgaben und typischem Arbeitstag — Fokusthemen im ersten Turn nicht namentlich nennen.
Ton: wertschätzend, das Wissen des Mitarbeiters steht im Mittelpunkt.
Nach 1–2 Austauschen zur process_loop übergehen.`
  }

  if (phase === 'process_loop') {
    return `## Methodik: process_loop
Ziel: Einen konkreten Prozessschritt identifizieren und mit register_step registrieren.
Wenn ein Frequenz- oder Komplexitäts-Anker vorhanden ist, diesen Schritt wählen und mit einem Satz begründen.
Gibt es im Schritt-Tracker einen Schritt mit Status 'exploring' oder 'walkthrough'? Erst diesen vollständig abschließen.
Ausnahmen und Sonderfälle sind keine eigenständigen Prozesse — sie gehören als friction_point zu einem bestehenden Schritt.
Sobald ein Schritt vollständig erfasst ist (alle Pflicht-Slots gefüllt oder Persona gibt keine weiteren Details): aktiv nach weiteren wiederkehrenden Aufgaben fragen — z.B. 'Welche andere regelmäßige Aufgabe nimmt bei dir viel Zeit ein?' — NICHT erst in der wrap_up-Phase. Breite vor Tiefe: lieber 3 Prozesse mit guten Basics als 1 Prozess übertief.`
  }

  if (phase === 'walkthrough_step') {
    return `## Methodik: walkthrough_step
Ziel: Ablauf und Reibungspunkte erfassen — eine Frage pro Turn, vorwärts durch die Schritte.
Signalwörter ("zuerst", "dann", "danach", "als nächstes"): sofort update_walkthrough_data mit process_steps aufrufen.
Spontan genannte Werte (Häufigkeit, Dauer, Systeme): record_slot bzw. update_walkthrough_data aufrufen — keine direkten Slot-Fragen stellen.
Reibungspunkte und zugehörige Tools via update_walkthrough_data; Pain Points mit Ortsbezug via link_bottleneck.
Abschluss: wenn Ablauf natürlich endet oder alle Leitfragen gestellt wurden, zu slot_completion übergehen.
Turn-Budget: Nach 3 Walkthrough-Turns auf demselben Schritt zu slot_completion übergehen — Tiefe ist nicht das Ziel, Breite schon. Keine Detailfragen zu System-internen Abläufen (SAP-Transaktionscodes, Workflow-Details) — diese sind nicht slot-relevant.
Kontextregel: Beschreibt die aktuelle Mitarbeiter-Antwort mehrere Prozesse, record_slot NUR für den aktuell erkundeten Schritt aufrufen. Andere Prozesse nicht mit Slots befüllen — register_step + Erkundung im nächsten Turn.
Anker-Pflicht (E3.3): Jede Nachfrage referenziert ein Konzept, eine Aussage oder einen Schritt aus den letzten Turns des Mitarbeiters. Verneinungen ("nutzen wir kein SAP", "passiert nie") sind kein Anker — nicht erneut als Nachfrage-Grundlage nutzen.
Maieutik (E3.5): Keine inhaltlichen Vorschläge in Fragen ("Was wäre, wenn du Tool X hättest?", "Könnte man das automatisieren?"). Keine Leading-Questions ("Wäre das wie X?"). Frage offen — lass den Mitarbeiter die Antwort selbst entwickeln.
Ist-Fokus (E3.7): Keine Fragen die Verbesserungsideen oder Zukunftswünsche einladen ("Was würdest du ändern?", "Wenn du X optimieren könntest..."). Beschreibt der Mitarbeiter spontan eine Verbesserungsidee: Ist-Engpass dahinter vertiefen ("Was ist heute der Engpass, der das nötig macht?") — nicht weiter To-be vertiefen.`
  }

  if (phase === 'slot_completion') {
    return `## Methodik: slot_completion
Ziel: Verbleibende Pflichtslots nachfragen — Potenzial (frequency_per_month, duration_minutes) und tazite O2–O5 (entscheidungslogik, inputs, outputs, hilfsmittel).
Optional: error_rate_percent, media_breaks wenn Prozess fehlerträchtig oder systemintensiv wirkt.
Max. 2–3 fehlende Slots pro Turn — natürlicher Gesprächsfluss, kein Listenformat, keine Ankündigung.
Konfidenz-Regel: null → fehlend, nachfragen. estimate/unknown → unsicher belegt, kurze Bestätigung einholen (max. 1–2 Versuche pro Slot). confirmed oder nicht_befund_typ gesetzt → abgeschlossen, nicht erneut fragen.
entscheidungslogik: "Folgt dieser Prozess bei dir immer dem gleichen Schema, oder entscheidest du von Fall zu Fall?" Wenn unklar: NICHT nochmals fragen — Clarification Card erledigt das am Ende.
governance: record_governance aufrufen wenn Mitarbeiter Rolle oder OE nennt — auch fragmentarisch.
abhaengigkeiten: record_dependency aufrufen wenn Mitarbeiter nennt, welcher Schritt einen anderen voraussetzt oder beeinflusst.
Anker-Pflicht (E3.3): Slot-Fragen knüpfen an das an, was der Mitarbeiter bereits genannt hat. Verneinungen ("nutzen wir kein X") nicht als Anker einer Folgefrage nutzen.
Ist-Fokus (E3.7): Keine Verbesserungsfragen. Bei spontanen To-be-Nennungen: Ist-Engpass dahinter erfassen ("Was ist heute der Engpass, der das nötig macht?").`
  }

  if (phase === 'coverage_check') {
    return `## Methodik: coverage_check
Ziel: Fehlende Pflichtslots aller registrierten Schritte nachfüllen.
Natürlicher Gesprächsfluss — kein Übergangskommentar, kein "lass mich kurz prüfen".
Neu genannte Prozesse direkt aufnehmen und explorieren.`
  }

  if (phase === 'clarification') {
    if (hasExploringSteps) {
      // Pt8: Late-topic routing — exploring steps exist, no clarification cards.
      // Ask 1-2 targeted questions about the late-discovered topic, then wind down.
      return `## Methodik: clarification (late topic)
Ein neu genannter Prozessschritt wurde entdeckt. Stelle 1–2 gezielte Fragen dazu: Häufigkeit, Dauer, genutzte Systeme.
Kein vollständiger Walkthrough nötig — kurze direkte Fragen, max. 2 Turns.
Danach kurz verabschieden.`
    }
    return `## Methodik: clarification
Sage genau einmal: "Danke! Ich habe noch ein paar kurze Abschlussfragen für dich."
Stelle keine weiteren Fragen — die Abschlussfragen erscheinen im Interface.`
  }

  // wrap_up
  return `## Methodik: wrap_up
PFLICHT: Stelle als allererste Antwort in dieser Phase exakt diese Frage — keine Verabschiedung davor:
"Wenn du an deine letzte Arbeitswoche denkst — gibt es etwas Wiederkehrendes, das wir heute nicht erwähnt haben?"
Verabschiede dich NICHT ohne diese Frage gestellt zu haben.
Nach der Antwort:
- Neuer Prozess → register_step aufrufen, explorieren — kein Abschluss.
- Keine neuen Inhalte → kurz verabschieden.
Ist-Fokus (E3.7): Die abschließende Frage zielt auf noch nicht genannte Ist-Prozesse. Keine Verbesserungsideen oder Zukunftswünsche anfragen. Bei spontaner To-be-Nennung: Ist-Problem dahinter erfassen.`
}

// ─── Canonical Example (Iteration 1: 6 examples → 1) ─────────────────────────
const WALKTHROUGH_EXAMPLES = `
<EXAMPLE phase="walkthrough_step">
  USER: "Zuerst schaue ich in Salesforce ob der Kunde bekannt ist. Dann öffne ich meine Excel-Liste
         weil im Salesforce nicht alles drin ist. Danach prüfe ich den PDF-Katalog — ich weiß
         manchmal nicht welche Version aktuell ist. Und dann frage ich beim Innendienst nach
         den Konditionen. Das dauert manchmal einen halben Tag. Am Ende baue ich das Angebot in
         Salesforce zusammen und setze einen Reminder zum Nachfassen."
  AGENT: [ruft sofort update_walkthrough_data(
    step_title="Angebotserstellung",
    process_steps=["Salesforce-Check (Bestandskunde?)", "Excel-Liste prüfen", "PDF-Katalog prüfen", "Konditionen beim Innendienst anfragen", "Angebot in Salesforce aufbauen", "Nachfass-Reminder setzen"],
    friction_points=["PDF-Katalog: Version unklar", "Konditionen-Anfrage beim Innendienst dauert bis zu einen halben Tag"],
    friction_tools=["Salesforce", "Excel-Liste", "PDF-Katalog"]
  ) auf]
  AGENT TEXT: "Der Katalog-Versions-Aspekt klingt fehlerträchtig — passiert es, dass du mit veralteten Preisen arbeitest?"
  // update_walkthrough_data SOFORT wenn Mitarbeiter Ablauf beschreibt — alle Schritte in einem Call.
  // Keine Slot-Fragen (Frequenz, Dauer) während walkthrough_step.
</EXAMPLE>`

// ─── Dynamic Context Builder ──────────────────────────────────────────────────
// Called by interviewTalker.ts (Iteration 3) with the Analyst briefing, and by
// interviewAgent.createInterviewStream.

// Fix 4 (ADR-015): semantic masking — Talker sees ONLY status labels, not
// raw values. Prevents two failure modes observed in eval 2026-06-03:
//   1. Anchoring ("halten wir 100 Rechnungen pro Monat fest")
//   2. Self-calculation ("100 × 5min = 7.5 min average")
// Raw values stay in the Analyst context where they are needed for extraction.
function formatFilledSlotsSnapshot(steps: StepEntry[]): string {
  const lines: string[] = []
  for (const step of steps) {
    const filledLabels: string[] = []
    // Potenzial
    for (const [slot, sv] of Object.entries(step.potenzial) as [string, SlotValue | null][]) {
      if (sv !== null && sv.value !== null && sv.value !== undefined) filledLabels.push(slot)
    }
    // Tazite
    for (const [slot, sv] of Object.entries(step.slots) as [string, TaziteSlot | TaziteSlotArray | null][]) {
      if (sv != null && (sv.value != null || sv.nicht_befund_typ != null)) filledLabels.push(slot)
    }
    if (filledLabels.length > 0) {
      lines.push(`- "${sanitizeForPrompt(step.title)}": ${filledLabels.map(s => `${s} ✓`).join(', ')}`)
    }
  }
  return lines.join('\n')
}

export function buildDynamicContext(ctx: InterviewContext, briefing?: AnalystBriefing | null): string {
  const focusLine = ctx.focusTopics
    ? `Fokusthemen (NUR interne Steuerung — im Opener niemals namentlich nennen): ${ctx.focusTopics}`
    : 'Keine spezifischen Fokusthemen — führe eine offene Prozessexploration durch.'

  const warnAt = ctx.maxDurationMinutes - 5
  const hardAt = ctx.maxDurationMinutes

  const timingWarning =
    ctx.timerMinutes >= hardAt
      ? `\n⚠️ KRITISCH: ${hardAt} Minuten erreicht. Leite die Verabschiedung ein.`
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
    ? '\n## Coverage vollständig\nAlle Pflicht-Slots gefüllt. Wechsle direkt zu wrap_up.'
    : ctx.phase === 'slot_completion' && ctx.missingSlotsForCoverageCheck !== undefined
    ? '\n## Slot-Completion vollständig\nAlle bisher registrierten Schritte haben vollständige Pflicht-Slots. Zur nächsten Phase übergehen.'
    : ''

  // D1 — READ_ONLY_STATE: In walkthrough_step only show filled slots to avoid
  // Observable-Goal pull on empty fields. In all other phases show the full tracker.
  let stepTrackerSection: string
  if (ctx.phase === 'walkthrough_step') {
    const filledLines = ctx.stepTracker.flatMap((step) => {
      // Fix 4 (ADR-015): mask raw slot values — only show that the slot is filled.
      const filledPotenzial = (Object.entries(step.potenzial) as [string, SlotValue | null][])
        .filter(([, sv]) => sv !== null && sv.value !== null)
        .map(([name]) => `  ${name}: ✓ erfasst`)
      const filledTazite = (Object.entries(step.slots) as [string, TaziteSlot | TaziteSlotArray | null][])
        .filter(([, sv]) => sv != null && (sv.value != null || sv.nicht_befund_typ != null))
        .map(([name]) => `  ${name}: ✓ erfasst`)
      const filledSlots = [...filledPotenzial, ...filledTazite]
      if (filledSlots.length === 0 && !step.process_steps?.length && !step.friction_points?.length) return []
      const govNote = step.governance?.rolle ? ` (${sanitizeForPrompt(step.governance.rolle)})` : ''
      const header = `[${step.status}] "${sanitizeForPrompt(step.title)}"${govNote}`
      const walkLines: string[] = []
      if (step.process_steps?.length) walkLines.push(`  process_steps: ${step.process_steps.join(' → ')}`)
      if (step.friction_points?.length) walkLines.push(`  friction_points: ${step.friction_points.join(', ')}`)
      if (step.friction_tools?.length) walkLines.push(`  friction_tools: ${step.friction_tools.join(', ')}`)
      return [header, ...filledSlots, ...walkLines]
    })

    stepTrackerSection = filledLines.length > 0
      ? `\n<READ_ONLY_STATE>\nProtokoll bisher erfasster Daten — zur Orientierung, nicht zur Optimierung.\nDiese Felder beschreiben was bereits gesagt wurde. Leere Felder sind kein Gesprächsziel. Nicht auf Basis leerer Felder fragen.\n${filledLines.join('\n')}\n</READ_ONLY_STATE>`
      : ''

    // L1 — Slot-Target: Ein einzelner Pflicht-Slot wird gezielt erfragt.
    // Verhindert depth-first starvation (Talker fragt nach "wie genau" statt "wie lange").
    // Nur ein Slot pro Turn — minimiert observable-goal-pull auf andere Felder.
    const target = computeWalkthroughSlotTarget(ctx.stepTracker)
    if (target) {
      const hint = SLOT_PROMPT_HINT[target.slot]
      const isLowConf = target.reason === 'low_confidence'
      const targetLabel = isLowConf
        ? `Unsicher belegt (estimate/unknown): ${target.slot} — ${hint}. Kurze Bestätigung einholen, kein vollständiger Neu-Anlauf.`
        : `Noch fehlend: ${target.slot} — ${hint}.`
      stepTrackerSection += `\n\n## Slot-Target (PFLICHT — diesen Turn adressieren)\nAktiver Schritt: "${sanitizeForPrompt(target.step_title)}"\n${targetLabel}\nStelle in diesem Turn eine offene Frage die genau diesen Slot erfasst. Keine Zahlen-Vorgabe, kein Anker.`
    }
  } else {
    stepTrackerSection = `\n## Schritt-Tracker (aktueller Slot-Filling-Stand)\n${formatStepTracker(ctx.stepTracker)}`
  }

  // Few-shot examples only in walkthrough_step
  const fewShotSection = ctx.phase === 'walkthrough_step' ? WALKTHROUGH_EXAMPLES : ''

  // Phase methodology injected per-turn (not in static prompt)
  const hasExploringSteps = ctx.stepTracker.some(s => s.status === 'exploring')
  const methodologySection = `\n<methodology>\n${buildPhaseMethodology(ctx.phase, hasExploringSteps)}\n</methodology>`

  // E3.6 — Profile-adaptive framing: inject only when role is known
  const profileFraming = ctx.employeeRole
    ? `\n- Profil-Framing: Sprachtiefe und Fachbegriffe an "${ctx.employeeRole}" (${ctx.department}) anpassen. Fachfremde Rollen → alltagsnahe Sprache; Fach-/IT-Rollen → Domänen-Terminologie spiegeln.`
    : ''

  // Kompakter Lookup für bereits erfasste Slots — in allen Phasen außer walkthrough_step
  // (dort gibt es bereits den READ_ONLY_STATE Block).
  let alreadyKnownSection = ''
  if (ctx.phase !== 'walkthrough_step') {
    const snapshot = formatFilledSlotsSnapshot(ctx.stepTracker)
    if (snapshot.length > 0) {
      alreadyKnownSection = `\n## Bereits erfasste Werte (NICHT erneut fragen)\n${snapshot}`
    }
  }

  // Conversation signals — single entry point (PROJ-35 / ADR-017).
  const s = analyzeConversationSignals(ctx, briefing)

  // Analyst briefing section — advisory, not binding.
  // Talker may adapt the suggested question if it was already answered in the current turn.
  // Pt7: When suggested_question contains numeric values, inject an explicit no-anchor reminder
  // to prevent the Talker from re-quoting analyst-extracted numbers back to the user.
  const suggestedQ = briefing?.suggested_question ?? ''
  const anchorWarning = s.anchorNumbers.length > 0
    ? `\n⚠️ ANKER-SPERRE: Diese Zahlen stammen aus der Analyst-Extraktion — NICHT in einer Frage nennen: ${s.anchorNumbers.join(', ')}. Frage offen: "Wie oft?" / "Wie lange?" ohne Vorgabe.`
    : ''
  const briefingSection = briefing && (briefing.next_focus || briefing.suggested_question)
    ? `\n\n## NÄCHSTER TURN — Analyst-Empfehlung\nFokus: ${sanitizeForPrompt(briefing.next_focus ?? '—')}\nEmpfohlene Frage (anpassen wenn bereits beantwortet): "${sanitizeForPrompt(suggestedQ)}"${anchorWarning}`
    : ''

  // Filler avoidance: inject list of already-used opening phrases (Pt13)
  const recentFillers = ctx.usedFillerPhrases?.slice(-8) ?? []
  const fillerAvoidance = recentFillers.length > 0
    ? `\nVARIANZ-GEBOT: Diese Einstiegsphrasen wurden bereits genutzt — NICHT wiederholen: ${recentFillers.map(p => `"${p}"`).join(' | ')}`
    : ''

  // F1: Drill-Stop — break retry storms on unanswerable quant slots.
  const drillStopSection = s.drillWarnings.length > 0
    ? `\n\n## ⛔ DRILL-STOP (PFLICHT)\n${s.drillWarnings.map(w => `- ${w}`).join('\n')}`
    : ''

  // KI-15: same question-stem fired twice in a row reads as a form, not a conversation
  // (dialog_naturalness judge feedback, eval 2026-06-24/25/26: "repetitive Frage-Struktur").
  const questionStemSection = s.repeatedQuestionStem
    ? `\nVARIANZ-GEBOT: Frage-Einstieg "${s.repeatedQuestionStem}" wurde in den letzten 2 Turns bereits genutzt — diesen Turn anders einsteigen (z.B. konkretes Beispiel erfragen, Aussage aufgreifen, oder andere Frageform wählen statt erneut "${s.repeatedQuestionStem}...").`
    : ''

  // E3.1 — Ambiguity: conflicting factual statements (additive to drill-stop/missing-slot)
  const ambiguitySection = s.ambiguity
    ? `\n\n## ⚠️ AMBIGUITÄT-KLÄRUNG (PFLICHT — dieser Turn)\nWidersprüchliche Aussagen erkannt:\n- Früher: "${s.ambiguity.phraseA}"\n- Jetzt: "${s.ambiguity.phraseB}"\nSpreche beide Aussagen explizit an: "Du hast vorhin [A] erwähnt — jetzt sagst du [B]. Was ist der Unterschied?" Keine Lücken-Nachfrage in diesem Turn — Ambiguität hat Vorrang.`
    : ''

  // E3.2 — Exception: special-case mention → deepen before moving on
  const exceptionSection = s.exception
    ? `\n\n## ⚠️ AUSNAHME ERKANNT\nDer Mitarbeiter hat einen Sonderfall oder eine Ausnahme erwähnt. Vertiefe diesen mit einer gezielten Nachfrage bevor du weitergehst. Ausnahmen die eigenständige Schritte sind → register_step nach 1–2 Vertiefungsfragen.`
    : ''

  // E3.2 re-context cap: suppress re-contextualization when already used in last 3 turns
  const recontextCapSection = s.recentlyRecontextualized
    ? `\n\n## Re-Kontext-Sperre (E3.2)\nRe-Kontextualisierung wurde in den letzten Turns bereits eingesetzt — diesen Turn NICHT erneut re-kontextualisieren. Stelle stattdessen eine direkte thematische Nachfrage.`
    : ''

  // E3.4 — Laddering: blockade detection + two-turn drop rule
  const ladderiungSection = s.ladderingStreak >= 2
    ? `\n\n## ⛔ LADDERING-ABBRUCH (PFLICHT)\nNach ${s.ladderingStreak} aufeinanderfolgenden Blockade-Turns: Thema jetzt fallen lassen. Gehe direkt zum nächsten Aspekt oder Schritt über — keine weitere Nachfrage zu diesem Thema.`
    : s.blockade
    ? `\n\n## ⚠️ LADDERING — Frametechnik wechseln\nBlockade-Signal erkannt. Stelle KEINE strukturell identische Folgefrage. Wechsle Frametechnik:\n- Perspektivwechsel: "Wie würde ein Kollege das beschreiben?"\n- Beispiel-Einladung: "Kannst du ein konkretes Beispiel aus der letzten Woche nennen?"\n- Vereinfachende Reformulierung der Frage`
    : ''

  return `## Interview-Kontext
- Mitarbeiter: ${ctx.employeeName}${ctx.employeeRole ? `, ${ctx.employeeRole}` : ''}
- Abteilung: ${ctx.department}
- ${focusLine}
- Phase: ${ctx.phase}
- Verstrichene Zeit: ${ctx.timerMinutes} / ${ctx.maxDurationMinutes} Minuten${timingWarning}${shortModeHint}${profileFraming}

## Extrahierte Wissensobjekte
${formatExtractionsLog(ctx.extractionsLog)}${coverageCheckSection}${methodologySection}${stepTrackerSection}${alreadyKnownSection}${fewShotSection}${briefingSection}${fillerAvoidance}${questionStemSection}${drillStopSection}${ambiguitySection}${exceptionSection}${recontextCapSection}${ladderiungSection}`
}
