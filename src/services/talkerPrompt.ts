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
import type {
  Phase,
  SchemaSlotNumber,
  StepEntry,
  SchemaSlotString,
  SchemaSlotStringArray,
  PotenzialSlotName,
  OSlotField,
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
Schlage keine eigenen Zahlen vor — frage nach konkreten Werten des Mitarbeiters.
Verweise NIE auf Zahlen oder Werte als Persona-Zitate, wenn die Persona sie nicht wörtlich so genannt hat. Intern abgeleitete oder berechnete Werte (z.B. Minutenumrechnungen aus "2-3 Tage") dürfen nicht als Mitarbeiter-Aussage formuliert werden. Falsch: "Du hast vorhin 1200 Minuten erwähnt." Richtig: "Du hast von 2-3 Tagen gesprochen" oder neue Frage stellen.
Spannen NICHT mehr konkretisieren wenn Wert bereits erfasst ist (✓ im Tracker). Nur bei echtem null.
Ausweichen bei quantitativen Slots (frequency, duration, error_rate_percent), die noch offen sind — GENAU ZWEI Schritte, nie mehr, nie Forced-Choice:
1. Offene Frage ohne Zahlen (Standard-Fall). Nennt der Mitarbeiter keine Zahl — egal ob explizite Weigerung ("schwer zu sagen", "variiert stark"), qualitative Umschreibung ohne Zahl ("wenige Minuten", "deutlich mehr Zeit", "eine ganze Weile") oder kategorische Zahlen-Ablehnung ("Ich nenne grundsätzlich keine Zahlen"):
→ SOFORT zu Schritt 2 (Richtungsfrage) wechseln. KEINE zweite offene Umformulierung derselben Frage — das produziert das Drei-Wiederholungsmuster (Turns 4-6 buchhalter-Eval 2026-06-23: dieselbe offene Frage 3× umformuliert, Persona wich jedes Mal mit Adjektiven aus, kein Wert).
2. Richtungsfrage — fragt NUR nach grober Tendenz, nennt selbst KEINE Zahlen (z.B. "Ist das eher etwas, das oft vorkommt, oder eher selten?", "Geht das eher schnell oder zieht sich das eher?"). Zahlen-Verweigerung ist keine Richtungs-Verweigerung — diese Frage wird IMMER versucht, auch nach kategorischer Zahlen-Ablehnung.
→ Nennt der Mitarbeiter jetzt eine Tendenz (ohne Zahl): record_slot mit richtung (niedrig/hoch), kein value — normal weitergehen, keine Akzeptanz-Floskel nötig, das ist eine echte Antwort.
→ Weicht der Mitarbeiter auch hier aus: SOFORT akzeptieren und weitergehen. KEIN dritter Versuch, KEIN Forced-Choice ("Eher X oder eher Y") an keiner Stelle im Ablauf — die Präzisierung passiert später über eine Abschluss-Card, nicht live.
→ Akzeptanz-Phrase (nur nach beidseitigem Ausweichen, Schritt 1 UND 2) aus folgendem Pool wählen — und **JEDE NUR EINMAL pro Interview** verwenden, danach Avoidance-Liste konsultieren:
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
Dauer (duration) — Pro-Vorgang vs. Aggregat: Kläre bei der offenen Frage aktiv, ob eine genannte Zeit PRO EINZELNER DURCHFÜHRUNG oder als AGGREGAT über einen Zeitraum gemeint ist (z.B. "15 Std/Monat" vs. "10 Minuten pro Rechnung") — beides klingt wie eine Zahl, ist aber nicht dasselbe Feld. Bleibt das nach einer gezielten Nachfrage weiterhin uneindeutig: NICHT raten oder selbst umrechnen — Slot leer lassen, die Klärung passiert später über eine Abschluss-Card mit eindeutigerem Wortlaut.
FLOSKEL-VERBOT: Keine inhaltsleeren Bestätigungen vor der Frage. Verboten: 'Das klingt nach...', 'Das ist ein wichtiger...', 'Gut zu wissen', 'Verstehe', 'Das ist interessant', 'Das ist ein klassischer...'. Wenn du reagierst: spezifisch auf ein konkretes Detail aus der letzten Antwort — oder direkt die Frage ohne Vorsatz.
</turn_format>

<treiber_framing>
Zielt der Fokus (siehe "Ziel (bindend)" unten) auf reibungspunkte, ausloeser, aufgabentyp oder risiko_schwere: formuliere eine indirekte Ursachen-/Treiberfrage statt einer reinen Beschreibungsfrage — z.B. "Woran liegt es, dass...", "Was macht das an dieser Stelle...". NIE ein direktes "Warum...?" — wirkt im Deutschen leicht vorwurfsvoll.
Wurde bei duration oder error_rate_percent eines Schritts eine hohe Ausprägung erfasst ("Richtung erfasst (hoch)" im Schritt-Tracker — zieht sich lange / passiert oft Fehler) und reibungspunkte für denselben Schritt fehlt noch: nutze die nächste passende Gelegenheit für genau so eine Ursachenfrage dazu (z.B. "Woran liegt es, dass sich das zieht?") statt einer erneuten Zahlen-Nachfrage. Die Richtung selbst ist nur ein Priorisierungssignal — die Ursachenfrage liefert den eigentlichen inhaltlichen Ertrag.
</treiber_framing>

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

// Deutsche Slot-Label für Talker-Prompt — kurz, ohne Zahlen-Vorgabe.
// PROJ-45 (ADR-025 D3): tazite_cues hat keinen Eintrag mehr (kein target_o_field
// mehr, bleibt aber schreibbarer Slot). 4 neue Einträge für die AI-Wert-Faktoren.
const SLOT_PROMPT_HINT: Record<OSlotField | PotenzialSlotName, string> = {
  // Potenzial (quantitativ, opportunistisch — kein Talker-Ziel)
  frequency: 'wie oft pro Monat / Woche dieser Schritt vorkommt',
  duration: 'wie lange eine einzelne Durchführung dieses Schritts dauert',
  error_rate_percent: 'wie häufig Fehler oder Korrekturen auftreten',
  media_breaks: 'ob es Medienbrüche zwischen Systemen gibt',
  // O2–O6 (qualitativ — Ziel-O-Feld-Menge, PROJ-46/45)
  entscheidungslogik: 'ob der Schritt festen Regeln folgt oder eigener Einschätzung Spielraum lässt — und welche Kriterien entscheiden',
  ausnahmen: 'welche Ausnahmen oder Sonderfälle auftreten und wie sie behandelt werden — und ob der Normalfall sonst immer gleich abläuft oder stark variiert',
  inputs: 'welche Eingaben oder Voraussetzungen für diesen Schritt nötig sind — achte auf Hinweise ob die Dokumente/Daten einheitlich strukturiert oder frei sind',
  outputs: 'was dieser Schritt produziert oder weitergibt',
  hilfsmittel: 'welche Systeme, Tools oder Datenquellen dabei verwendet werden — achte auf Hinweise ob die Dokumente/Daten einheitlich strukturiert oder frei sind',
  abhaengigkeiten: 'welche anderen Schritte dieser Schritt voraussetzt oder beeinflusst',
  reibungspunkte: 'wo es in diesem Schritt hakt oder Zeit verloren geht',
  aufgabentyp: 'ob dieser Schritt vor allem eine Entscheidung, Informationsübertragung, Zusammenfassung, Suche, Klassifikation oder Erstellung/Generierung ist',
  risiko_schwere: 'wie schwerwiegend ein Fehler in diesem Schritt wäre (leicht korrigierbar, teuer, rechtlich kritisch, Kundenkontakt-relevant)',
  ausloeser: 'was diesen Schritt von außen anstößt (z.B. eine E-Mail, ein Termin, eine Anfrage)',
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
    if (step.teilschritte?.length) walkthrough.push(`  teilschritte: ${step.teilschritte.join(' → ')}`)

    // WP3 (2026-07-14 design round): for 'done' steps the full slot checklist is
    // dead weight — dependencies/classification fields are captured opportunistically
    // by the Analyst, never actively re-asked by the Talker, and <no_repeat> already
    // forbids re-asking a filled slot regardless. Keep only the conversational
    // context (teilschritte) that's still useful for follow-up questions about OTHER
    // steps. walkthrough/exploring steps keep the full checklist — there it's the
    // actual steering signal for open slots.
    if (step.status === 'done') {
      return `[${step.status}] ${idPrefix}"${title}" (Schritt ${step.reihenfolge}) — alle Pflichtslots erfasst${walkthrough.length ? '\n' + walkthrough.join('\n') : ''}`
    }

    // Fix 4 (ADR-015): mask raw slot values — show status only to prevent anchoring.
    // PROJ-43 (AC2/AC6): a captured richtung is not a raw value (no number, no
    // anchoring risk) — surfaced so the Talker can weight priority (AC2) and
    // trigger the Treiber-Framing follow-up (AC6) instead of showing as "fehlt".
    function fmtPotenzial(sv: SchemaSlotNumber | null, label: string): string {
      if (sv == null) return `  ${label}: fehlt`
      if (sv.value != null || sv.nicht_befund_typ != null) return `  ${label}: ✓ erfasst`
      if (sv.richtung) return `  ${label}: Richtung erfasst (${sv.richtung})`
      return `  ${label}: fehlt`
    }
    function fmtTazite(sv: SchemaSlotString | SchemaSlotStringArray | { value: unknown; nicht_befund_typ: unknown } | null, label: string): string {
      if (sv == null) return `  ${label}: fehlt`
      const filled = sv.value != null || sv.nicht_befund_typ != null
      return `  ${label}: ${filled ? '✓ erfasst' : 'fehlt'}`
    }

    const potenzialLines = [
      fmtPotenzial(step.potenzial.frequency, 'frequency'),
      fmtPotenzial(step.potenzial.duration,    'duration   '),
      fmtPotenzial(step.potenzial.error_rate_percent,  'error_rate_percent '),
      fmtPotenzial(step.potenzial.media_breaks,        'media_breaks       '),
    ]
    const taziteLines = [
      fmtTazite(step.slots.entscheidungslogik,    'entscheidungslogik   '),
      fmtTazite(step.slots.tazite_cues,           'tazite_cues          '),
      fmtTazite(step.slots.ausnahmen,             'ausnahmen            '),
      fmtTazite(step.slots.inputs,                'inputs               '),
      fmtTazite(step.slots.outputs,               'outputs              '),
      fmtTazite(step.slots.hilfsmittel,           'hilfsmittel          '),
      fmtTazite(step.slots.reibungspunkte,        'reibungspunkte       '),
      fmtTazite(step.slots.ausloeser,             'ausloeser            '),
      fmtTazite(step.slots.aufgabentyp,           'aufgabentyp          '),
      fmtTazite(step.slots.risiko_schwere,        'risiko_schwere       '),
    ]

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

    return `[${step.status}] ${idPrefix}"${title}" (Schritt ${step.reihenfolge})\n${potenzialLines.join('\n')}\n${taziteLines.join('\n')}\n${depLine}${walkthrough.length ? '\n' + walkthrough.join('\n') : ''}`
  }).join('\n\n')
}

// ─── Phase Methodology Sections ───────────────────────────────────────────────
// Iteration 1 (ADR-011 D7): Max. 5 Zeilen pro Phase, taktisches Briefing.
// Injected per-turn in buildDynamicContext so static prompt stays cacheable.

function buildPhaseMethodology(phase: Phase, isCompletionFarewell = false): string {
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
Vertiefung des aktiven Schritts (Status exploring/walkthrough): Ablauf und Reibungspunkte erfragen — eine Frage pro Turn. Verbleibende offene Punkte natürlich nachfragen — max. 2–3 pro Turn, kein Listenformat, keine Ankündigung. Keine Detailfragen zu System-internen Abläufen (SAP-Transaktionscodes, Workflow-Details) — nicht slot-relevant.
Kontextregel: Beschreibt die Antwort mehrere Prozesse, frage nur zum aktuell erkundeten Schritt weiter — ein neu genannter anderer Prozess wird automatisch im Hintergrund erfasst, die Erkundung dazu folgt in einem späteren Turn (siehe Ziel unten).

Anker-Option: Wenn es gesprächslogisch passt, darf die Nachfrage ein Konzept, eine Aussage oder einen Schritt aus den letzten Turns aufgreifen — ist aber nicht verpflichtet. Erfinde NIEMALS einen Anker, den es nicht gab. Verneinungen ("nutzen wir kein X", "passiert nie") sind kein Anker.
Maieutik: Keine inhaltlichen Vorschläge ("Was wäre, wenn du Tool X hättest?"), keine Leading-Questions ("Wäre das wie X?"). Frage offen.
Ist-Fokus: Keine Fragen die Verbesserungsideen oder Zukunftswünsche einladen. Bei spontaner To-be-Nennung: Ist-Engpass dahinter vertiefen ("Was ist heute der Engpass, der das nötig macht?").

Welcher Schritt und welches Themenfeld gerade dran sind, legt ausschließlich der Ziel-Block unten fest (bindend) — nicht diese Methodik. Auch wenn der aktive Schritt schon gut erfasst wirkt: beim Ziel-Schritt bleiben, bis der Ziel-Block unten etwas anderes vorgibt.`
  }

  if (phase === 'clarification') {
    // BUG-5 (PROJ-42 QA, 2026-07-16): this turn is the closing→clarification
    // transition (cards are pending) — previously a bare "hier sind
    // Abschlussfragen" announcement with no farewell anywhere in the
    // interview, violating the AC's "jede Beendigung läuft über eine
    // formulierte, kohärente Verabschiedung". Fold a real farewell into this
    // single Talker turn instead of a separate call — matches the AC order
    // (Verabschiedung → Cards → completed) without a second LLM round-trip.
    //
    // KI-36 (Praxistest Sayang 2026-07-24): this branch used to fork on
    // hasExploringSteps — a step never even walked through (e.g. bulk-
    // registered from a Turn-1 process enumeration the Fokus-Lock never
    // reached) triggered a "late topic" variant that asked 1–2 MORE open
    // questions before winding down. Cards are always computed/pinned in the
    // SAME turn this phase is entered (resolveTurnLifecycle), so that further
    // question was never answerable — the frontend swaps to the
    // clarification TransitionPrompt as soon as it sees phase==='clarification'
    // WITH cards (ChatInterface.tsx's checkCompleted), leaving whatever the
    // Talker just asked without a reply box. The clarification-entry turn now
    // unconditionally reads as a clean farewell — an unexplored step's gaps
    // go entirely through the clarification cards instead (PROJ-47/52
    // territory, not this Talker turn's job).
    return `## Methodik: clarification
Das inhaltliche Gespräch ist abgeschlossen. Verabschiede dich jetzt kurz und herzlich (z.B. Dank für die Zeit) UND weise im selben Antworttext darauf hin, dass gleich noch ein paar kurze Abschlussfragen im Interface erscheinen.
Stelle im Chat KEINE weitere Frage — die Abschlussfragen erscheinen im Interface, nicht im Chat.`
  }

  // closing
  // KI-19 (2026-07-11): the scripted completion/farewell call also passes phase='closing'
  // (runInterviewTurn.ts, after resolveTurnLifecycle already decided complete=true and DB
  // status is already 'completed') — without this branch it inherited the SAME unconditional
  // ask-a-discovery-question-first instruction below, which routinely beat the softer advisory
  // farewell guidance and made the model re-ask a question as its last visible message instead
  // of actually saying goodbye — confirmed on 36/82 historical gemini-3.1-flash-lite
  // transcripts (44%), not an OSS-model-specific issue.
  if (isCompletionFarewell) {
    return `## Methodik: closing (Abschluss)
Das Interview ist inhaltlich abgeschlossen — mehrere Turns ohne neue Information.
Verabschiede dich jetzt kurz und herzlich. Stelle KEINE weitere Frage. Deine Antwort besteht
ausschließlich aus der Verabschiedung.`
  }
  // PROJ-46 (ADR-023 D4/BUG-4): Closing ist Entdeckungs-Fortsetzung, kein einmaliges
  // Skript mehr — der statische CLOSING_PROBE_TEXT + die closing-PFLICHT-Sonde entfallen.
  return `## Methodik: closing (Entdeckung)
Stelle weiter natürlich anschließende, JEDES MAL FRISCH FORMULIERTE Fragen nach unentdeckten
wiederkehrenden Vorgängen oder Wissensobjekten — kein einmaliges Skript, keine wortgleiche
Wiederholung einer früheren Frage.
Neuer Prozess genannt → einfach dazu weiterfragen, die Erfassung passiert automatisch im Hintergrund.
Keine neuen Inhalte über mehrere Turns → das System schließt automatisch ab, sobald genug Turns
ohne neue Information vergangen sind — du musst das nicht ankündigen oder herbeiführen.
Ist-Fokus: Ziel sind noch nicht genannte Ist-Prozesse. Keine Verbesserungsideen oder
Zukunftswünsche anfragen. Bei spontaner To-be-Nennung: Ist-Problem dahinter erfassen.`
}

// ─── Ziel-Block (PROJ-46 / ADR-023 D1/D3) ─────────────────────────────────────
// The binding target the Talker's topic/O-field choice follows this turn — the
// only thing the Analyst→Talker bridge carries besides the raw step title.
// Replaces the old advisory "NÄCHSTER TURN — Analyst-Empfehlung" (next_focus/
// suggested_question) block: no formulated question crosses the bridge
// anymore, only structured Absicht. Wording stays entirely the Talker's own.

function buildZielBlock(ctx: InterviewContext, briefing?: AnalystBriefing | null): string {
  if (ctx.transitionReason === 'closing_entry') {
    return `\n\n## Ziel (bindend)\nÜbergang in die Entdeckungsphase — kein Schritt mehr gesperrt. Leite mit einem kurzen Übergangssatz ein und stelle eine offene Frage nach einem weiteren wiederkehrenden Vorgang, der noch nicht besprochen wurde.`
  }
  const focusStep = ctx.focusStepId ? ctx.stepTracker.find((s) => s.id === ctx.focusStepId) : undefined
  if (!focusStep) return ''
  const targetField = briefing?.target_o_field
  const hint = targetField ? SLOT_PROMPT_HINT[targetField] : null
  const transitionNote = ctx.transitionReason === 'step_switch'
    ? ' Der Fokus hat gerade gewechselt — leite mit einem kurzen Übergangssatz zum neuen Thema über, statt abrupt zu springen.'
    : ''
  return `\n\n## Ziel (bindend)\nAktiver Schritt: "${sanitizeForPrompt(focusStep.title)}"${hint ? `\nFokus: ${hint}` : ''}\nDer Ziel-Schritt/Ziel-Bereich ist bindend — formuliere die Frage selbst, im Kontext des bisherigen Gesprächs.${transitionNote}`
}

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
  // resolveTurnLifecycle already decided complete=true) needs nothing but a header + the
  // farewell methodology text — no step tracker, no briefing, no signal sections. Sending
  // the full dynamic block also created a live contradiction: ambiguitySection could demand
  // a PFLICHT follow-up question in the same turn the methodology said "KEINE weitere Frage"
  // (measured on interview 1f5d350d turn 31, 2026-07-11 batch). Short-circuiting here removes
  // both the token cost (~1562 → ~200-250) and the contradiction at once.
  if (ctx.isCompletionFarewell) {
    const farewellMethodology = `\n<methodology>\n${buildPhaseMethodology(ctx.phase, true)}\n</methodology>`
    return `## Interview-Kontext
- Mitarbeiter: ${ctx.employeeName}${ctx.employeeRole ? `, ${ctx.employeeRole}` : ''}
- Abteilung: ${ctx.department}
- Phase: ${ctx.phase}
- Verstrichene Zeit: ${ctx.timerMinutes} / ${ctx.maxDurationMinutes} Minuten${shortModeHint}
${farewellMethodology}`
  }

  // D1 — READ_ONLY_STATE: In explore only show filled slots to avoid
  // Observable-Goal pull on empty fields. In all other phases show the full tracker.
  let stepTrackerSection: string
  if (ctx.phase === 'explore') {
    const filledLines = ctx.stepTracker.flatMap((step) => {
      // Fix 4 (ADR-015): mask raw slot values — only show that the slot is filled.
      // PROJ-43 (AC2/AC6): a richtung-only entry surfaces too (no raw number, no
      // anchoring risk) — same reasoning as formatStepTracker's fmtPotenzial above.
      const filledPotenzial = (Object.entries(step.potenzial) as [string, SchemaSlotNumber | null][])
        .filter(([, sv]) => sv !== null && (sv.value !== null || sv.richtung != null))
        .map(([name, sv]) => sv!.value != null ? `  ${name}: ✓ erfasst` : `  ${name}: Richtung erfasst (${sv!.richtung})`)
      const filledTazite = (Object.entries(step.slots) as [string, SchemaSlotString | SchemaSlotStringArray | { value: unknown; nicht_befund_typ: unknown } | null][])
        .filter(([, sv]) => sv != null && (sv.value != null || sv.nicht_befund_typ != null))
        .map(([name]) => `  ${name}: ✓ erfasst`)
      const filledSlots = [...filledPotenzial, ...filledTazite]
      if (filledSlots.length === 0 && !step.teilschritte?.length) return []
      const header = `[${step.status}] "${sanitizeForPrompt(step.title)}"`
      const walkLines: string[] = []
      if (step.teilschritte?.length) walkLines.push(`  teilschritte: ${step.teilschritte.join(' → ')}`)
      return [header, ...filledSlots, ...walkLines]
    })

    stepTrackerSection = filledLines.length > 0
      ? `\n<READ_ONLY_STATE>\nProtokoll bisher erfasster Daten — zur Orientierung, nicht zur Optimierung.\nDiese Felder beschreiben was bereits gesagt wurde. Leere Felder sind kein Gesprächsziel. Nicht auf Basis leerer Felder fragen.\n${filledLines.join('\n')}\n</READ_ONLY_STATE>`
      : ''
  } else {
    stepTrackerSection = `\n## Schritt-Tracker (aktueller Slot-Filling-Stand)\n${formatStepTracker(ctx.stepTracker)}`
  }

  // Phase methodology injected per-turn (not in static prompt)
  const methodologySection = `\n<methodology>\n${buildPhaseMethodology(ctx.phase, ctx.isCompletionFarewell)}\n</methodology>`

  // E3.6 — Profile-adaptive framing: inject only when role is known
  const profileFraming = ctx.employeeRole
    ? `\n- Profil-Framing: Sprachtiefe und Fachbegriffe an "${ctx.employeeRole}" (${ctx.department}) anpassen. Fachfremde Rollen → alltagsnahe Sprache; Fach-/IT-Rollen → Domänen-Terminologie spiegeln.`
    : ''

  // PROJ-46 (ADR-023 D1/D3): the binding target — replaces the old advisory
  // "NÄCHSTER TURN — Analyst-Empfehlung" block (no formulated question crosses
  // the Analyst→Talker bridge anymore).
  const zielBlock = buildZielBlock(ctx, briefing)

  // Filler avoidance: inject list of already-used opening phrases (Pt13)
  const recentFillers = ctx.usedFillerPhrases?.slice(-8) ?? []
  const fillerAvoidance = recentFillers.length > 0
    ? `\nVARIANZ-GEBOT: Diese Einstiegsphrasen wurden bereits genutzt — NICHT wiederholen: ${recentFillers.map(p => `"${p}"`).join(' | ')}`
    : ''

  // Conversation signals — single remaining provisional detector (PROJ-46/ADR-023 D5).
  const s = analyzeConversationSignals(ctx.recentAssistantTurns)

  // KI-15: same question-stem fired twice in a row reads as a form, not a conversation
  // (dialog_naturalness judge feedback, eval 2026-06-24/25/26: "repetitive Frage-Struktur").
  const questionStemSection = s.repeatedQuestionStem
    ? `\nVARIANZ-GEBOT: Frage-Einstieg "${s.repeatedQuestionStem}" wurde in den letzten 2 Turns bereits genutzt — diesen Turn anders einsteigen (z.B. konkretes Beispiel erfragen, Aussage aufgreifen, oder andere Frageform wählen statt erneut "${s.repeatedQuestionStem}...").`
    : ''

  return `## Interview-Kontext
- Mitarbeiter: ${ctx.employeeName}${ctx.employeeRole ? `, ${ctx.employeeRole}` : ''}
- Abteilung: ${ctx.department}
- ${focusLine}
- Phase: ${ctx.phase}
- Verstrichene Zeit: ${ctx.timerMinutes} / ${ctx.maxDurationMinutes} Minuten${shortModeHint}${profileFraming}
${methodologySection}${stepTrackerSection}${zielBlock}${fillerAvoidance}${questionStemSection}`
}
