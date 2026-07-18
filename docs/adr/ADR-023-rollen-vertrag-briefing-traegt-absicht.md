# ADR-023: Rollen-Vertrag — Briefing trägt Absicht statt Frage; Analyst terminiert nicht; Fokus-Lock bindend für den Talker

**Status:** Accepted (2026-07-18 — via `/architecture` + `/grilling` PROJ-46)
**Author:** lyas53
**Repository:** Roly-Bach/meridian-app
**Auslöser:** PROJ-44 QA-Runde 2/3 (2026-07-17) — die Befunde H-2 (Analyst schreibt Abschiedstext in `suggested_question` während der Orchestrator-State noch `explore` ist), M-6 (O-Drought-Lock steuert den Analyst, erreicht aber den Talker nicht → Themen-Ping-Pong), M-7 (inhaltsblinder Completion-Farewell), L-1 (fehlende Übergänge) und BUG-4 (wortgleiche Catch-all-Sonde nach Late Discovery). Alle fünf teilen eine Wurzel: die Rollenteilung Analyst/Talker stimmt seit dem PROJ-44-Timing-Flip nicht mehr.
**Ergänzt / ändert:** ADR-011 (Dual-Loop), ADR-021 (Analyst synchron vor Talker), ADR-022 (`resolveTurnLifecycle`). ADR-022 D2 hatte die volle „Analyst darf nicht terminieren"-Lösung explizit an PROJ-46 verwiesen; diese ADR löst sie ein. Die Timing-Entscheidung (ADR-021 D1) und die Lifecycle-Zusammenlegung (ADR-022 D1) bleiben unverändert gültig; die zwei deterministischen Böden (Fortschritt: `computeFocusLock`/`updateODrought`/`hasUnexhaustedStep`; Terminierung: `resolveTurnLifecycle`) bleiben in ihrer Garantie unangetastet.
**Realisiert durch:** PROJ-46 (Talker-Briefing-Konsolidierung).

---

## Context

ADR-021 zog den Analyst synchron **vor** den Talker. Damit fiel die Existenzgrundlage einer ganzen Talker-Schicht weg: die code-berechneten Signal-Blöcke ([conversationSignals.ts](../../src/services/conversationSignals.ts) → Talker-PFLICHT-Blöcke) waren die Kompensation dafür, dass der Talker vor PROJ-44 **keinen** frischen Analyst hatte. Er brauchte eine eigene billige In-Turn-Lesung (Ambiguität, Ausnahme, Blockade, Drill-Stop, Frage-Wiederholung). Jetzt sieht der Analyst denselben Turn zuerst — die Schicht ist größtenteils redundant.

Gleichzeitig trägt der Talker-Prompt zwei sich widersprechende Steuerungsquellen: seine eigenen Signal-Blöcke **und** ein advisory Analyst-Briefing (`suggested_question`, „anpassen wenn bereits beantwortet"). Diese Doppelsteuerung produziert die QA-Befunde:

- **H-2:** der Analyst führt über `suggested_question` + STUFE-4-„PRIMÄRE Treiber für den Phasenübergang" ein Schatten-Lifecycle-Modell parallel zur autoritativen State-Machine. Er kann einen Abschiedstext schreiben, während der State noch `explore` ist. ADR-022 D2 sperrte nur den weichen Abschluss aus `explore` (Zustands-Geländer), nicht den Kanal selbst.
- **M-6:** der O-Drought-Fokus-Lock setzt `focusStepId` nur im **Analyst**-Prompt (`next_focus`/`suggested_question`). Der Talker bekommt den Lock nicht und behandelt die Empfehlung als unverbindlich („Empfohlene Frage — anpassen wenn bereits beantwortet"). Belegte Rücksprünge trotz Lock (buchhalter Turn 7/12, it-support Turn 15).
- **M-7 / L-1 / BUG-4:** inhaltsblinder Farewell, fehlende Übergänge, wortgleiche statische Sonde.

Die PROJ-44-„Weg-nach-vorn"-Analyse hat den Ziel-Vertrag empirisch skizziert: **Themen-Disziplin und Terminierung gehören an den deterministischen Boden bzw. Analyst-Guidance; Formulierung gehört an den Talker** (die einzigen im Judge gelobten Fragen waren Talker-Erfindungen). Rollen schärfen, nicht den Talker entfernen.

Leitprinzip **B3 (Hybrid), zwei deterministische Böden:** pro Intention der Test — schützt sie gegen einen LLM-Blindspot (→ deterministisch, ggf. Cross-Check) oder ermöglicht sie LLM-Adaptivität (→ sparsame Guidance)? Deterministisch bleiben genau zwei bereits gebaute Böden: der Fortschritts-Boden (Fokus-Lock) und der Terminierungs-Boden (`resolveTurnLifecycle`). Alles andere wird sparsame Analyst-Guidance oder Talker-Formulierung.

---

## Decision

### D1 — Das Briefing trägt strukturierte Absicht, keine Frage, kein Freitext

`suggested_question` (konkrete ausformulierte Frage) und `next_focus` (Freitext-Themenlabel) entfallen ersatzlos aus dem LLM-Briefing-Schema. Der Analyst formuliert keine Fragen mehr. Das Briefing trägt stattdessen:

- **Ziel-Schritt** — deterministisch, aus dem Fokus-Lock (`oDrought.stepId`), **nicht** LLM.
- **Ziel-O-Feld** (`target_o_field`) — LLM-gewählt: der Analyst nennt eines der **sieben** O2–O6-Felder (`O_SLOT_FIELDS`: entscheidungslogik, tazite_cues, ausnahmen, inputs, outputs, hilfsmittel, abhaengigkeiten) des gelockten Schritts, geführt durch eine „O2–O6 vor Quant, wähle das gesprächslogisch salienteste"-Prompt-Zeile. Bei LLM-Auslassung deterministischer Fallback = erstes leeres O2–O6-Feld des gelockten Schritts. Quantitative Slots sind **kein** Talker-Ziel (bleiben opportunistisch + Card-Territorium).
- **Übergang-nötig** — code-berechnet, typisierter Grund (`step_switch` | `closing_entry` | keiner), per-Turn ephemer.

Das LLM-Briefing-Schema besteht danach ausschließlich aus einem Enum (`target_o_field`), einem Boolean (`step_advance_ready`, siehe D2) und strukturierten `clarification_cards`. Der Talker konsumiert die Absicht **bindend** in der Ziel-Wahl (welcher Schritt, welches O-Feld), aber **frei im Wortlaut**.

**Invariante I1 (H-2-Wurzelfix):** es gibt strukturell **kein** Briefing-Feld, über das der Analyst eine Frage, eine Terminierung oder eine Verabschiedung ausdrücken kann. Das einzige Analyst-Freitext, das den Talker erreicht, sind Schritt-**Titel** aus dem geteilten Step-Tracker (via `register_step`, `sanitizeForPrompt`-behandelt) — die können nur einen Prozess benennen, nie das Interview beenden. `clarification_cards`-Freitext geht in die Clarification-UI, nie in den Talker-Prompt.

### D2 — Der Analyst terminiert nicht; Completion ist zu 100 % die Orchestrator-Entscheidung

Die STUFE-4-Rahmung „Dies ist der PRIMÄRE Treiber für den Phasenübergang" wird zu „ist der aktive Schritt inhaltlich ausreichend gedeckt" umgeschrieben. `step_advance_ready` bleibt ein **beschränktes** advisory Wissenssignal, das der Fortschritts-Boden (`hasUnexhaustedStep`) vetoen kann — die Orchestrator-Logik `stepAdvanceReady && !hasUnexhaustedStep` ist unverändert, nur die Prompt-Rahmung wird ehrlich. Der Analyst räsoniert nicht mehr über den Lebenszyklus.

Die Verabschiedungs-**Formulierung** ist Talker-Sache, ausgelöst einzig vom deterministisch aufgelösten Completion-State (`isCompletionFarewell`, unverändert die einzige Farewell-Naht). Kein Farewell-Limbo, keine Doppel-Verabschiedung.

**Invariante I2:** Terminierungs-Hoheit liegt ausschließlich beim Orchestrator (`resolveTurnLifecycle`).

### D3 — Der Fokus-Lock wird bindend für den Talker

Der O-Drought-Fokus-Lock steuert bisher nur den Analyst. Künftig rendert der Talker-Kontext die Absicht als **bindenden** Ziel-Block (gelockter Schritt-Titel + O-Feld-Label aus der code-eigenen `SLOT_PROMPT_HINT`-Map, ergänzt um eine `abhaengigkeiten`-Zeile), statt der advisory `briefingSection` mit „anpassen wenn bereits beantwortet". Kein eigenständiger Themenwechsel des Talkers gegen den Lock (behebt M-6).

Der heutige potenzial-first-Ziel-Picker `computeWalkthroughSlotTarget` ([interviewSemantic.ts](../../src/services/interviewSemantic.ts)) — der aktiv gegen den O-Drought-Lock zog — **entfällt ersatzlos**. Die Ziel-O-Feld-Wahl (D1) ersetzt ihn und ist per Konstruktion mit dem Drought-Primitiv (`countFilledOFields` über `O_SLOT_FIELDS`) deckungsgleich: „was der Talker anzielt" und „was den Lock freigibt" sind dasselbe.

**Erschöpfung feuert auch bei voller O-Deckung.** Der bindende Lock deckt einen Grenzfall auf, der beim advisory Lock folgenlos war: ein Schritt kann alle sieben O2–O6-Felder gefüllt haben, während der Drought-Streak noch < K ist (das siebte Feld fiel gerade in diesem Turn, Streak resettet bei Fortschritt auf 0). Der Lock hielte den Schritt dann noch bis zu K Turns, obwohl kein leeres O-Feld mehr existiert — der Talker wäre an einen fertigen Schritt ohne Ziel gebunden (flaches Kreisen, gebremst nur durch den No-New-Extraction-Streak). Deshalb gilt ein Schritt mit `countFilledOFields === O_SLOT_FIELDS.length` (alle 7 O-Felder — Wert **oder** `nicht_befund`, dieselbe Schwelle wie der Drought) **sofort als erschöpft**: sowohl `hasUnexhaustedStep` als auch `computeFocusLock`s exhausted-Set behandeln volle O-Deckung wie einen gefeuerten Drought. Damit konvergieren `step_advance_ready` (Analyst-Urteil „gedeckt") und der Lock sauber — voller Schritt → Lock rückt sofort weiter (oder Phase → `closing`, wenn kein anderer Schritt offen), ohne Nachlauf. Keine neue Semantik, nur eine zweite Erschöpfungs-Bedingung neben „K Turns trocken".

### D4 — Closing wird zur Entdeckungs-Fortsetzung; die Probe-Maschinerie wird entkernt

Die statische Catch-all-Sonde (`CLOSING_PROBE_TEXT`) und die closing-PFLICHT-Methodik entfallen. Im Closing stellt der Interviewer weiter natürlich anschließende, **jedes Mal frisch formulierte** Entdeckungsfragen (Talker, kein Frequenz-Cap, Anti-Wiederholung über Formulierung). Die Injektions-Maschinerie `closingProbeAlreadyAsked`/`shouldInjectClosingProbe`/`closingProbeAnswerReceived` wird gelöscht.

Terminierung im Closing läuft rein deterministisch über die zwei Böden. Die neue Completion-Regel:

```
resolveTurnLifecycle (closing-Zweig):
  # M7-b-Reentry zuerst (in resolvePhaseTransition):
  if hasStepInStatus('exploring') OR hadExtractionThisTurn → target = 'explore'   # zurück in die Tiefe
  else target = 'closing'

  # terminale Auswertung, gegen die AUFGELÖSTE Phase (ADR-022):
  if target == 'closing':
     if ctx.phase == 'closing' AND noNewExtractionStreak >= K:   # bereits ≥1 Closing-Turn gelaufen
        Cards vorhanden → 'clarification' (complete:false)
        sonst           → 'closing' (complete:true, 'soft_confirm')
     else:
        → 'closing' (complete:false)   # frischer Eintritt ODER Streak < K → weitere Entdeckungsfrage
```

Der Kern: die Completion bindet zusätzlich an `ctx.phase == 'closing'` (die **beim Turn-Start geladene** Phase). Der explore→closing-**Eintritts**-Turn hat `ctx.phase == 'explore'` und kann deshalb nie weich abschließen — er stellt garantiert **mindestens eine** Entdeckungsfrage. Das Entdeckungs-Budget ist `K − streak_beim_Eintritt`, **selbstanpassend**: eine engagierte Konversation bekommt das volle Budget „solange Zeit ist", eine bereits erschöpfte (Streak-Eintrittspfad) genau einen letzten Versuch. Kein zweiter Zähler.

Der **Hard-Timer** (Trigger A, `timerMinutes >= maxDurationMinutes`) bleibt phasen-agnostisch die letzte Instanz und respektiert anstehende Cards (ADR-022) — die Entdeckungs-Fortsetzung kann so nie endlos laufen.

**M7-b (Verallgemeinerung des `newStepThisTurn`-Vetos):** jede in diesem Closing-Turn **angewendete** Wissens-Extraktion routet zurück nach `explore`. Signal ist das explizite `ctx.hadExtractionThisTurn` (aus `analystResult.toolCalls[].applied` über `EXTRACTION_TOOL_NAMES`, dieselbe Primitive wie `computeNextBriefing`s `hadExtraction`). Es subsumiert `newStepThisTurn` (ein neuer Schritt läuft immer über ein applied `register_step`); `newStepThisTurn`/`hasNewStepThisTurn` werden gelöscht. Der neu-entdeckte-Prozess-während-Closing-Pfad (PROJ-42-AC „erstklassig zurück nach explore") bleibt erhalten und ist mit M7-b konsistent.

### D5 — Signal-Kollaps + Talker-Entdichtung; Anker-Pflicht wird Option

Aus [conversationSignals.ts](../../src/services/conversationSignals.ts) und dem Talker-Prompt ersatzlos entfernt: `exception`, der numerische `ambiguity`-Detektor (eine im Code eingebaute Grounding-Verletzungs-Fabrik nach dem KI-18-Muster — vergleicht unit-blind eine rohe Turn-Zahl gegen einen normalisierten Slot-Wert), `recentlyRecontextualized`, die Drill-Stop-/Laddering-PFLICHT-Blöcke, und — weil `suggested_question` weg ist — `anchorNumbers`/`extractNumericTokens`/die ANKER-SPERRE. Widerspruchsauflösung übernimmt das (unit-aware) Analyst-Urteil plus der bestehende [talkerGroundingGuard](../../src/services/talkerGroundingGuard.ts) als Backstop. Die Intention von Drill-Stop und Laddering (einen erfolglos gedrillten Slot / blockierten Thread nicht weiter verfolgen) fällt in die deterministische Ziel-/Lock-Wahl, nicht in einen separaten Block.

Aus dem statischen Talker-Prompt entfernt: `WALKTHROUGH_EXAMPLES` (lehren Tool-Calls, die der toollose Talker nicht machen kann), das Tool-Syntax-Verbot (KI-20 — guardet nach Wegfall des Few-Shots einen nicht mehr existierenden Auslöser), die dynamische ANKER-SPERRE, `coverageCheckSection`. Erhalten: Rolle, `<turn_format>`, `<verboten>`, `<no_repeat>`, `<kein_kommentar>`, Floskel-Verbot, die statische Anti-Zitat-Regel.

**Anker-Pflicht E3.3** wird von einer **Pflicht** zu einer **Option**: der Talker **darf** eine echte frühere Aussage aufgreifen, wird aber nicht dazu gezwungen, wenn keine passt. Der Erfindungs-Druck fällt weg, weil die Regel keinen Anker mehr **verlangt** — laut der 2026-07-12-Bestandsaufnahme die diffuse Wurzel der Grounding-Verletzungen. Der Talker behält den vollen Rohverlauf; der Grounding-Guard bleibt der Backstop.

PROJ-46 ist damit überwiegend **Löschung und Ent-Dichtung** des Talker-Prompts und greift das KI-18-Prompt-Dichte-Problem an der Wurzel an, statt es zu verschärfen. Der Analyst-Prompt wächst netto nicht (STUFE 4 wird umgeframt, das Ziel-O-Feld ist eine Zeile am bestehenden Lock).

### D6 — Nutzersichtbare statische Textausgaben werden Talker-formuliert bzw. gelöscht

Prinzip: nutzersichtbarer statischer Text wird Talker-formuliert (kontextuell); interne Kontrolle bleibt deterministisch (State-Flags/Böden statt String-Match).

- **Off-Topic-Redirect:** der feste `buildOffTopicRedirect`-Wortlaut wird durch einen **schlanken** Talker-Call ersetzt (`STATIC_PROMPT` + Redirect-Addendum + History; **kein** `buildDynamicContext`, **kein** Grounding-Guard, **kein** Filler-Tracking). Er weist knapp auf die Interviewer-Rolle hin und führt zum offenen Thread zurück, ohne die letzte Frage wörtlich zu wiederholen (KI-26-Symptom). Der State bleibt unverändert — off_topic kurzschließt weiterhin **vor** dem Analyst; die Klassifikations-**Präzision** des Rollen-Guards (KI-26) bleibt PROJ-42-Scope.
- **Reconnect:** der Statiktext („Willkommen zurück…") wird ersatzlos gelöscht. Wegen atomarer Turn-Persistenz (KI-22) ist die letzte Nachricht beim Reconnect immer die offene Interviewer-Frage; sie ist in der gerenderten History sichtbar. Reconnect wird validierungs-only (Token gültig/nicht abgelaufen/nicht completed/hat Turns), gibt **keine** Assistant-Nachricht zurück. Frontend: der Reconnect-Zweig erzeugt keine Greeting-Bubble mehr und feuert `/reconnect` nur noch als Validitäts-Ping. Das tote `isReconnect`-Flag in `interviewTalker.ts` wird gelöscht.

---

## Consequences

**Positiv:**
- H-2 ist an der Wurzel beseitigt (I1/I2): der Analyst hat strukturell keinen Kanal, um zu terminieren oder eine Frage/Verabschiedung zu formulieren. Die ADR-022-D2-Invariante wird von einem Zustands-Geländer zu einer strukturellen Garantie.
- M-6 ist behoben: eine Steuerungsquelle statt zweier konkurrierender. Der Lock ist für den Talker bindend.
- BUG-4/M-7/L-1 fallen mit der Talker-formulierten Closing-Entdeckung + den Übergangs-Facetten.
- Der Talker-Prompt wird entdichtet — greift das dokumentierte KI-18-Dichte-Problem beim lite-Modell an, statt es zu vergrößern. Erwartung: `dialog_naturalness` gehalten oder besser.
- Weniger Code: `computeWalkthroughSlotTarget`, `newStepThisTurn`/`hasNewStepThisTurn`, die Probe-Maschinerie, fünf Signal-Detektoren, `WALKTHROUGH_EXAMPLES`, das Tool-Syntax-Verbot, `next_focus`/`suggested_question` — alle ersatzlos, kein Kompat-Shim (analog ADR-022 D3).

**Negativ / Trade-offs:**
- **Off-Topic-Turns kosten jetzt einen LLM-Call** (vorher call-frei). Bewusst gewählt (weichere Fassung bei KI-26-Falsch-Positiven wichtiger als der Restaufwand auf einem seltenen Pfad).
- Das Ziel-O-Feld ist LLM-gewählt (mit deterministischem Fallback) — eine adaptive Entscheidung auf dem kritischen Pfad. Der Fallback + der Lock garantieren, dass der gelockte Schritt trotzdem immer angezielt wird.
- Die Löschkandidaten `question-stem` (`conversationSignals`) und `filler`-Tracking bleiben provisorisch erhalten und werden per Eval verifiziert, bevor sie fallen — dokumentiert, nicht in dieser Runde final entfernt.

**Offen / abgegrenzt (nicht Teil dieser ADR):**
- Klassifikations-**Präzision** des Rollen-Guards (KI-26) → PROJ-42.
- Forced-Choice/Anchoring-Mechanik, Zahlen→Cards inkl. M-4-Card-Zuverlässigkeit → PROJ-43.
- Der `dedup_slot_coverage`-Nenner-/Dependency-Effekt (grünes Gate) → PROJ-40.
- Volle Dependency-Capture-Zuverlässigkeit über „abhaengigkeiten in die O-Feld-Menge" hinaus → eigenes Item (schema-nah, PROJ-26).
- Entfernung des `talkerGroundingGuard` → spätere, evidenz-schwere Entscheidung; PROJ-46 misst nur Guard-Aktivität als Leitindikator.

---

## Alternatives Considered

1. **Ziel-O-Feld voll deterministisch** (code-Walk O2–O6 auf dem gelockten Schritt, kein LLM-Feld). Verworfen: der B3-Test ordnet die Facetten-Wahl der LLM-Adaptivität zu (welche Facette ist gesprächslogisch salient), nicht dem Blindspot-Schutz; die Spec fordert „vom Analyst gewählt". Der deterministische Fallback bewahrt trotzdem die Garantie.
2. **Eigener Closing-Entdeckungs-Zähler** (garantiert K Entdeckungsfragen unabhängig vom Einstiegsweg). Verworfen: ein zweites Primitiv für eine Garantie, die der phasen-gebundene Streak (`ctx.phase == 'closing'`) bereits liefert (≥1 Frage strukturell, volles Budget bei engagierter Konversation). Die Spec nennt explizit **den** No-New-Extraction-Streak. Fallback-Knopf bleibt: Streak-Reset bei Closing-Eintritt (eine Zeile), falls Eval den Streak-Eintrittspfad als zu abrupt zeigt.
3. **Off-Topic-Redirect deterministisch verbessern** (call-frei, nur nicht mehr wortgleich wiederholen). Verworfen zugunsten der Talker-Formulierung (Nutzer-Entscheidung), näher am D6-Prinzip „nutzersichtbarer Text wird Talker-formuliert".
4. **`suggested_question` behalten, nur den Lock zusätzlich durchreichen.** Verworfen: konserviert die Doppelsteuerung (zwei konkurrierende Quellen) und lässt den H-2-Kanal offen. Die Rollenschärfung verlangt, dass die Frage-Formulierung ausschließlich beim Talker liegt.
