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
import { CLOSING_PROBE_TEXT } from './interviewOrchestrator'
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

// ─── Talker Static Prompt ─────────────────────────────────────────────────────
// Iteration 1 (ADR-011 D7). Single source of truth for conversation-behavior
// rules — interviewAgent.buildStaticPrompt() (Greeting/Reconnect) imports this
// and appends its own <tools> block (PROJ-37).
export const STATIC_PROMPT = `Du bist KI-Interviewer. Erhebe implizites Prozesswissen von Mitarbeitern strukturiert.
Führe das Gespräch auf Deutsch — sachlich, direkt, präzise.
Sprich den Mitarbeiter mit Du an.

Phasenmodell: intro → explore → closing

<turn_format>
Ab Turn 2: Maximal ein kurzer Reaktionssatz (optional), dann eine direkte Frage — sonst nichts.
Turn 1 (Opener): Kontext + offene Einstiegsfrage. NUR wenn history keine assistant-Nachricht enthält.
Wenn bereits eine Begrüßung in history vorhanden ist: KEIN erneutes "Hallo", KEIN erneutes Intro — direkt zur nächsten Frage.
Abschluss-Turn: kurze Verabschiedung.
Erkläre nie den Zweck von Fragen oder dass du etwas notierst. Nenne nie explizit dass du einen Schritt, Slot oder Wert "erfasst", "registrierst" oder "aufnimmst" — z.B. "Ich erfasse diesen Schritt als...", "Ich nehme das als Abschluss auf" oder ähnliche Formulierungen sind VERBOTEN.
Gib NIEMALS Tool-Namen, Funktions-/Parameter-Syntax oder eckige Klammern wie "[...]" als Teil deiner Antwort aus — auch nicht in der Form "[ruft X(...) auf]" oder ähnlich. Tool-Aufrufe sind ausschließlich strukturierte Calls, nie sichtbarer Text. Deine Antwort besteht NUR aus dem Reaktionssatz und der Frage — kein Klammer-Präfix, kein Pseudo-Code davor.
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
HARTE REGEL: Werte mit ✓ im Schritt-Tracker / READ_ONLY_STATE dürfen NICHT erneut erfragt werden.
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
    const idPrefix = step.id ? `${step.id} ` : ''

    const walkthrough: string[] = []
    if (step.process_steps?.length) walkthrough.push(`  process_steps: ${step.process_steps.join(' → ')}`)
    if (step.friction_points?.length) walkthrough.push(`  friction_points: ${step.friction_points.join(', ')}`)
    if (step.friction_tools?.length) walkthrough.push(`  friction_tools: ${step.friction_tools.join(', ')}`)
    if (step.pain_point_primary) walkthrough.push(`  pain_point_primary: "${step.pain_point_primary}"`)

    // WP3 (2026-07-14 design round): for 'done' steps the full 10-line slot checklist is
    // dead weight — governance/dependencies are captured opportunistically by the Analyst,
    // never actively re-asked by the Talker, and <no_repeat> already forbids re-asking a
    // filled slot regardless. Keep only the conversational context (process_steps/friction*)
    // that's still useful for follow-up questions about OTHER steps. walkthrough/exploring
    // steps keep the full checklist — there it's the actual steering signal for open slots.
    if (step.status === 'done') {
      return `[${step.status}] ${idPrefix}"${title}" (Schritt ${step.reihenfolge}) — alle Pflichtslots erfasst${walkthrough.length ? '\n' + walkthrough.join('\n') : ''}`
    }

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

    return `[${step.status}] ${idPrefix}"${title}" (Schritt ${step.reihenfolge})\n${potenzialLines.join('\n')}\n${taziteLines.join('\n')}\n${govLine}\n${depLine}${walkthrough.length ? '\n' + walkthrough.join('\n') : ''}`
  }).join('\n\n')
}

// ─── Phase Methodology Sections ───────────────────────────────────────────────
// Iteration 1 (ADR-011 D7): Max. 5 Zeilen pro Phase, taktisches Briefing.
// Injected per-turn in buildDynamicContext so static prompt stays cacheable.

function buildPhaseMethodology(phase: Phase, hasExploringSteps = false, isCompletionFarewell = false): string {
  if (phase === 'intro') {
    return `## Methodik: intro
Erkläre kurz den Gesprächszweck (Prozesswissen dokumentieren, vertraulich behandelt) und stelle eine offene Einstiegsfrage.
Frage nach Hauptaufgaben und typischem Arbeitstag — Fokusthemen im ersten Turn nicht namentlich nennen.
Ton: wertschätzend, das Wissen des Mitarbeiters steht im Mittelpunkt.
Nach 1–2 Austauschen zu explore übergehen.`
  }

  // PROJ-42: process_loop + walkthrough_step + slot_completion collapsed into
  // one phase — Entdeckung (neue Prozesse finden) und Vertiefung (aktiven
  // Schritt ausbauen) laufen nebeneinander statt in sequenziellen Blöcken.
  if (phase === 'explore') {
    return `## Methodik: explore
Zwei Aktivitäten laufen nebeneinander, nicht nacheinander: Entdeckung und Vertiefung.

Entdeckung: Gibt es einen weiteren wiederkehrenden Vorgang, der noch nicht registriert ist? Anker (Frequenz/Komplexität) vorhanden → diesen wählen, kurz begründen. Ist der aktive Schritt ausreichend erfasst (Ablauf, Treiber, Kontext — nicht zwingend jeder optionale Slot) → aktiv nach der nächsten wiederkehrenden Aufgabe fragen, z.B. "Welche andere regelmäßige Aufgabe nimmt bei dir viel Zeit ein?". Breite vor Tiefe: lieber mehrere Prozesse mit guten Basics als einer übertief. Ausnahmen/Sonderfälle sind kein eigener Prozess — friction_point am bestehenden Schritt.

Vertiefung (aktiver Schritt, Status exploring/walkthrough): Ablauf und Reibungspunkte erfassen — eine Frage pro Turn. Signalwörter ("zuerst", "dann", "danach", "als nächstes") → sofort update_walkthrough_data mit process_steps. Spontan genannte Werte (Häufigkeit, Dauer, Systeme) → record_slot bzw. update_walkthrough_data, keine direkten Slot-Fragen. Verbleibende Pflichtslots natürlich nachfragen — max. 2–3 pro Turn, kein Listenformat, keine Ankündigung. Konfidenz-Regel: null → fehlend, nachfragen. estimate/unknown → kurze Bestätigung (max. 1–2 Versuche), dann weiter. confirmed oder nicht_befund_typ gesetzt → abgeschlossen, nicht erneut fragen. governance: record_governance wenn Rolle/OE genannt wird. abhaengigkeiten: record_dependency wenn ein Schritt einen anderen voraussetzt oder beeinflusst. Keine Detailfragen zu System-internen Abläufen (SAP-Transaktionscodes, Workflow-Details) — nicht slot-relevant.
Kontextregel: Beschreibt die Antwort mehrere Prozesse, record_slot NUR für den aktuell erkundeten Schritt — andere Prozesse per register_step registrieren, Erkundung im nächsten Turn.

Anker-Pflicht (E3.3): Jede Nachfrage referenziert ein Konzept, eine Aussage oder einen Schritt aus den letzten Turns. Verneinungen ("nutzen wir kein X", "passiert nie") sind kein Anker.
Maieutik (E3.5): Keine inhaltlichen Vorschläge ("Was wäre, wenn du Tool X hättest?"), keine Leading-Questions ("Wäre das wie X?"). Frage offen.
Ist-Fokus (E3.7): Keine Fragen die Verbesserungsideen oder Zukunftswünsche einladen. Bei spontaner To-be-Nennung: Ist-Engpass dahinter vertiefen ("Was ist heute der Engpass, der das nötig macht?").`
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
    // BUG-5 (PROJ-42 QA, 2026-07-16): this turn is the closing→clarification
    // transition (cards are pending, no step still exploring) — previously a
    // bare "hier sind Abschlussfragen" announcement with no farewell anywhere
    // in the interview, violating the AC's "jede Beendigung läuft über eine
    // formulierte, kohärente Verabschiedung". Fold a real farewell into this
    // single Talker turn instead of a separate call — matches the AC order
    // (Verabschiedung → Cards → completed) without a second LLM round-trip.
    return `## Methodik: clarification
Das inhaltliche Gespräch ist abgeschlossen. Verabschiede dich jetzt kurz und herzlich (z.B. Dank für die Zeit) UND weise im selben Antworttext darauf hin, dass gleich noch ein paar kurze Abschlussfragen im Interface erscheinen.
Stelle im Chat KEINE weitere Frage — die Abschlussfragen erscheinen im Interface, nicht im Chat.`
  }

  // closing
  // KI-19 (2026-07-11): the scripted completion/farewell call also passes phase='closing'
  // (runInterviewTurn.ts, after checkLifecycle already decided shouldComplete=true and DB
  // status is already 'completed') — without this branch it inherited the SAME unconditional
  // PFLICHT-ask-the-closing-probe-first instruction below, which routinely beat the softer
  // advisory farewellBriefing.suggested_question ("Verabschiede dich kurz und herzlich") and
  // made the model re-ask the probe (or a new unrelated question) as its last visible
  // message instead of actually saying goodbye — confirmed on 36/82 historical
  // gemini-3.1-flash-lite transcripts (44%), not an OSS-model-specific issue.
  if (isCompletionFarewell) {
    return `## Methodik: closing (Abschluss)
Die Abschluss-Sonde wurde bereits gestellt und beantwortet — das Interview ist inhaltlich abgeschlossen.
Verabschiede dich jetzt kurz und herzlich. Stelle KEINE weitere Frage — auch nicht die Sonde
erneut und keine neue Anschlussfrage. Deine Antwort besteht ausschließlich aus der Verabschiedung.`
  }
  return `## Methodik: closing
PFLICHT: Stelle als allererste Antwort in dieser Phase exakt diese Frage — keine Verabschiedung davor:
"${CLOSING_PROBE_TEXT}"
Verabschiede dich NICHT ohne diese Frage gestellt zu haben.
Nach der Antwort:
- Neuer Prozess → register_step aufrufen, explorieren — kein Abschluss.
- Keine neuen Inhalte → kurz verabschieden.
Ist-Fokus (E3.7): Die abschließende Frage zielt auf noch nicht genannte Ist-Prozesse. Keine Verbesserungsideen oder Zukunftswünsche anfragen. Bei spontaner To-be-Nennung: Ist-Problem dahinter erfassen.`
}

// ─── Canonical Example (Iteration 1: 6 examples → 1) ─────────────────────────
// KI-20 (2026-07-11): dieses Beispiel zeigte zuvor die Tool-Signatur als Klammer-
// Pseudo-Code ("AGENT: [ruft update_walkthrough_data(...) auf]") — Modelle über
// mehrere Vendor-Grenzen hinweg (Google, MiniMax) ahmten diese Notation gelegentlich
// wörtlich als sichtbaren Antworttext nach statt einen strukturierten Tool-Call zu
// machen (in 11 von 14 betroffenen historischen Transkripten war es sogar die
// Demo-Baseline gemini-3.1-flash-lite, nicht nur OSS-Modelle). Gleiche Fehlerklasse
// wie KI-16 (Quote-Artefakt aus einem illustrativen Prompt-Beispiel). Fix: keine
// Klammer/Parameter-Syntax mehr im Beispieltext — nur Prosa-Beschreibung, klar als
// "lautlos, nie als Text" markiert.
const WALKTHROUGH_EXAMPLES = `
<EXAMPLE phase="explore">
  USER: "Zuerst schaue ich in Salesforce ob der Kunde bekannt ist. Dann öffne ich meine Excel-Liste
         weil im Salesforce nicht alles drin ist. Danach prüfe ich den PDF-Katalog — ich weiß
         manchmal nicht welche Version aktuell ist. Und dann frage ich beim Innendienst nach
         den Konditionen. Das dauert manchmal einen halben Tag. Am Ende baue ich das Angebot in
         Salesforce zusammen und setze einen Reminder zum Nachfassen."
  INTERNER TOOL-CALL (lautlos, NIEMALS als Text ausgeben): update_walkthrough_data aufrufen mit
    Schritt-Titel Angebotserstellung; Ablauf-Schritten Salesforce-Check (Bestandskunde?), Excel-Liste
    prüfen, PDF-Katalog prüfen, Konditionen beim Innendienst anfragen, Angebot in Salesforce aufbauen,
    Nachfass-Reminder setzen; Reibungspunkten PDF-Katalog Version unklar und Konditionen-Anfrage beim
    Innendienst dauert bis zu einen halben Tag; genutzten Systemen Salesforce, Excel-Liste, PDF-Katalog.
  EINZIGE SICHTBARE ANTWORT: "Der Katalog-Versions-Aspekt klingt fehlerträchtig — passiert es, dass du mit veralteten Preisen arbeitest?"
  // update_walkthrough_data SOFORT wenn Mitarbeiter Ablauf beschreibt — alle Schritte in einem Call.
  // Der Tool-Call selbst erscheint NIE im sichtbaren Antworttext — nur die Frage danach ist die Antwort.
  // Keine Slot-Fragen (Frequenz, Dauer) während der Ablauf-Vertiefung.
</EXAMPLE>`

// ─── Dynamic Context Builder ──────────────────────────────────────────────────
// Called by interviewTalker.ts (createTalkerStream) with the Analyst briefing —
// the only remaining Talker entry point (PROJ-44: interviewAgent.ts's legacy
// createInterviewStream call site was deleted, ADR-021 D6).

export function buildDynamicContext(ctx: InterviewContext, briefing?: AnalystBriefing | null): string {
  const focusLine = ctx.focusTopics
    ? `Fokusthemen (NUR interne Steuerung — im Opener niemals namentlich nennen): ${ctx.focusTopics}`
    : 'Keine spezifischen Fokusthemen — führe eine offene Prozessexploration durch.'

  const shortModeHint =
    ctx.maxDurationMinutes <= 10
      ? '\n- Kurzmodus aktiv: Halte Übergänge zwischen Phasen kurz und komm zügig zum Abschluss.'
      : ''

  // WP1 (2026-07-14): the scripted completion/farewell call (runInterviewTurn.ts, after
  // checkLifecycle already decided shouldComplete=true) needs nothing but a header + the
  // farewell methodology text — no step tracker, no briefing, no signal sections. Sending
  // the full dynamic block also created a live contradiction: ambiguitySection could demand
  // a PFLICHT follow-up question in the same turn the methodology said "KEINE weitere Frage"
  // (measured on interview 1f5d350d turn 31, 2026-07-11 batch). Short-circuiting here removes
  // both the token cost (~1562 → ~200-250) and the contradiction at once.
  if (ctx.isCompletionFarewell) {
    const farewellMethodology = `\n<methodology>\n${buildPhaseMethodology(ctx.phase, false, true)}\n</methodology>`
    return `## Interview-Kontext
- Mitarbeiter: ${ctx.employeeName}${ctx.employeeRole ? `, ${ctx.employeeRole}` : ''}
- Abteilung: ${ctx.department}
- Phase: ${ctx.phase}
- Verstrichene Zeit: ${ctx.timerMinutes} / ${ctx.maxDurationMinutes} Minuten${shortModeHint}
${farewellMethodology}`
  }

  const coverageCheckSection = ctx.phase === 'closing' && ctx.missingSlotsForCoverageCheck && ctx.missingSlotsForCoverageCheck.length > 0
    ? `\n## Fehlende Pflicht-Slots (${ctx.phase})\n${ctx.missingSlotsForCoverageCheck.map(m => `- Schritt "${m.step_title}" → ${m.slot}`).join('\n')}\nFrage diese Werte gezielt und natürlich nach, falls im Gespräch noch Raum dafür ist.`
    : ctx.phase === 'closing' && ctx.missingSlotsForCoverageCheck !== undefined
    ? '\n## Coverage vollständig\nAlle Pflicht-Slots gefüllt.'
    : ''

  // D1 — READ_ONLY_STATE: In explore only show filled slots to avoid
  // Observable-Goal pull on empty fields. In all other phases show the full tracker.
  let stepTrackerSection: string
  if (ctx.phase === 'explore') {
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

  // Few-shot examples only in explore
  const fewShotSection = ctx.phase === 'explore' ? WALKTHROUGH_EXAMPLES : ''

  // Phase methodology injected per-turn (not in static prompt)
  const hasExploringSteps = ctx.stepTracker.some(s => s.status === 'exploring')
  const methodologySection = `\n<methodology>\n${buildPhaseMethodology(ctx.phase, hasExploringSteps, ctx.isCompletionFarewell)}\n</methodology>`

  // E3.6 — Profile-adaptive framing: inject only when role is known
  const profileFraming = ctx.employeeRole
    ? `\n- Profil-Framing: Sprachtiefe und Fachbegriffe an "${ctx.employeeRole}" (${ctx.department}) anpassen. Fachfremde Rollen → alltagsnahe Sprache; Fach-/IT-Rollen → Domänen-Terminologie spiegeln.`
    : ''

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
- Verstrichene Zeit: ${ctx.timerMinutes} / ${ctx.maxDurationMinutes} Minuten${shortModeHint}${profileFraming}
${coverageCheckSection}${methodologySection}${stepTrackerSection}${fewShotSection}${briefingSection}${fillerAvoidance}${questionStemSection}${drillStopSection}${ambiguitySection}${exceptionSection}${recontextCapSection}${ladderiungSection}`
}
