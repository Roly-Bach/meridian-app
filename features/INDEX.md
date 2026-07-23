# Feature Index

> Central tracking for all features. Updated by skills automatically.

## Status Legend
- **Roadmap** - `/init` done, feature identified in feature map, no spec file yet
- **Planned** - `/write-spec` done, full spec written, architecture not yet designed
- **Architected** - `/architecture` done, tech design approved, ready to build
- **In Progress** - `/frontend` or `/backend` active or completed, not yet in QA
- **In Review** - `/qa` active, testing in progress
- **Approved** - `/qa` passed, no critical/high bugs, ready to deploy
- **Deployed** - `/deploy` done, live in production
- **Blocked** - Arbeit pausiert wegen externem Faktor (orthogonal zu Planned/Architected/In Progress)
- **Zurückgestellt** - Strategisch deprioritisiert, kein Bau-Termin; taucht in keiner Build Order auf

## Features

| ID | Feature | Type | Domain | Extends | Status | Spec | Priority | Appetite | Bugs |
|----|---------|------|--------|---------|--------|------|----------|----------|------|
| PROJ-1 | Auth + Workspace | Epic | Platform | — | Deployed | [spec](platform/PROJ-1-auth-workspace.md) | P0 | — | — |
| PROJ-2 | Interview Engine Backend | Epic | Interview Engine | — | Deployed | [spec](interview-engine/PROJ-2-interview-engine-backend.md) | P0 | — | — |
| PROJ-3 | Interview UI | Feature | Interview Engine | — | Deployed | [spec](interview-engine/PROJ-3-interview-ui.md) | P0 | — | — |
| PROJ-4 | Extraktions-Agent + Wissensbasis | Epic | Wissensbank | — | Deployed | → PROJ-20 | P0 | — | — |
| PROJ-5 | Prozessschritt-Anreicherung | Feature | Wissensbank | — | Deployed | → PROJ-20 | P0 | — | — |
| PROJ-6 | Use Case Identifikation | Epic | Use Case Engine | — | Deployed | [spec](use-case-engine/PROJ-6-use-case-identifikation.md) | P0 | — | — |
| PROJ-7 | Voice Input (Interview) | Extension | Interview Engine | PROJ-3 | Deployed | [spec](interview-engine/PROJ-7-voice-input.md) | P1 | — | — |
| PROJ-8 | Interview-Design Optimierung | Revision | Interview Engine | PROJ-2 | Deployed (superseded by PROJ-22) | [spec](interview-engine/PROJ-8-interview-design-optimierung.md) | P1 | — | — |
| PROJ-9 | LLM Provider Optimierung | Feature | Platform | — | In Progress | [spec](platform/PROJ-9-llm-provider-optimierung.md) | P1 | M | — |
| PROJ-10 | Access Control & Shared Workspace | Feature | Platform | — | Deployed | [spec](platform/PROJ-10-access-control-shared-workspace.md) | P0 | — | — |
| PROJ-11 | Interview PDF Report | Feature | Dashboard & Output | — | Deployed | [spec](dashboard-output/PROJ-11-interview-pdf-report.md) | P1 | — | — |
| PROJ-12 | Rate Limiting | Feature | Platform | — | Deployed | [spec](platform/PROJ-12-rate-limiting.md) | P1 | — | — |
| PROJ-13 | LLM Observability & Tracing | Feature | Platform | — | Deployed | [spec](platform/PROJ-13-llm-observability-tracing.md) | P1 | M | 0:0:2 |
| PROJ-14 | Embedding-Modell Auswahl | Extension | Wissensbank | PROJ-4 | Deployed | → PROJ-20 | P1 | — | — |
| PROJ-15 | CSP Hardening | Feature | Platform | — | Deployed | [spec](platform/PROJ-15-csp-hardening.md) | P1 | S | 0:0:1 |
| PROJ-16 | Supabase Hardening + Dependency Hygiene | Feature | Platform | — | Deployed | [spec](platform/PROJ-16-supabase-hardening.md) | P1 | M | 0:0:0 |
| PROJ-17 | Adaptive Eval-Harness + Start-Endpoint | Feature | Interview Engine | — | Deployed | [spec](interview-engine/PROJ-17-adaptive-eval-harness-start-endpoint.md) | P1 | M | 0:0:2 |
| PROJ-18 | Prozessschritt-Deduplication | Feature | Wissensbank | PROJ-5 | Deployed | → PROJ-20 | P1 | M | 0:0:2 |
| PROJ-19 | Knowledge-Informed Interviewing | Extension | Interview Engine | PROJ-2 | Zurückgestellt | — | P2 | — | — |
| PROJ-20 | Prozessableitungs-Pipeline | Epic | Wissensbank | — | Deployed | [spec](wissensbank/PROJ-20-prozessableitungs-pipeline.md) | P0 | — | 0:0:0 |
| PROJ-21 | Eval-Foundation für Modell- und Architektur-Vergleich | Revision | Interview Engine | PROJ-17 | Deployed | [spec](interview-engine/PROJ-21-eval-foundation-modell-architektur-vergleich.md) | P1 | M | 0:0:0 |
| PROJ-22 | Dual-Loop Interview Engine (ADR-011) | Revision | Interview Engine | PROJ-2 | Deployed | [spec](interview-engine/PROJ-22-dual-loop-interview-engine.md) | P1 | L | 0:0:5 |
| PROJ-23 | Adaptive Clarification Questions | Extension | Interview Engine | PROJ-2 | Deployed | [spec](interview-engine/PROJ-23-adaptive-clarification-questions.md) | P1 | M | 0:0:0 |
| PROJ-24 | Cluster-aware Use Case Generation + Detail View | Extension | Use Case Engine | PROJ-6 | Deployed | [spec](use-case-engine/PROJ-24-cluster-aware-use-case-generation.md) | P1 | L | 0:0:0 |
| PROJ-25 | Prozesswissens-Schema (O1–O5 + Governance) | Revision | Wissensbank | PROJ-20 | Deployed | [spec](wissensbank/PROJ-25-prozesswissens-schema.md) | P1 | L | 0:0:0 |
| PROJ-26 | Getypte Abhängigkeitskanten | Extension | Wissensbank | PROJ-20 | Deployed | [spec](wissensbank/PROJ-26-getypte-abhaengigkeitskanten.md) | P1 | M | 0:0:0 |
| PROJ-27 | Schema-Bindung + verlustfreie Speicherung | Revision | Interview Engine | PROJ-22 | Deployed | [spec](interview-engine/PROJ-27-schema-bindung-verlustfreie-speicherung.md) | P1 | L | 0:0:0 |
| PROJ-28 | Extraktions-Zuverlässigkeit | Revision | Interview Engine | PROJ-22 | Deployed | [spec](interview-engine/PROJ-28-extraktions-zuverlaessigkeit.md) | P1 | M | 0:0:0 |
| PROJ-29 | Gesprächsführungs-Revision | Revision | Interview Engine | PROJ-23 | Deployed | [spec](interview-engine/PROJ-29-gesprächsführungs-revision.md) | P1 | L | 0:0:1 |
| PROJ-30 | Tiefe-/O10-Metrik | Revision | Interview Engine | PROJ-21 | Deployed | [spec](interview-engine/PROJ-30-tiefe-o10-metrik.md) | P1 | L | 0:0:1 |
| PROJ-31 | Eval-Schärfung (Judge, Perturbation, Robustheit) | Revision | Interview Engine | PROJ-21 | Deployed | [spec](interview-engine/PROJ-31-eval-schaerfung.md) | P1 | L | 0:0:0 |
| PROJ-32 | Agenten-Architektur (Trennung, Preparator; vertagt) | Revision | Interview Engine | PROJ-22 | Zurückgestellt | [BL-E4.1+E4.2](../../meridian-ma/requirements/build-backlog-etappe2.md) · REQ-021/024 | P2 | M | — |
| PROJ-33 | Turn-Loop-Konsolidierung (runInterviewTurn) | Revision | Interview Engine | PROJ-22 | Deployed | [spec](interview-engine/PROJ-33-turn-loop-konsolidierung.md) | P1 | M | 0:0:0 |
| PROJ-34 | Werkzeug-Schreibabsichten + TurnStore-Port (DB-freie Evals) | Revision | Interview Engine | PROJ-33 | Deployed | [spec](interview-engine/PROJ-34-werkzeug-schreibabsichten-turnstore-port.md) | P2 | L | 0:0:1 |
| PROJ-35 | interviewAgent.ts entkernen (Conversation-Signals + server-only-Naht) | Revision | Interview Engine | PROJ-22 | Deployed | [spec](interview-engine/PROJ-35-interviewagent-entkernen.md) | P2 | M | 0:0:0 |
| PROJ-36 | ProcessStepsTable — Cluster-Aggregation als reines Modul | Revision | Dashboard & Output | PROJ-20 | Deployed | [spec](dashboard-output/PROJ-36-process-steps-table-cluster-aggregation.md) | P2 | S | 0:0:0 |
| PROJ-37 | Static-Prompt-Drift konsolidieren (Talker vs. Greeting/Reconnect) | Revision | Interview Engine | PROJ-22 | Deployed | [spec](interview-engine/PROJ-37-static-prompt-drift-konsolidieren.md) | P2 | S | 0:0:0 |
| PROJ-38 | Slot-Write-Encoding-Fix (Eval-Signal wiederherstellen) | Revision | Interview Engine | PROJ-27 | Deployed | [spec](interview-engine/PROJ-38-slot-write-encoding-eval-signal.md) | P1 | S | 0:0:0 |
| PROJ-39 | Eval-Judge-Parsing-Härtung (dialog_naturalness + slotDepth) | Revision | Interview Engine | PROJ-31 | Deployed | [spec](interview-engine/PROJ-39-eval-judge-parsing-haertung.md) | P1 | S | 0:0:1 |
| PROJ-40 | Eval-Instrument-Validierung + Versuchsplan | Revision | Interview Engine | PROJ-31 | Approved | [spec](interview-engine/PROJ-40-eval-instrument-validierung-versuchsplan.md) | P1 | L | 0:0:0 |
| PROJ-41 | Interview-Modell-Auswahl (OSS-Screening + EU-Prod-Route) | Revision | Platform | PROJ-9 | Blocked | [spec](platform/PROJ-41-interview-modell-auswahl.md) | P1 | L | — |
| PROJ-42 | Interview-Grenzfall-Robustheit (Wrap-up + Rollen-Guard) | Revision | Interview Engine | PROJ-22 | Approved | [spec](interview-engine/PROJ-42-interview-grenzfall-robustheit.md) | P0 | M | 0:1:1 |
| PROJ-43 | Elicitation-Reorientierung (AI-Treiber, Zahlen→Cards) | Revision | Interview Engine | PROJ-29 | Approved | [spec](interview-engine/PROJ-43-elicitation-reorientierung.md) | P1 | XL | 0:1:2 |
| PROJ-44 | Pipeline-Simplifikation (Analyst-vor-Talker + Legacy-Pfad) | Revision | Interview Engine | PROJ-22 | Approved | [spec](interview-engine/PROJ-44-pipeline-simplifikation.md) | P1 | XL | 0:2:0 |
| PROJ-45 | Schema-Konsolidierung + AI-Wert-Faktoren | Revision | Wissensbank | PROJ-25 | Deployed | [spec](wissensbank/PROJ-45-schema-konsolidierung-ai-wert-faktoren.md) | P1 | XL | 0:1:0 |
| PROJ-46 | Talker-Briefing-Konsolidierung (Judgment-Signale → Analyst) | Revision | Interview Engine | PROJ-22 | Approved | [spec](interview-engine/PROJ-46-talker-briefing-konsolidierung.md) | P1 | XL | 0:1:1 |
| PROJ-47 | Clarification-Card-Generierung entkoppeln (LLM-Teil: OpenItem/Qualitative) | Revision | Interview Engine | PROJ-43 | Roadmap | — | P2 | — | — |
| PROJ-48 | Fokus-Lock-Härtung (Bootstrap, Discovery-Exhausted-Guard, Talker-Zieltreue) | Revision | Interview Engine | PROJ-44 | Approved | [spec](interview-engine/PROJ-48-fokus-lock-haertung.md) | P1 | L | 0:0:1 |
| PROJ-49 | Prozess-Priorisierungsmechanik (KI-Relevanz-Bewertung entdeckter Prozesse) | Epic | Use Case Engine | — | Roadmap | — | P2 | — | — |
| PROJ-50 | Opener-Frage-Überarbeitung (Hauptaufgaben/Arbeitstag mischt zwei Antworten) | Revision | Interview Engine | PROJ-2 | Roadmap | — | P2 | — | — |
| PROJ-51 | Übergang vor Clarification Cards (kein abrupter Sprung nach Verabschiedung) | Extension | Interview Engine | PROJ-43 | Roadmap | — | P2 | — | — |
| PROJ-52 | Clarification-Card-Plausibilität (Schritt-Titel-Mehrdeutigkeit, Bucket-Passung) | Revision | Interview Engine | PROJ-43 | Roadmap | — | P2 | — | — |
| PROJ-53 | Analyst/Talker-Prompt-Audit (Inhalt/Struktur/Prägnanz/Konsistenz/Redundanz) | Revision | Interview Engine | PROJ-46 | Roadmap | — | P2 | — | — |

<!-- Add features above this line -->

## Next Available ID: PROJ-54

## Known Issues

> Bugs und technische Schulden, die kein eigenes Feature rechtfertigen. Vor dem nächsten Deploy prüfen ob noch offen.
>
> **Vollständig gelöste KIs (KI-1..17, 19, 20, 22, 23, 24, 27, 29, 30, 21, 25) sind verlustfrei nach [docs/known-issues-history.md](../docs/known-issues-history.md) archiviert** (2026-07-15, erweitert 2026-07-22 — KI-23/24/27; erweitert 2026-07-24 — KI-29/30 via PROJ-48, KI-21/25 via PROJ-43, im Joint-Gate PROJ-40/42/43/44/46/48 geschlossen, siehe Historie). Die lange KI-18-Fix-Historie (6 Versuche) ist ebenfalls 2026-07-24 in die Historie ausgelagert; KI-18 selbst bleibt offen (kondensierter Eintrag unten). Hier stehen nur offene KIs (KI-18, KI-26, KI-28, KI-31).

| ID | Severity | Beschreibung | Entdeckt in | Fix-Aufwand |
|----|----------|-------------|-------------|-------------|
| KI-26 | 🟡 Open | Rollen-Guard-Falschpositiv — eine normale (wenn ausweichende) Mitarbeiter-Antwort wird als `off_topic` klassifiziert. PROJ-44-QA-Eval it-support Turn 2: "15 bis 20 Tickets pro Tag. Zeitaufwand? Kommt drauf an." → statischer Redirect ("Dazu kann ich als Interviewer leider nichts beitragen — bleiben wir beim Prozessgespräch.") + **wortgleiche** Wiederholung der Turn-1-Frage. Da `off_topic` den synchronen Analyst kurzschließt (PROJ-44-Reihenfolge, [runInterviewTurn.ts:216](../src/services/runInterviewTurn.ts#L216)), wird der genannte Wert "15–20/Tag" in diesem Turn **nicht** extrahiert (erst Turn 3 nachgeholt). Ursache: Prefilter/Judge-Präzision in [roleGuard.ts](../src/services/roleGuard.ts) (PROJ-42, von PROJ-44 unverändert). → **PROJ-42** (Rollen-Guard-Präzision). | PROJ-44-QA-Eval 2026-07-17 | → PROJ-42 |
| KI-28 | 🟡 Open | Eval-Scorer fällt bei Judge-Call-Fehler still auf einen plausiblen Fallback-Score zurück, statt hart zu scheitern — Verstoß gegen die general.md-Regel „Eval-Preflight: Judge-API-Key validieren" ("Kein stiller Fallback-Score bei ungültigem Key"). Real aufgetreten während PROJ-44-QA-Runde 3 (2026-07-17): dem Anthropic-Account ging während eines laufenden `/eval:interview`-Laufs (buchhalter) das Guthaben aus, exakt beim Post-Run-`dialog_naturalness`-Judge-Call. `scoreDialogNaturalness` ([dialogNaturalness.ts:121](../src/services/__evals__/interview/scorers/dialogNaturalness.ts#L121)) fing den `AI_RetryError` ab und gab still `0.5` zurück (`[scorer:dialog_naturalness] judge call failed, returning 0.5`), statt den Lauf als invalide zu markieren — der generierte Report sah oberflächlich plausibel aus (Wert im gültigen Bereich). Der Standard-Preflight-Check dieser Runde (GET `/v1/models`) hatte 200 zurückgegeben, da dieser Endpunkt keine Kreditprüfung auslöst; ein `generateText`-artiger Call mit echtem Guthabenverbrauch ist der schärfere Test. Die eigentlichen Interview-Turns (inkl. `talkerGroundingGuard.ts`, das bereits nach KI-18s sechstem Fix-Versuch hart eskaliert statt still zu degradieren) waren zu diesem Zeitpunkt bereits vollständig und korrekt abgerechnet durchgelaufen — betroffen war ausschließlich der nachgelagerte Scorer. Kein PROJ-44-Code-Bug (Scorer-Infrastruktur), aber ein reales, während dieser QA beobachtetes Instrument-Risiko: ein künftiger Lauf mit ungültigem/leerem Judge-Key könnte einen falschen PASS erzeugen, ohne dass es auffällt. Empfehlung: `scoreDialogNaturalness` (und Geschwister-Scorer, die einen LLM-Judge nutzen) auf das bereits etablierte `talkerGroundingGuard.ts`-Muster härten (`console.error` + Lauf explizit als invalide markieren statt eines stillen Fallback-Werts). | PROJ-44-QA-Eval Runde 3, 2026-07-17 | — (kein Fix geplant, nur dokumentiert; Härtung wäre eigenes kleines Item) |
| KI-18 | 🟡 Open | **`talker_grounding_violations` nicht durchgehend 0** — Talker schreibt der Persona gelegentlich einen abgeleiteten/erfundenen Wert als Zitat zu (Fabrikation / Cross-Context-Konfusion / Einheiten-Umrechnung). Diffuses Muster unter der früheren Anker-Pflicht (E3.3), nicht ein eng umreißbarer Bug. **Vollständige Fix-Historie (6 Versuche 2026-06-27..07-11, Modell-Klärung, 142-Transkript-Bestandsaufnahme, Architektur-Doku-Fund) verlustfrei in [docs/known-issues-history.md](../docs/known-issues-history.md#ki-18--grounding-violations-fix-historie-archiviert-2026-07-24-ki-18-bleibt-offen) archiviert (2026-07-24).** Primäre Absicherung ist der Live-`talkerGroundingGuard.ts` (Cross-Vendor-Judge + Repair, Buffer-then-stream). **Bewertung 2026-07-24 (Joint-Gate):** über alle Eval-Läufe seit 2026-07-22 Median 0, nur 3 von ~19 Läufen mit genau 1 Violation — PROJ-46s Anker-Pflicht-Relaxierung (ADR-023) hat den Druck gesenkt, das Restmuster aber nicht eliminiert. Der Guard ist weiter **lasttragend** (fing im frischen it-support-Lauf 1 echte Violation ab und reparierte sie). → **KI-18 bleibt offen; Guard NICHT löschen** (Löschung bräuchte einen Guard-off-Vergleichslauf, den die aktuellen Daten nicht decken). Guard-Kosten-Trade-off (Judge-Call/Turn + kein Live-Streaming) vs. seltene Violation ist eine legitime spätere Produktentscheidung. | Eval 2026-06-27; Bewertung Joint-Gate 2026-07-24 | offen (Guard = Absicherung) |
| KI-31 | 🔴 Open (blockt E2E-Gate) | **E2E-Test-Harness kann keinen Supabase-Test-User anlegen** — `createTestUser` ([tests/helpers/createTestUser.ts:45](../tests/helpers/createTestUser.ts#L45)) scheitert am `admin.auth.admin.updateUserById`-Metadata-Update mit `invalid JWT: ... unrecognized JWT kid <nil> for algorithm ES256`. `createUser` (POST) gelingt mit demselben `sb_secret_`-Key, nur der `updateUserById`-Pfad (PUT `/admin/users/{id}`) scheitert — via Supabase-Auth-Logs bestätigt. Ursache: das Projekt „Meridian MVP" nutzt asymmetrische ES256-JWT-Signing-Keys (neue Key-Ära, `sb_publishable_`/`sb_secret_`), der Admin-Pfad bekommt einen Legacy-Token ohne `kid`. **Kein App-Code-Bug** (diese Session machte 0 `src/`-Änderungen; würde auf main identisch failen). Effekt: 31 E2E-Failures + 51 „did not run" (alle Auth-abhängig), 132 passed. Fix ist ein Infra-/Dashboard-Eingriff (Authentication → JWT Signing Keys prüfen; Approval-pflichtig), nicht `src/`. Blockt die general.md-Regel „100% grüne Tests inkl. E2E vor Deploy". Entdeckt im Joint-Gate-E2E-Lauf 2026-07-24. | Joint-Gate E2E-Lauf 2026-07-24 | Infra/Dashboard (JWT Signing Keys) |


> KI-3 (dialog_naturalness-Parsing) ✅ gelöst durch mains JSON-Judge (kein `Stufe: X`-Truncation mehr; Lauf 2026-06-21 echter 0.67-Score, kein Fallback). KI-4 (Skill-Doc) bleibt via PROJ-39 (SKILL.md-Fix). Beide waren als PROJ-39 getrackt; der Parser-Teil ist durch den Merge mit mains JSON-Variante supersediert.

## Build Order
PROJ-1 → PROJ-2 → PROJ-3 & PROJ-4 (parallel) → PROJ-5 → PROJ-6

> **Status-Banner (Joint-Gate 2026-07-24):** Etappe 2–5 sind abgeschlossen. PROJ-42/43/44/46/48 wurden im Joint-Gate PROJ-40/42/43/44/46/48 auf **Approved** gesetzt (PROJ-45 bereits Deployed 2026-07-22, PROJ-40 Approved). Die In-Progress-Build-Logs in Etappe 4/5 unten sind **historisch** — der kanonische Stand steht je Feature in der Spec + im jeweiligen ADR (ADR-021..026). Sie bleiben aus Thesis-Traceability-Gründen erhalten, sind aber kein aktueller Arbeitsstand mehr.

### Etappe 2 (Build-Backlog, ab 2026-06-16)
Schema zuerst (Fundament, blockt den Rest): PROJ-25 → PROJ-27 → PROJ-26.
Reihenfolge 2026-06-16 angepasst: PROJ-27 (stabile Schritt-IDs) vor PROJ-26 (getypte Kanten),
damit PROJ-26 S001-Format-Referenzen von Anfang an nutzen kann statt titel-basierter Zwischenlösung.
Darauf aufbauend: PROJ-28 (Extraktion) und PROJ-29 (Gesprächsführung).
Parallel und laufend mitmessend: PROJ-30 (Tiefe-Metrik) und PROJ-31 (Eval-Schärfung).
Vertagt (TF3): PROJ-32.

Hinweis: Die Bau-ADR zu PROJ-25 ist entschieden ([ADR-T016](../../meridian-ma/decisions/ADR-T016-prozesswissens-schema-integration.md),
2026-06-16): ein gemeinsames Schema mit getrennt getypter quantitativer `potenzial`-Facette im selben
Dokument (nicht zwei verknüpfte Ebenen); das bestehende Slot-Substrat wird behalten und erweitert
(nicht verworfen). Ziel-Schema: [`schemas/prozessschritt-schema.json`](../../meridian-ma/schemas/prozessschritt-schema.json)
+ [Spec v1.1](../../meridian-ma/knowledge-base/prozessschritt-schema-spec.md). `/write-spec PROJ-25`
realisiert dagegen, entscheidet die Architektur nicht neu. Die acht Einheiten bündeln 23 Einzel-Befunde
aus dem [Build-Backlog](../../meridian-ma/requirements/build-backlog-etappe2.md); jede Spec listet ihre
BL-E-Items und REQs (Traceability).

### Etappe 3 (Deepening, ab 2026-06-18)
Architektur-Review 2026-06-18 (`/improve-codebase-architecture`) fand vier Deepening-Kandidaten.
Gewählt und entschieden: PROJ-33 (Turn-Loop-Konsolidierung, [ADR-016](../docs/adr/ADR-016-interview-turn-seam-runinterviewturn.md)) —
`runInterviewTurn` als tiefes Modul, Prod-Route und Eval-Runner werden Adapter. Vertagt als ein
kohärenter Folge-Kandidat: PROJ-34 (Werkzeug-Schreibabsichten + TurnStore-Port für DB-freie Evals).
Weitere Kandidaten aus dem Review als Roadmap festgehalten: PROJ-35 (`interviewAgent.ts` entkernen —
#2+#3) und PROJ-36 (ProcessStepsTable Cluster-Aggregation, #4).
Specs folgen erst bei Bau-Start (je `/write-spec` mit Grilling); Begründungen in ADR-016.
PROJ-35 ist 2026-06-19 spezifiziert (Planned, [ADR-017](../docs/adr/ADR-017-interviewagent-zerlegung-server-only-naht.md)):
Zerlegung entlang der server-only-Naht, conversation-signals als tiefes Modul (`analyzeConversationSignals`,
Interface 9→1), Re-Export-Hub (#3) bewusst verworfen zugunsten Konsumenten-Migration.
PROJ-37 (Static-Prompt-Drift Talker vs. Greeting/Reconnect) wurde 2026-06-19 beim PROJ-35-Grilling
entdeckt: `STATIC_PROMPT` (interviewTalker) und `buildStaticPrompt()` (interviewAgent → createInterviewStream)
sind inhaltlich auseinandergelaufen. Out of Scope für PROJ-35 (reine Verschiebung, keine Prompt-Konsolidierung).

### Etappe 4 (Grenzfall-Robustheit, ab 2026-07-15)
PROJ-42 (Wrap-up + Rollen-Guard) und PROJ-43 (Elicitation-Reorientierung) aus der
Refactoring-Grundsatzentscheidung 2026-07-15 (realer Tim-Durchlauf). PROJ-42s BUG-2/3/5 sind
2026-07-16 gefixt und live verifiziert; dabei ein neuer Bug (BUG-6, doppelte Verabschiedung)
gefunden, der dieselbe Ein-Turn-Zustandsverzögerung wie BUG-1/BUG-4 als Root Cause hat.

**Reihenfolge 2026-07-16 umgekehrt + PROJ-44 spezifiziert:** PROJ-44 (Pipeline-Simplifikation:
Analyst synchron vor Talker, Quick-Extract raus, Legacy-Pfad weg) wird VOR PROJ-43 gebaut.
2026-07-16 nach `/write-spec` + `/grilling` spezifiziert (Planned,
[spec](interview-engine/PROJ-44-pipeline-simplifikation.md)). Schnitt-Entscheidung: **Option 1**
(schmaler Timing-Flip + Streichungen, sauber eval-attribuierbar) statt alle Änderungen in einem.
PROJ-44 behebt strukturell **BUG-1-Staleness + BUG-6** (beide Lag-Artefakte). NICHT in PROJ-44:
**BUG-4** (Methodik-Block-Gedächtnis, kein reines Lag-Artefakt) und die Judgment-Signal-Migration
ins Analyst-Briefing → neues Folge-Feature **PROJ-46** (Talker-Briefing-Konsolidierung, Requires
PROJ-44, auch: Audit der statischen Text-Ausgaben). BUG-1-Kalibrierung (`step_advance_ready` zu
großzügig) + Clarification-Cards-Zuverlässigkeit bleiben in PROJ-44s Eval-Gate-Verantwortung
(measure-first). Die drei heutigen Analyst-Einstiegspunkte werden dabei zu einem Deep-Module-Einstieg
konsolidiert. PROJ-42 bleibt bis PROJ-46 In Review (BUG-4 offen).

**PROJ-44 architektiert 2026-07-16** (`/architecture` + `/grilling`, Status Architected,
[ADR-021](../docs/adr/ADR-021-analyst-synchron-vor-talker-timing-amendment.md) Timing-Amendment zu
ADR-011 D2, überholt ADR-019s Proposed-Freshness-Signal). Kern-Entscheidungen: **ein** `runAnalyst`-
Aufruf/Turn, Modus aus `ctx.phase` (`closing`-Modus = intern zwei fokussierte Sub-Pässe Backfill+Online,
Trigger `phase==='closing'` ohne Marker); `runAnalyst` gibt `{ briefing, toolCalls, stepTracker }` zurück
(ersetzt „reload"); `background()` → `after(finalize)` = extractAndEmbed+onCompleted (schließt fire-and-
forget-Lücke), Analyst-Ergebnis via `meta.analyst`; synchroner Analyst in voller Konfig (Korrektheit vor
Latenz, „Analysiere…"-Indikator); Fail-Safe vetoet `soft_confirm`, lässt `hard_stop` zu.
`extractAndEmbed` bleibt per-Turn (post-Completion-Verlagerung = eigener Kandidat). Nächster Schritt:
`/backend` (Bau) — Reihenfolge Rollen-Guard → runAnalyst → checkLifecycle → decideNextPhase →
shouldInjectClosingProbe → Talker → after(finalize).

**PROJ-44 Backend gebaut 2026-07-17** (Status In Progress) — Design 1:1 umgesetzt, keine Abweichung.
`interviewAgent.ts`+`interviewQuickExtract.ts` gelöscht, `interviewTools.ts` neu (buildTools-Extraktion),
`interviewAnalyst.ts` auf einen `runAnalyst`-Einstiegspunkt konsolidiert (online/closing/failure-window,
Backfill-Sub-Pass läuft vor Online-Sub-Pass — teilen sich eine Session/einen Commit), `runInterviewTurn.ts`
komplett umgebaut (`background()`→`finalize()`, Analyst-Ergebnis via `meta.analyst`), Start/Reconnect-Routen
umgestellt, `quick`-WriteSource + totes `loadStepTracker` entfernt. Netto **−533 Zeilen** production code
trotz neuer Datei (Details im Backend-Abschnitt der Spec). `tsc --noEmit` + volle Suite (888/889, 1
Skip vorbestehend) grün. Zwei gezielte Regressionstests statt Tim-Nachbau (Orchestrator erhält frischen
`stepTracker`/`analystBriefing` statt Vorturn-Snapshot — die von ADR-021 benannte gemeinsame Wurzel von
BUG-1 und BUG-6). **Noch offen (gehört zu `/qa`):** Live-`/eval:interview`-Lauf (Pflicht-Gate vor
`Approved`, general.md), manueller adversarialer Durchlauf, Latenz-Delta-Messung, Start/Reconnect
curl-Verifikation. **Nächster Schritt:** `/qa PROJ-44`.

### Etappe 5 (Schema-Konsolidierung, ab 2026-07-21)

**PROJ-45 Backend gebaut 2026-07-21** (Status In Progress) — ADR-025 (D1–D6) umgesetzt. Migration angewendet
(`process_steps.schritt_daten jsonb` ersetzt 10 Legacy-Spalten, kein Backfill). `StepEntry` auf einen generischen
`SchemaSlotBase<T>`-Typ konsolidiert (ersetzt `SlotValue`/`TaziteSlot`/`TaziteSlotArray`/`GovernanceSlot`);
bewusste Abweichung vom Tech-Design-Wortlaut: bestehende Feldnamen (`value`/`quote`/`confidence`/`nicht_befund_typ`,
`title`, `frequency_per_month` etc.) beibehalten statt eines zusätzlichen Deutsch-Renames — reduziert Blast-Radius
ohne die AC-Kernanforderung (vier Slot-Typen → einer) zu verfehlen, Details + Begründung im Backend-Abschnitt der
Spec. `governance`/`friction_tools`/`pain_point_primary` entfernt, `friction_points`→`reibungspunkte` (jetzt
aktives O-Feld), `process_steps`→`teilschritte`, `record_governance`+`update_walkthrough_data`-Tools entfernt
(teilschritte jetzt regulärer `record_slot`-Slot). Neue Felder `aufgabentyp`/`risiko_schwere`/`ausloeser` (aktiv
erfragt) + `standardisierungsgrad`/`informationsdichte` (Analyst-Klassifikation, keine eigene Frage). Einheiten-
Unabhängigkeit für Häufigkeit/Dauer (`einheit`-Feld + deterministische Code-Umrechnung, adressiert KI-18s
größte dokumentierte Einzelursache strukturell). `schemaValidator.ts`+`schemaConformanceRate`-Scorer gelöscht
(maßen Konformität zu einem Schema, von dem die App laut ADR-025 D7 bewusst abweicht). Neuer
`src/lib/schrittDatenView.ts`-Adapter hält alle Downstream-Konsumenten (useCaseEngine, Aggregation, Reports, UI)
bei unveränderter eigener Logik. Zwei vorbestehende, durch die Typvereinheitlichung aufgedeckte Bugs mitgefixt
(`interviewOrchestrator.ts` falsche Coverage-Funktion, `slotDepth.ts` Quote-Nullability). Test-Fixture-Reparatur
(~19 Dateien, Subagent) + 3 selbst gefixte Tests mit echten `schritt_daten`-Assertion-Anpassungen abgeschlossen.
**Endstand: `tsc --noEmit` sauber, 66/66 Testdateien / 807 Tests grün (1 Skip vorbestehend).** Noch offen vor
`/qa PROJ-45`: Pflicht-`eval:interview`-Lauf (general.md, neue Slots noch nicht live gegen ein echtes LLM
verifiziert).

**PROJ-43 architektiert 2026-07-23** (`/architecture`, Status Architected). Kern-Entscheidung nach mehreren
Grilling-Runden mit dem Nutzer: AC3/AC4/AC5 (Häufigkeit/Dauer/Fehlerquote) werden über einen neuen,
vollständig deterministischen Card-Mechanismus gelöst statt über strengere Analyst-Prompt-Anweisungen —
die Lücken-Prüfung läuft genau einmal, am Entscheidungspunkt (Zeit-Timeout oder `discovery_exhausted`),
nicht bei jedem Turn ab Closing wie der heutige LLM-Mechanismus. Fragetext und Bucket-Optionen sind für
diese Runde fest templatiert (kein LLM-Aufruf, kein Text-zu-Zahl-Zuordnungsrisiko). Richtungssignal (AC2)
wird direkt am jeweiligen Zahlen-Feld gespeichert, analog der bestehenden `einheit`-Angabe aus PROJ-45 —
kein neues Zwischenspeicher-Feld nötig, beantwortet die in der Ausgangs-Spec offen gelassene Bridge-Frage.
AC7 (Pro-Vorgang vs. Aggregat) braucht kein neues Datenfeld, reine Gesprächsdisziplin plus eindeutigerer
Card-Wortlaut bei fortbestehender Ambiguität. Bewusst NICHT in dieser Runde: der bestehende LLM-basierte
Mechanismus für `OpenItemCards`/`QualitativeCards` (inkl. `entscheidungslogik`) bleibt unangetastet, inklusive
seiner bekannten Per-Turn-Scan-Ineffizienz und unveränderten Zuverlässigkeit — ausgegliedert als eigenes
Folge-Feature **PROJ-47** (Roadmap), damit diese Spec-Runde beherrschbar bleibt und kein Akzeptanzkriterium
diese Verbesserung ohnehin verlangt. Nächster Schritt: **`/backend PROJ-43`**.

**PROJ-43 Backend gebaut 2026-07-23** (Status In Progress) — Design 1:1 umgesetzt. Talker-Prompt (Forced-
Choice raus, Zwei-Schritt-Sequenz + Treiber-Framing + Dauer-Disambiguierung rein), neues `SchemaSlotNumber.
richtung` (dritter `record_slot`-Schreibmodus, füllt den Slot bewusst nicht), neuer deterministischer Card-
Mechanismus (`clarificationCards.ts`, ersetzt die LLM-Generierung für frequency/duration/error_rate_percent
vollständig), Zwei-Wege-Card-UI (`clarificationBuckets.ts` + `ClarificationCards.tsx`). Dabei ein
unabhängiger, in der Spec nicht vorhergesehener AC5-Root-Cause-Fund: die alte Card-Antwort-Verarbeitung
schrieb gegen `process_steps.schritt_daten`, das für ein laufendes Interview zu diesem Zeitpunkt noch gar
nicht existiert (entsteht erst danach aus `interview_state.step_tracker`) — Card-Antworten wurden dadurch
strukturell nie persistiert, unabhängig von der M-4-Generierungs-Unzuverlässigkeit. Fix (neues
`clarificationAnswers.ts`, jetzt von Prod-Route UND Eval-Runner geteilt) macht AC5s „code-identischer
Completion-Pfad"-Anspruch erstmals tatsächlich wahr. `tsc --noEmit` sauber, 853/853 Tests grün (43 neu).
Bewusst nicht umgesetzt: Komplexitätsreduktion (`usedFillerPhrases`/`conversationSignals.ts`) — braucht
laut Spec einen echten Eval-Lauf vor dem Löschen, kein Pflicht-`/eval:interview`-Lauf in dieser Runde
(folgt dem PROJ-44/45-Muster: Backend liefert + unit-testet, Live-Eval-Nachweis ist `/qa`-Gate). Details
im Backend-Abschnitt der Spec. Nächster Schritt: **`/qa PROJ-43`** (inkl. Pflicht-Eval-Lauf + manueller
UI-Durchlauf für die Zwei-Wege-Card-UI, general.md/PROJ-43-Spec).

## Architecture Notes

### Service-Layer-Constraint (gilt ab PROJ-4)

KI-Logik (LLM-Calls via Claude, Embedding-Calls, Vektor-Operationen) gehört in dedizierte Service-Dateien unter `src/services/` — nicht direkt in API Routes oder Server Components.

Konkret für PROJ-4: Extraktions-Logik in `src/services/extraction.ts`, Embedding-Logik in `src/services/embeddings.ts`. API Routes rufen nur diese Services auf.

Quelle: Architektur-Review 2026-05-19 gegen "Web Application Development & Tech Stacks 2026"-Leitfaden.
