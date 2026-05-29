# ADR-011: Dual-Loop Architektur für Interview Engine — Talker, Analyst, Orchestrator

**Status:** Accepted (2026-05-29)
**Author:** lyas53
**Repository:** Roly-Bach/meridian-app
**Auslöser:** Beobachtung schlechter Interview-Qualität bei `gemini-3.5-flash` trotz fähigeren Modells. Research-Bericht `docs/Prompting-Strategien_für_deutsche_Multi-Turn-Agenten.md` (KI-generierter Bericht, Quellen verifiziert).
**Ergänzt:** ADR-007 (Prompt-Strukturreform), ADR-008 (Prozessablauf + Slot-Konfidenz), ADR-009 (Kontext-Architektur + Observable State), ADR-010 (Gemini-Strategie). Ersetzt sie nicht; baut auf der bestehenden D2-Trennung (statisch/dynamisch) auf.

---

## Context

Der Interview-Agent operiert aktuell als monolithischer Single-Call pro Turn. Ein einziger LLM-Call erfüllt simultan vier Aufgaben:

1. **Konversationelle Antwort** (natürlicher Ton, Empathie, Direktheit gegenüber Mitarbeiter).
2. **Wissens-Extraktion** (Tool-Calls `register_step`, `record_slot`, `update_walkthrough_data`, `link_bottleneck`).
3. **Phasen-Management** (Tool-Calls `transition_phase`, `enter_coverage_check`, `complete_interview`).
4. **Tracker-Konsultation und Coverage-Planung** (welche Slots fehlen, welche Fokusthemen offen sind).

Diese Bündelung erzeugt drei konkrete Probleme:

**Problem 1: Cognitive Overload bei fähigen Modellen.** Der Eval-Lauf vom 2026-05-28 mit `gemini-3.5-flash` zeigt schlechtere Konversations- und Tool-Use-Qualität als mit dem schwächeren `gemini-3.1-flash-lite`. Das ist konsistent mit der Forschungslage zu Over-Specification (Tang et al. 2025, "The Few-shot Dilemma", arXiv 2509.13196; Steve Kinney 2025 zu Prompt-Engineering across providers). Frontier-Modelle reagieren empfindlich auf dichte Negativ-Constraints und detaillierte Phasen-Vorschriften, weil ihre Attention auf die Constraint-Erfüllung gelenkt wird statt auf den semantischen Kern der Nutzerantwort.

**Problem 2: Latenz-Konflikt zwischen Tiefe und Reaktivität.** Konversationelle Natürlichkeit verlangt niedrige First-Token-Latenz (< 2s für Text, perspektivisch < 800ms für Voice). Sorgfältige Tracker-Pflege, Tool-Auswahl und Phasen-Planung verlangen tieferes Reasoning. Beide Anforderungen in einem Call vereint führen zu Kompromissen in beiden Dimensionen.

**Problem 3: Phasen-Logik im LLM ist fragil.** Übergangsbedingungen sind in der Phase-Methodologie als Prosa formuliert ("Wenn record_slot { step_complete: true } zurückgibt → ..."). Der Server berechnet `missingSlotsForCoverageCheck` bereits, aber die Entscheidung über den tatsächlichen Phasenwechsel trifft das LLM via `transition_phase`. Das ist nicht testbar, nicht deterministisch, und versagt unter Druck.

**Forschungslage zur Lösung:** Die Trennung in einen schnellen konversationellen Loop und einen tieferen analytischen Loop ist als "Dual-System"- oder "Fast/Slow-Thinking"-Architektur etabliert. Anthropic, Google und OpenAI empfehlen für komplexe Agenten konsequent die Auslagerung von State-Management aus dem Prompt in den Orchestrator. Native Reasoning-Steuerung über API-Parameter (`thinking_level` bei Gemini 3.x, `reasoning_effort` bei OpenAI, Extended Thinking bei Anthropic) ersetzt textuelle Chain-of-Thought-Anweisungen.

---

## Decisions

### D1 — Dual-Loop-Architektur als Grundprinzip

Der Interview-Turn wird in drei Komponenten zerlegt mit klaren Verantwortlichkeiten:

| Komponente | Rolle | Sync/Async | Modell |
|---|---|---|---|
| **Talker** | Konversationelle Antwort generieren | Synchron, streamt sofort | Schnelles Modell (siehe D9) |
| **Analyst** | Wissen extrahieren, Tracker pflegen, nächstes Briefing planen | Asynchron im Hintergrund | Fähigeres Modell mit Reasoning |
| **Orchestrator** | Phase und Lifecycle deterministisch entscheiden, Briefing cachen | Synchron zwischen Turns | Code, kein LLM |

Talker erzeugt ausschließlich Text. Analyst ruft ausschließlich Tools. Orchestrator ist deterministisch und testbar.

Begründung: Trennung der Verantwortlichkeiten löst alle drei Kontext-Probleme gleichzeitig. Talker-Prompt schrumpft drastisch (Ziel < 500 Token dynamisch), Analyst kann unter voller Kontext-Auslastung tief analysieren, Phasen-Logik wird deterministisch.

### D2 — Realisierung als Pipelined V1 mit Briefing-Cache

Der Analyst plant das Briefing für den *nächsten* Talker-Turn. Talker konsumiert ein vom vorherigen Analyst-Lauf vorbereitetes Briefing. Erste User-Antwort (Turn 1) hat noch kein Analyst-Briefing; Talker startet mit Phase-Default-Briefing.

Ablauf pro Turn N:

```
USER submits Turn N
  ├─► Talker startet sofort (synchron)
  │     ↳ liest cached briefing-for-turn-N (gen. durch Analyst von Turn N-1)
  │     ↳ streamt Antwort an Client (Ziel: First-Token < 2s)
  │
  └─► Analyst startet parallel (asynchron via waitUntil)
        ↳ voller Kontext + Tracker + User-Turn + Talker-Output
        ↳ ruft Wissens-Tools (Tracker-Updates)
        ↳ produziert structured output: briefing_for_turn_(N+1)
        ↳ schreibt next_briefing + analyst_status='done' in interview_state

ORCHESTRATOR
  ↳ läuft beim Eingang von Turn N+1
  ↳ liest analyst_status, validiert: ist briefing aktuell?
  ↳ berechnet Phase deterministisch (siehe D4)
  ↳ konstruiert finales Briefing für Talker (analyst-vorschlag + state-regeln)
```

Alternativen V2 (Speculative Parallel Merge mit Stream-Korrektur) und V3 (Sequential mit Verstehen-Buffer) wurden verworfen: V2 ist forschungsnah und kaum debuggbar, V3 zerstört Voice-Tauglichkeit. V1 ist die einzige produktionsreife Variante.

**Talker-Input-Komposition (Klärung zu Briefing-Lag):**

Der Talker bekommt pro Turn drei Eingabe-Schichten in einem einzigen Prompt. Wichtig: das Briefing *ersetzt* nicht die User-Antwort, sondern existiert *neben* dem Dialog-Verlauf. Der Talker sieht beides und muss beides berücksichtigen.

```
System-Prompt (invariant, cacheable):
  Persona, Tonalität, Format-Regeln, ein Canonical Example.

User-Turn (pro Aufruf neu komponiert):
  ## Briefing (Planungs-Schicht vom letzten Analyst-Lauf)
  Ziel: {tactical_goal}
  Geplante nächste Frage: {suggested_question}
  {context_note (optional, max 1 Satz)}

  ## Dialog-Verlauf
  [letzte 3-5 Turns inkl. Agent-Antwort]

  ## Aktueller Beitrag des Mitarbeiters
  {userInput verbatim}

  ## Aufgabe
  1. Reagiere kurz und natürlich auf den aktuellen Beitrag.
  2. Wenn der Beitrag das Ziel bereits beantwortet hat, akzeptiere das
     und führe mit einer Folgefrage natürlich weiter.
  3. Andernfalls: stelle die geplante nächste Frage.
```

**Briefing-Schema (vom Analyst produziert):**

```ts
type Briefing = {
  tactical_goal: string             // "Erfasse Dauer pro Rechnung"
  target_slot: SlotName | null      // optional, für semantische Übereinstimmung
  suggested_question: string        // "Wie lange sitzt du im Schnitt an einer Rechnung?"
  context_note: string | null       // optional, max 1 Satz Hinweis
  wrap_up_question_asked: boolean   // für D12 Soft-Confirm-Completion
}
```

**Drei Drift-Szenarien und ihre Schutzmechanismen:**

| Szenario | Mechanismus |
|---|---|
| User füllt den im Briefing geplanten Slot proaktiv | Talker-Regel 2 plus `target_slot`-Feld zur semantischen Übereinstimmung |
| User wechselt das Thema | Briefing ist Plan, nicht Zwang. Talker folgt dem Gesprächspartner, Analyst registriert Switch im nächsten Lauf |
| Briefing ist eine Iteration alt (Catch-up-Fall) | Orchestrator tauscht stale Briefing gegen **Phase-Default-Briefing**. Talker verlässt sich auf Dialog-Verlauf und sein Sprachverständnis |

Garantie: Im schlechtesten Fall (Briefing komplett unbrauchbar) operiert der Talker als gewöhnlicher Chat-Agent über dem Dialog-Verlauf. Das ist immer mindestens so gut wie der heutige Single-Call-Stand, weil das Briefing additiv ist und niemals den Dialog-Verlauf maskiert.

### D3 — Tool-Migration: Strikte Boundaries pro Komponente

Aktuelle Tool-Verteilung ([src/services/interviewAgent.ts:497-848](../../src/services/interviewAgent.ts#L497-L848)) wird umgebaut:

| Tool | Heute (Talker) | Zukünftig | Begründung |
|---|---|---|---|
| `register_step` | Talker | Analyst | Semantische Dedup-Logik braucht voller Kontext |
| `record_slot` | Talker | Analyst | Evidence-Quote-Validierung braucht Turn-Volltext |
| `update_walkthrough_data` | Talker | Analyst | Schritt-Klassifikation braucht Tracker-State |
| `link_bottleneck` | Talker | Analyst | Pain-Point-Inferenz braucht volle Konversation |
| `update_topics` | Talker | Analyst | Coverage-Bookkeeping ist analytisch |
| `transition_phase` | Talker | Entfällt (Orchestrator) | Deterministische Regel statt LLM-Vorschlag |
| `enter_coverage_check` | Talker | Entfällt (Orchestrator) | Reine State-Transition |
| `complete_interview` | Talker | Entfällt (Orchestrator) | Timer + Phase + Bestätigungs-Heuristik |
| **NEU** `produce_briefing` | — | Analyst (strukturiertes Output via responseSchema) | Strukturierte Übergabe an nächsten Talker-Turn |

Konsequenz: Talker hat **null Tools**. Sein Interface ist Text-in, Text-out. Damit verschwindet die ganze Klasse von Tool-Use-Reasoning-Problemen vom kritischen Pfad.

### D4 — Orchestrator besitzt Phase und Lifecycle

Die Phase-Übergangslogik wandert vollständig in `src/services/interviewOrchestrator.ts` (neu). Skelett:

```ts
function decideNextPhase(ctx: InterviewContext, analystSuggestion: Phase | null): Phase {
  if (ctx.timerMinutes >= ctx.maxDurationMinutes) return 'wrap_up'
  switch (ctx.phase) {
    case 'intro':
      return ctx.history.length >= 4 ? 'process_loop' : 'intro'
    case 'process_loop':
      return hasStepInStatus(ctx, 'exploring') ? 'walkthrough_step' : 'process_loop'
    case 'walkthrough_step':
      return walkthroughComplete(ctx) ? 'slot_completion' : 'walkthrough_step'
    case 'slot_completion':
      if (!currentStepDone(ctx)) return 'slot_completion'
      return hasUnexploredFocusTopic(ctx) ? 'process_loop' : 'coverage_check'
    case 'coverage_check':
      return allMandatorySlotsFilled(ctx) ? 'wrap_up' : 'coverage_check'
    case 'wrap_up':
      return completionConfirmed(ctx) ? 'completed' : 'wrap_up'
  }
}
```

Lifecycle (`complete_interview`-Äquivalent):
- Orchestrator setzt `status='completed'` und `extractions_pending=true` wenn:
  - Timer ≥ `maxDurationMinutes` (Hard-Stop), oder
  - Phase = `wrap_up` UND Analyst hat im letzten Briefing `wrap_up_question_asked=true` markiert UND User hat im aktuellen Turn geantwortet (eine Turn-Antwort nach gestellter Abschlussfrage zählt als Bestätigung).
- Talker bekommt im finalen Briefing den Hinweis "Verabschiede dich kurz". Keine Tool-Calls nötig.

Der Analyst kann eine Phase nur *vorschlagen*. Der Orchestrator validiert gegen Regeln. Bei Konflikt gewinnt der Orchestrator.

### D5 — Asynchrone Ausführung via `waitUntil()` auf Vercel Fluid Compute

Ein einziger Endpoint `POST /api/interview/turn`:

```
1. Request reinkommen, User-Turn in DB persistieren
2. Orchestrator: Phase berechnen, Briefing aus DB lesen oder Default
3. Talker-Stream starten (streamt sofort zurück an Client)
4. waitUntil(runAnalyst(turnPayload, state))
   ↳ Hintergrund-Job läuft solange Function-Instanz lebt (Fluid Compute)
5. Talker-Stream endet, Response für Client komplett
6. Analyst läuft weiter, schreibt next_briefing + analyst_status in DB
```

Fehlerstrategie: Wenn `runAnalyst` throws, schreibt der Wrapper `analyst_status='failed'` mit Fehler-Snapshot. Der nächste Turn-Handler erkennt das und triggert Catch-up: Analyst verarbeitet dann zwei Turns auf einmal. So bleibt das System selbstheilend ohne externe Queue.

Migration zu Vercel Queues oder Inngest ist möglich, sobald Failures häufig genug sind, um Retries zu erfordern. Das Analyst-Interface bleibt in beiden Fällen identisch (in: turn payload + state; out: tool-call-Sequenz + briefing).

### D6 — Provider-Compiler-Layer als Architektur-Skelett

Basis-Protokoll bleibt provider-neutral und in Deutsch. Pro Provider existiert ein Compiler in `src/services/providers/`, der Persona, Briefing, und Tool-Schema in den Provider-Dialekt übersetzt.

| Aspekt | Gemini-Compiler | Anthropic-Compiler | OpenAI-Compiler |
|---|---|---|---|
| Prompt-Struktur | Klare Sektionen, Instructions vor Daten | XML-Tags `<persona>`, `<rules>`, `<example>` | Markdown-Headings |
| Tool-Schema | OpenAPI-kompatibel, strict | JSON in `tools` + Erklärung in System-XML | JSON-Schema mit `strict: true` |
| Reasoning-Steuerung | `thinking_level` (low für Talker, medium für Analyst) | Extended Thinking (Analyst only) | `reasoning_effort` |
| Format-Beispiel | Ein Canonical Example am Daten-Ende | `<example>` Tag mit einem Beispiel | Ein Beispiel im System-Prompt |

Initial wird nur Gemini-Compiler implementiert. Anthropic- und OpenAI-Compiler sind als Interface vorgesehen, Implementierung folgt sobald A/B-Tests in PROJ-21 dies rechtfertigen.

Die heutige `resolveModel`-Funktion in `src/lib/llm-provider.ts` wird um eine Compiler-Auswahl erweitert: Modell-String entscheidet, welcher Compiler aktiviert wird.

### D7 — Prompt-Refactor: Negative Constraints entfernen, Phase-Briefing taktisch verschlanken

Auf Talker-Seite gilt:

- **Negative Constraints raus.** Alle `Falsch: … Richtig: …` Blöcke entfernen. Alle `NIEMALS`, `VERBOTEN`, `PFLICHT` durch positive Formulierungen ersetzen. Begründung: Forschung belegt, dass negative Constraints bei fähigen Modellen das verbotene Verhalten verstärken (Attention rückt zum vermiedenen Inhalt). Anti-Anchoring-Block und Silence-Constraints ersatzlos streichen.
- **Phase-Methodologie taktisch.** Heutige Methodologie pro Phase (~150-300 Token) reduziert sich auf 3-5 Zeilen taktisches Briefing: aktuelles Ziel, nächste empfohlene Frage (aus Analyst-Briefing), optional ein Empfindlichkeits-Hinweis. Keine Übergangsregeln, keine Tool-Reminder, keine Anti-Patterns.
- **Few-Shots: ein Canonical Example.** Statt sechs Walkthrough-Beispiele wird ein einziges format-anchorndes Beispiel im Talker-Prompt belassen. Inhaltliche Dialogbeispiele sind toxisch (linguistisches Anchoring).

Auf Analyst-Seite gilt:

- **Reasoning erlaubt und gewünscht.** Analyst-Prompt darf strukturierte Anweisungen enthalten (was zu extrahieren, was zu validieren). Negativ-Constraints sind hier weniger schädlich, weil der Analyst keinen User-facing Output erzeugt und keine Tonalitäts-Constraints einhalten muss.
- **Tracker-State im Analyst sichtbar.** Der Analyst sieht den vollen Tracker als Input. Das `READ_ONLY_STATE`-Framing aus ADR-009 D1 entfällt im Analyst-Kontext, weil der Analyst genau soll: leere Felder identifizieren und planen, wie sie zu füllen sind.

### D8 — Native Reasoning-Steuerung statt textueller Chain-of-Thought

Im Talker-Prompt entfallen alle textuellen Reasoning-Anweisungen ("Denke nach, bevor du antwortest", impliziter CoT durch lange Methodologie-Blöcke). Reasoning wird ausschließlich über API-Parameter gesteuert:

| Komponente | Gemini | Anthropic | OpenAI |
|---|---|---|---|
| Talker | `thinking_level: 'low'` oder `'minimal'` | Standard (kein Extended Thinking) | `reasoning_effort: 'low'` |
| Analyst | `thinking_level: 'medium'` | Extended Thinking aktiviert | `reasoning_effort: 'medium'` oder `'high'` |

Begründung: Google empfiehlt für Gemini 3.x explizit, textuelle CoT-Anweisungen durch `thinking_level` zu ersetzen (Google Developers Blog 2026, ai.google.dev/gemini-api/docs/thinking). Bei Manipulation der Reasoning-Tiefe via Text kollidiert die Anweisung mit der nativen API-Steuerung.

### D9 — Modell-Allokation pro Komponente

| Komponente | Default-Modell | Begründung |
|---|---|---|
| Talker | `google/gemini-3.1-flash-lite` (vorläufig) | Latenz-optimiert, günstig, schon gut konditioniert für deutsche Dialogführung |
| Analyst | `google/gemini-3.5-flash` (zunächst), Migrationspfad Claude Sonnet | Tiefer für Tool-Use, Reasoning, semantische Klassifikation |
| Orchestrator | TypeScript | Deterministisch |

**Talker-Modellwahl ist eval-getrieben** und wird in PROJ-21 finalisiert. Wenn Voice-Latenz < 800ms First-Token gefordert wird, wechselt Talker auf Claude Haiku oder verbleibt bei Flash-Lite. Wenn Text-only ausreicht und Tonalität wichtiger als Latenz ist, kann auch Flash-3.5 als Talker dienen.

**Analyst-Modellwahl ist qualitäts-getrieben.** Cross-Vendor-Test (Gemini vs. Anthropic) gehört in PROJ-21, weil unterschiedliche Provider andere blinde Flecken haben (Vendor-Diversität-Prinzip, vgl. Memory `feedback_vendor_diversity.md`).

### D10 — Eventual Consistency als akzeptierte Limitation

Briefing-Aktualität ist *eventual*. Folgende Konsequenzen werden bewusst akzeptiert:

- Bei sehr schnellen User-Turns (User antwortet innerhalb von Sekunden) kann der Analyst der vorherigen Iteration noch nicht durch sein. Talker fällt dann auf das *vorherige* Briefing zurück, das eine Iteration alt ist.
- Konkrete Folge: Talker könnte denselben Slot zweimal anschneiden, wenn der User-Turn ihn bereits beantwortet hat aber der Analyst-Tracker-Update noch fehlt.
- Mitigation 1: Default-Briefing aus Phase als Fallback (immer verfügbar, generisch).
- Mitigation 2: Talker-Prompt enthält den Hinweis "Wenn der Mitarbeiter im letzten Turn bereits Information zu einem Thema geliefert hat, frage nicht erneut nach, sondern führe weiter."
- Mitigation 3: Bei `analyst_status='processing'` für > 30s während User-Aktivität: Orchestrator triggert beim nächsten Turn einen Catch-up-Run statt eines normalen Analyst-Runs.

### D11 — Observability via Langfuse pro Komponente

PROJ-13 Langfuse-Tracing wird erweitert:

- Drei separate Spans pro Turn: `interview.talker`, `interview.analyst`, `interview.orchestrator`.
- Alle drei unter derselben `session_id = interview_id` gruppiert.
- Tags: `component=talker|analyst|orchestrator` ergänzend zu bestehenden Tags (`model`, `environment`, `persona`, `eval_run_id`).
- Cost-Tracking pro Component für Cost-Attribution.
- Briefing-Inhalt als strukturiertes Attribut auf Analyst-Span. So sind Briefing-Drift und Stale-Briefing-Verwendung in Langfuse retrospektiv analysierbar.

### D12 — `complete_interview` wird Orchestrator-getrieben mit Bestätigungs-Heuristik

Tool `complete_interview` entfällt. Lifecycle-Übergang nach `completed`:

```
Trigger A (Hard-Stop): timerMinutes >= maxDurationMinutes
  → Orchestrator setzt status='completed', extractions_pending=true
  → Talker bekommt Briefing "Verabschiede dich knapp"

Trigger B (Soft-Confirm):
  1. Analyst hat in vorherigem Briefing markiert: wrap_up_question_asked=true
  2. Talker hat in vorherigem Turn die Abschlussfrage gestellt
  3. User hat im aktuellen Turn geantwortet
  4. User-Antwort enthält keinen neuen explorablen Prozess (Analyst-Check)
  → Orchestrator setzt status='completed', extractions_pending=true
  → Talker bekommt Briefing "Verabschiede dich, danke für die Zeit"

Wenn Trigger B fehlschlägt (User nennt neuen Prozess):
  → Phase bleibt wrap_up, Analyst registriert neuen Step, nächste Iteration
```

---

## Consequences

**Positiv:**
- Talker-Prompt schrumpft drastisch. Negative Constraints raus, Phase-Methodologie taktisch. Eliminiert Over-Specification-Penalty bei fähigen Modellen.
- Phase- und Lifecycle-Logik wird testbar, deterministisch und offline mit Tracker-Snapshots verifizierbar.
- Modell-Allokation entkoppelt: schnelles Modell für Dialog, fähiges Modell für Analyse. Beobachtetes Paradox (fähigeres Modell schlechter) löst sich auf.
- Voice-Tauglichkeit (PROJ-7) deutlich verbessert durch dedicated Latenz-optimierten Talker.
- Provider-Migration vorbereitet (Anthropic, OpenAI) ohne komplettes Prompt-Rewrite.
- Multi-Provider-Eval und Vendor-Diversität (Memory `feedback_vendor_diversity.md`) sind technisch erstmals möglich.

**Negativ:**
- Komplexität steigt: drei Komponenten statt einer, asynchrone Koordination, Eventual Consistency.
- Zwei LLM-Calls pro Turn statt einer. Bei vergleichbaren Modellen Kostenanstieg, bei unterschiedlichen Modellen ungefähr gleich oder günstiger.
- Tracker-Updates landen mit Verzögerung. Im worst case wird Slot zweimal angeschnitten.
- Debugging anspruchsvoller: Drei Spans pro Turn statt einer. Mitigation via Langfuse-Sessions.
- Existierende ADRs (007, 008, 009) bleiben gültig, aber ein Teil ihrer Detailregeln wird durch D7 obsolet (Anti-Anchoring, Silence-Constraints). ADR-Konsistenz muss in Amendments dokumentiert werden.

**Offene Fragen:**
- Talker-Modellwahl: Flash-Lite vs. Haiku vs. Flash-3.5 wird durch PROJ-21-Eval entschieden, abhängig vom Voice-Strategy-Entscheid.
- Konkrete Schwellwerte für Trigger B (Soft-Confirm Completion): wie streng identifiziert der Analyst einen "neuen explorablen Prozess" in der Wrap-up-Antwort? Empirisch in PROJ-22 Iteration 4 zu justieren.
- `responseSchema` für Briefing: AI SDK v6 Support für Gemini `responseSchema` plus Tool-Use im gleichen Call ist zu verifizieren. Falls nicht: Briefing-Output via separates Tool `produce_briefing`.

---

## Umsetzung

| # | Entscheidung | Voraussetzung | Status | Aufwand |
|---|---|---|---|---|
| D1 | Dual-Loop Grundprinzip | — | Proposed | (Konzept) |
| D2 | V1 Pipelined | D1 akzeptiert | Proposed | (Konzept) |
| D3 | Tool-Migration | D1, D2 | Wird PROJ-22 Iteration 3 | M |
| D4 | Orchestrator + Phase-Logic | D1 | Wird PROJ-22 Iteration 2 | M |
| D5 | waitUntil Vercel | D1 | Wird PROJ-22 Iteration 3 | S |
| D6 | Provider-Compiler-Layer | D7 | Wird PROJ-22 Iteration 5 | L |
| D7 | Prompt-Refactor | PROJ-21 Baseline | Wird PROJ-22 Iteration 1 | M |
| D8 | Native Reasoning-Steuerung | D6 | Wird PROJ-22 Iteration 3 | S |
| D9 | Modell-Allokation | D7, PROJ-21 Baseline | Wird PROJ-22 Iteration 4 | S |
| D10 | Eventual Consistency Mitigation | D2, D3 | Wird PROJ-22 Iteration 3 | S |
| D11 | Observability-Erweiterung | D1 | Wird PROJ-22 Iteration 2 | S |
| D12 | Orchestrator-driven Completion | D4 | Wird PROJ-22 Iteration 2 | S |

Empfohlene Reihenfolge der Implementierung (jede Iteration mit Eval-Gate gegen PROJ-21-Baseline):

1. **Iteration 1 (D7-Talker):** Negative Constraints raus, Phase-Methodologie taktisch verschlanken, Few-Shots auf Canonical Example. Noch im Single-Call-Modell. Eval-Vergleich.
2. **Iteration 2 (D4 + D12 + D11):** Orchestrator-Modul extrahiert, `transition_phase` / `enter_coverage_check` / `complete_interview` entfernt, Phase deterministisch berechnet. Observability erweitert. Eval-Vergleich.
3. **Iteration 3 (D3 + D5 + D8 + D10):** Talker/Analyst-Split, `waitUntil`, native Reasoning-Steuerung, Eventual-Consistency-Mitigation. Eval-Vergleich.
4. **Iteration 4 (D9):** Modell-Allokation pro Komponente final festlegen. Cross-Vendor-Test. Eval-Vergleich.
5. **Iteration 5 (D6):** Provider-Compiler-Layer für Anthropic implementieren. Cross-Vendor-A/B-Test. Eval-Vergleich.

---

## Out of Scope

- **Voice-Implementation (PROJ-7).** Bleibt unverändert während ADR-011 implementiert wird. Live-API-Integration (ADR-010 D4) ist nachgelagert.
- **Extraction-Service (PROJ-20).** Bleibt unverändert. Der Analyst macht Tracker-Pflege live; die Post-Interview-Extraction läuft weiter parallel auf dem finalen Transcript.
- **Knowledge-Informed Interviewing (PROJ-19).** Wird durch ADR-011 nicht vorgegriffen. Analyst-Architektur ist offen für späteren Wissensgraph-Lookup im Briefing-Schritt.
- **UI-Anpassungen (PROJ-3).** Briefing-Drift oder Stale-Briefing-Hinweise werden NICHT an den User kommuniziert. UI-Verträglichkeit bleibt unverändert.
- **Persistenz-Modell für intermediate Tracker-Snapshots.** Tracker bleibt in `interview_state.step_tracker` als JSONB, kein Event-Sourcing.

---

## Verweise

- Research-Bericht: `docs/Prompting-Strategien_für_deutsche_Multi-Turn-Agenten.md`
- Quellen (verifiziert): Tang et al. 2025 "The Few-shot Dilemma" (arXiv 2509.13196); Steve Kinney 2025 "Prompt Engineering Across the OpenAI, Anthropic, and Gemini APIs"; Google Developers Blog 2026 "New Gemini API updates for Gemini 3"; Google AI Dev Docs "thinking" (ai.google.dev/gemini-api/docs/thinking); Anthropic Constitutional AI; Berkeley Function-Calling Leaderboard (BFCL).
- Kritisch: UCL-Paper (arXiv 2601.00880) hat plausible Direktionsempfehlungen aber zweifelhafte exakte Schwellenwerte. Nicht als Begründung für harte Limits verwendet.
- Memory: `feedback_vendor_diversity.md`, `reference_gemini_context_caching.md`, `reference_gemini_cookbook_findings.md`
