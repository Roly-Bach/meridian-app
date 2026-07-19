# ADR-024: Analyst-Completion-Readiness — geguardetes Boolean, Orchestrator bleibt Autorität (Amendment zu ADR-023 D2/D4)

**Status:** Accepted (2026-07-19 — via `/architecture` PROJ-46 QA-Runde 2; angenommen vor `/backend` B/C)
**Author:** lyas53
**Repository:** Roly-Bach/meridian-app
**Auslöser:** PROJ-46 QA-Runde 2 (2026-07-18/19). QA-Runde 1 fand H-1: für ein realistisches (nicht voll-abgedecktes) Interview feuert die deterministische Completion faktisch nie außer per Wall-Clock-Force (KI-23-Completion-Regression). Fix-Runde-1 (A+D+D2) holte die Terminierung deterministisch zurück, aber flach; ein K-Experiment in Runde 2 zeigte: das Anheben von K holt die Tiefe zurück, reintroduziert aber den Farewell-Loop (Loop-Länge ≈ K). K ist der falsche Hebel.
**Ergänzt / ändert:** ADR-023 (D2 „Analyst terminiert nicht"; D4 Closing-Terminierung via No-New-Extraction-Streak). ADR-021 (Timing) und ADR-022 (`resolveTurnLifecycle`-Merge) bleiben unverändert gültig. Der Fortschritts-Boden (ADR-023 D3, `computeFocusLock`/`updateODrought`/`hasUnexhaustedStep`, `O_DROUGHT_LIMIT`) bleibt in seiner Garantie **unangetastet**. Die ADR-023-Invarianten **I1** (kein Freitext-Farewell-Kanal) und **I2** (Terminierungs-Hoheit beim Orchestrator) bleiben **strukturell wahr**.
**Realisiert durch:** PROJ-46 (Fallback-B/C-Increment).

---

## Context

ADR-023 D2 legte fest: der Analyst terminiert nicht, Completion ist zu 100 % die Orchestrator-Entscheidung; `step_advance_ready` ist ein rein advisory Schritt-Deckungs-Signal, das der Fortschritts-Boden vetoen kann. Die eigentliche Completion-Auslösung lag deterministisch im Orchestrator: `ctx.phase==='closing' ∧ noNewExtractionStreak ≥ K` (ADR-023 D4) oder der Hard-Timer.

PROJ-46 QA (2026-07-18/19) zeigte, dass dieser deterministische Terminator für den Normalfall nicht trägt:

- **QA-Runde 1 (H-1):** ein Schritt gilt erst als erschöpft, wenn alle O-Felder **und** die optionalen Potenzial-Slots gefüllt sind (die KI-23-„praktisch-nie-true"-Bedingung). Reale Personas liefern das nicht, also blieb die Phase in `explore` festgenagelt und erreichte nie ein stabiles `closing`. Der Agent formulierte mehrfach „alle Fragen beantwortet" **während `explore`** (run1 t23, run3 t32), ohne dass dieses korrekte Urteil einen Abschluss auslösen konnte — es gab keinen Eingangskanal zur Phasenmaschine.
- **Fix-Runde-1 (A+D+D2):** koppelte den Phasenübergang an O-Erschöpfung statt rohen Status, verengte das Streak-Reset-Signal auf echte neue O-Felder, erzwang den Hard Cap. Completion kam zurück (true bei beiden Personas), aber flach (buchhalter Turn 10, dedup zurück auf R3-Baseline) und it-support nur per Timer.
- **QA-Runde 2 (K-Experiment):** K=5 holte die Tiefe zurück (dedup 0.56→0.70), reintroduzierte aber den 6-Turn-Farewell-Loop bei buchhalter (Turns 25–30). Mechanisch: die Loop-Länge ist ≈ K. Läuft der Agent im Closing content-arm trocken, verabschiedet er sich K-mal, bis der Streak nachzieht.

Beide Symptome (verfrüht-flacher Abschluss bei niedrigem K, Farewell-Loop bei hohem K) sind dasselbe fehlende Stück: **das „ich bin inhaltlich fertig"-Urteil des Agenten kann Completion nicht auslösen.** Der deterministische Streak zählt neue O-Felder (breiten-blind gegen Tiefe) und feuert K trockene Turns, nachdem der Agent leergelaufen ist. Es gibt keinen K-Wert, der Tiefe und sauberen Abschluss zugleich liefert.

Leitprinzip aus ADR-023 unverändert (**B3 Hybrid, zwei deterministische Böden**): pro Intention der Test — LLM-Blindspot (→ deterministisch) oder LLM-Adaptivität (→ Guidance)? Die **Termination-Timing-Entscheidung** ist adaptiv (wann ist inhaltlich genug entdeckt), gehört also an ein LLM-Urteil — geguardet gegen die bekannten Blindspots (zu früh, nie) durch deterministische Böden. Der **Fortschritts-Boden** (wie durch die Schritte wandern, Anti-Ping-Pong) bleibt deterministisch.

## Decision

### D1 — Der Analyst signalisiert geguardete Completion-Readiness (`discovery_exhausted`)

Das LLM-Briefing-Schema bekommt ein zusätzliches **strukturiertes Boolean** `discovery_exhausted`: „ich beurteile die Entdeckung als erschöpft — die registrierten Prozesse sind gedeckt und die Person bietet nichts Substanzielles mehr". Der Analyst setzt es aus seinem Urteil über den aktuellen Turn.

Dies amendmentet ADR-023 D2: `step_advance_ready` war ein rein advisory Schritt-Deckungs-Signal; `discovery_exhausted` ist ein **geguarderter Completion-Readiness-Trigger**. Der Unterschied ist die Wirkung, nicht die Autorität.

**Invariante I1 bleibt wahr:** `discovery_exhausted` ist ein Boolean, kein Freitext. Es kann nur „Entdeckung erschöpft" ausdrücken, nie „verabschiede dich". Der Freitext-Farewell-Kanal entsteht nicht. Die Verabschiedungs-Formulierung bleibt Talker-Sache, ausgelöst einzig vom deterministisch aufgelösten Completion-State (`isCompletionFarewell`, unverändert).

**Invariante I2 bleibt wahr:** die deterministische Phasenmaschine (`resolveTurnLifecycle`) bleibt der **alleinige Entscheider**. Der Analyst schreibt nie Phase oder Completion; er liefert `discovery_exhausted` als **Input**, den die Maschine konsumiert. Der Analyst schlägt vor, die Maschine verfügt. Damit können Analyst und Maschine sich nicht widersprechen — der H-1-Split-Brain (Agenten-Urteil ohne Eingangskanal) wird geschlossen, nicht durch eine zweite Autorität, sondern durch einen Input-Kanal zur einen Autorität.

### D2 — Readiness eröffnet UND besiegelt Closing (Design 2)

`resolveTurnLifecycle` konsumiert `discovery_exhausted`:

- `explore` + `discovery_exhausted` + Guard → **Closing eröffnen** (Wrap-up einleiten). Der Closing-Eintritt stellt weiter mindestens **eine** Entdeckungs-Sonde; es wird **nicht** im selben Turn abgeschlossen.
- `closing` + `discovery_exhausted` + Guard → **abschließen**.

Design 1 (Readiness besiegelt nur aus Closing, Weg nach Closing bleibt mechanisch) wurde verworfen: es lässt die H-1-Diskrepanz offen — urteilt der Agent „fertig" während `explore`, bliebe das Signal wirkungslos, bis die Phasenmaschine Closing mechanisch erreicht. Design 2 gibt dem Urteil einen Kausalpfad.

Weil Readiness im selben Turn feuert, in dem der Analyst „fertig" urteilt, kollabiert das K-Turn-Warte-Fenster: **kein Farewell-Loop mehr** (er entstand genau aus diesem Fenster).

### D3 — Guards (leicht, measure-first)

Weil Readiness Closing eröffnen darf, braucht es eine Untergrenze gegen verfrühten/flachen Abschluss:

- **Inhärent:** mindestens eine Closing-Entdeckungs-Sonde muss durchlaufen sein (aus dem Zwei-Schritt-Fluss D2).
- **Coverage-Sanity:** Readiness wird erst gehonoriert, wenn mindestens ein registrierter Schritt substanziell gedrillt ist (nie leer abschließen).
- **Upper-Bound:** der Hard-Timer bei 100 % Budget bleibt unverändert der Letzt-Boden.
- **Kein harter Zeit-Floor** zu Beginn — bewusst, um zu messen, ob eine Analyst-geführte Entscheidung sauber greift. Zeigt der Eval verfrühte Abschlüsse, wird der Floor angezogen.

**Fail-Safe** (unverändert aus ADR-021 D4): schlägt der Analyst-Call fehl, ist `discovery_exhausted` = false → kein Readiness-Abschluss → der Hard-Timer bleibt Backstop.

### D4 — Der No-New-Extraction-Streak und der Hard Cap entfallen

- **`NO_NEW_EXTRACTION_LIMIT` (Streak-Completion, ADR-023 D4) entfällt** — von der Readiness ersetzt. Die Closing-Terminierung läuft nicht mehr über „K trockene Turns", sondern über das geguardete Analyst-Urteil.
- **Der Hard Cap (`MAX_REGISTERED_STEPS`, QA-Runde-1 Fix D2) entfällt** — Completion braucht die „endlich viele Schritte"-Prämisse nicht mehr (die Readiness + der Timer terminieren unabhängig von der Schritt-Zahl). Fragmentierung bleibt an den Dedup-Schichten (Jaccard, Soft-Similar), die der Cap ohnehin nur grob und blockierend ergänzt hat.

**Disengagement-Notiz:** der Streak fing auch disengagierte Gespräche vor dem Wall-Clock ab. Unter B/C soll der Analyst Disengagement erkennen und via Readiness früh abschließen. Bewährt sich das im Eval nicht, kann ein leichter deterministischer Disengagement-Escalator nachgezogen werden (measure-first, eigene Folgeentscheidung).

### D5 — Der Fortschritts-Boden bleibt unangetastet

`O_DROUGHT_LIMIT` (Fokus-Lock, ADR-023 D3) bleibt bei 3. Er steuert, wie sich das Gespräch **durch** die Schritte bewegt (Anti-Ping-Pong M-6), ein orthogonaler Job zur Terminierung. B/C fasst ihn nicht an. Ein Anheben von `O_DROUGHT` für mehr O-Feld-Tiefe (dedup) ist durch die Loop-Entkopplung jetzt ohne Farewell-Kosten möglich, aber eine **separate measure-first-Folgeentscheidung** nach verifiziertem B/C — eine Variable pro Eval-Zyklus.

## Consequences

**Positiv:**
- Der Farewell-Loop kollabiert strukturell (kein K-Turn-Warte-Fenster mehr), auch das latente Loop-Risiko bei content-armen Personas.
- Das Agenten-„fertig"-Urteil bekommt einen Kausalpfad (H-1-Split-Brain geschlossen), ohne eine zweite Autorität zu schaffen — I1/I2 bleiben strukturell wahr.
- Der Terminierungs-Boden wird einfacher: Streak + Cap entfallen, ein geguardetes Boolean + Timer ersetzen sie.
- Depth-Schraube (O_DROUGHT) ist von der Completion-Schraube entkoppelt und später frei tunbar.

**Negativ:**
- Die Termination-Timing-Qualität hängt jetzt am Analyst-Urteil (LLM). Verfrühter Abschluss bei zu leichtem Guard oder zu-spät bei zu-reluktantem Analyst sind neue Risiken, gegen die nur die leichten Böden + der Timer schützen. Measure-first.
- Disengagement-Erkennung wandert vom deterministischen Streak zum Analyst.
- Die Tiefe (dedup) bleibt in diesem Increment O_DROUGHT-limitiert; B/C hebt sie nicht selbst.

**Folgeentscheidungen:**
- Re-Eval-Gate (PROJ-46 QA nach Bau): `completion_correctness` = true **via Readiness** (nicht nur Timer), kein Farewell-Loop, kein verfrühter Abschluss; `dialog_naturalness` ≥ 0.67, `dedup` ≥ 0.56/0.62 gehalten.
- Separater measure-first-Schritt: O_DROUGHT anheben für Tiefe (dedup), Over-Drilling/dialog_naturalness beobachten.
- Bei Bedarf: leichter deterministischer Disengagement-Escalator, falls disengagierte Personas zu lange laufen.

## Alternatives Considered

1. **K anheben (O_DROUGHT + NO_NEW_EXTRACTION).** Verworfen: QA-Runde 2 zeigte empirisch, dass die Farewell-Loop-Länge ≈ K ist. Höheres K holt Tiefe, verlängert aber den Loop; kein K-Wert gewinnt beides. K ist der falsche Hebel für die Depth-vs-Termination-Spannung.
2. **Design 1 — Readiness besiegelt nur aus Closing.** Verworfen: lässt die H-1-Diskrepanz offen (Agenten-„fertig"-Urteil während `explore` bleibt wirkungslos bis zur mechanischen Closing-Transition).
3. **Streak + Cap behalten, nur K feiner tunen.** Verworfen: die Depth-vs-Loop-Spannung ist strukturell im breiten-blinden, K-verzögerten Streak angelegt, nicht in seiner Kalibrierung.
4. **Freitext-Completion-Signal statt Boolean.** Verworfen: reißt den H-2-Kanal (I1) wieder auf, den ADR-023 gerade strukturell geschlossen hat.
