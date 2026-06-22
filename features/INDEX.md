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
| PROJ-9 | LLM Provider Optimierung | Feature | Platform | — | Zurückgestellt | [spec](platform/PROJ-9-llm-provider-optimierung.md) | P1 | — | — |
| PROJ-10 | Access Control & Shared Workspace | Feature | Platform | — | Deployed | [spec](platform/PROJ-10-access-control-shared-workspace.md) | P0 | — | — |
| PROJ-11 | Interview PDF Report | Feature | Dashboard & Output | — | Deployed | [spec](dashboard-output/PROJ-11-interview-pdf-report.md) | P1 | — | — |
| PROJ-12 | Rate Limiting | Feature | Platform | — | Deployed | [spec](platform/PROJ-12-rate-limiting.md) | P1 | — | — |
| PROJ-13 | LLM Observability & Tracing | Feature | Platform | — | Deployed | [spec](platform/PROJ-13-llm-observability-tracing.md) | P1 | M | 0:0:2 |
| PROJ-14 | Embedding-Modell Auswahl | Extension | Wissensbank | PROJ-4 | Deployed | → PROJ-20 | P1 | — | — |
| PROJ-15 | CSP Hardening | Feature | Platform | — | Blocked | [spec](platform/PROJ-15-csp-hardening.md) | P1 | — | — |
| PROJ-16 | Supabase Hardening + Dependency Hygiene | Feature | Platform | — | Planned | [spec](platform/PROJ-16-supabase-hardening.md) | P1 | — | — |
| PROJ-17 | Adaptive Eval-Harness + Start-Endpoint | Feature | Interview Engine | — | Deployed | [spec](interview-engine/PROJ-17-adaptive-eval-harness-start-endpoint.md) | P1 | M | 0:0:2 |
| PROJ-18 | Prozessschritt-Deduplication | Feature | Wissensbank | PROJ-5 | Deployed | → PROJ-20 | P1 | M | 0:0:2 |
| PROJ-19 | Knowledge-Informed Interviewing | Extension | Interview Engine | PROJ-2 | Zurückgestellt | — | P2 | — | — |
| PROJ-20 | Prozessableitungs-Pipeline | Epic | Wissensbank | — | Deployed | [spec](wissensbank/PROJ-20-prozessableitungs-pipeline.md) | P0 | — | 0:0:0 |
| PROJ-21 | Eval-Foundation für Modell- und Architektur-Vergleich | Revision | Interview Engine | PROJ-17 | Deployed | [spec](interview-engine/PROJ-21-eval-foundation-modell-architektur-vergleich.md) | P1 | M | 0:0:0 |
| PROJ-22 | Dual-Loop Interview Engine (ADR-011) | Revision | Interview Engine | PROJ-2 | Deployed | [spec](interview-engine/PROJ-22-dual-loop-interview-engine.md) | P1 | L | 0:2:5 |
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
| PROJ-34 | Werkzeug-Schreibabsichten + TurnStore-Port (DB-freie Evals) | Revision | Interview Engine | PROJ-33 | Architected | [spec](interview-engine/PROJ-34-werkzeug-schreibabsichten-turnstore-port.md) | P2 | L | — |
| PROJ-35 | interviewAgent.ts entkernen (Conversation-Signals + server-only-Naht) | Revision | Interview Engine | PROJ-22 | Deployed | [spec](interview-engine/PROJ-35-interviewagent-entkernen.md) | P2 | M | 0:0:0 |
| PROJ-36 | ProcessStepsTable — Cluster-Aggregation als reines Modul | Revision | Dashboard & Output | PROJ-20 | Roadmap | — | P2 | — | — |
| PROJ-37 | Static-Prompt-Drift konsolidieren (Talker vs. Greeting/Reconnect) | Revision | Interview Engine | PROJ-22 | Roadmap | — | P2 | — | — |
| PROJ-38 | Slot-Write-Encoding-Fix (Eval-Signal wiederherstellen) | Revision | Interview Engine | PROJ-27 | Deployed | [spec](interview-engine/PROJ-38-slot-write-encoding-eval-signal.md) | P1 | S | 0:0:0 |
| PROJ-39 | Eval-Judge-Parsing-Härtung (dialog_naturalness + slotDepth) | Revision | Interview Engine | PROJ-31 | Deployed | [spec](interview-engine/PROJ-39-eval-judge-parsing-haertung.md) | P1 | S | 0:0:1 |

<!-- Add features above this line -->

## Next Available ID: PROJ-40

## Known Issues

> Bugs und technische Schulden, die kein eigenes Feature rechtfertigen. Vor dem nächsten Deploy prüfen ob noch offen.

| ID | Severity | Beschreibung | Entdeckt in | Fix-Aufwand |
|----|----------|-------------|-------------|-------------|
| KI-1 | ✅ Resolved | ~~Bestehende `step_tracker`-Records haben string-kodierte Slots; PROJ-38 fix-forward, kein Backfill~~ → gelöst durch mains Read-Compat `parseJsonIfString` ([interviewSemantic.ts](../src/services/interviewSemantic.ts)), integriert im Merge 2026-06-21. Parst Altdaten beim Lesen, kein Backfill nötig. Lauf 2026-06-21: `slot_coverage 1.0` | Eval 2026-06-19 | — (gelöst 2026-06-21) |
| KI-2 | Low | Knowledge-Object-Tool-Duplikation: mehrere Records pro distinktem Tool (19 Records / 4 Tools im buchhalter-Lauf) | Eval 2026-06-19 | Dedup auf KO-Ebene |
| KI-5 | ✅ Resolved | ~~`dialog_naturalness`-Gate `≥ 0.70` vs. Mapping {0.33/0.67/1.0}: nur Stufe 3 passiert~~ → gelöst durch mains PROJ-31 (Gate auf `≥ 0.65` gesenkt, [runner.ts](../src/services/__evals__/interview/runner.ts)), integriert im Merge 2026-06-21. Lauf 2026-06-21: `dialog_naturalness 0.67 ≥ 0.65` → **PASS** | Eval 2026-06-20 | — (gelöst 2026-06-21) |
| KI-6 | Low | `/eval-interview`-Skill Schritt-4 (manuelle PASS-Kriterien) und das automatische Runner-Gate (`runner.ts`) divergieren: die manuellen Kriterien kennen die `dialog_naturalness`-Gate-Bedingung nicht (Gate jetzt `≥ 0.65`), daher kann ein Lauf nach Schritt 4 PASS, nach Runner-Gate FAIL sein | Eval 2026-06-20 | Schritt-4-Kriterien an Runner-Gate angleichen |
| KI-7 | Medium | Talker-Halluzination wird von `hallucination_rate` nicht erfasst: Metrik greift nur auf Extraktions-/Schema-Ebene (evidence_quote-Kontamination), nicht auf konversationelle Faktentreue. Buchhalter-Lauf 2026-06-22 Turn 2: Agent erfand falsche Prämisse („Du hast vorhin 20 Rechnungen erwähnt") obwohl Persona in Turn 1 keine Zahl nannte — `hallucination_rate = 0` trotzdem. Falsches Vertrauen ins Signal. | Eval 2026-06-22 | Eigenes Eval-Signal „Talker-Faktentreue gegen History" (Judge prüft Agent-Fragen gegen bisherige Persona-Aussagen) |

> KI-3 (dialog_naturalness-Parsing) ✅ gelöst durch mains JSON-Judge (kein `Stufe: X`-Truncation mehr; Lauf 2026-06-21 echter 0.67-Score, kein Fallback). KI-4 (Skill-Doc) bleibt via PROJ-39 (SKILL.md-Fix). Beide waren als PROJ-39 getrackt; der Parser-Teil ist durch den Merge mit mains JSON-Variante supersediert.

## Build Order
PROJ-1 → PROJ-2 → PROJ-3 & PROJ-4 (parallel) → PROJ-5 → PROJ-6

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

## Architecture Notes

### Service-Layer-Constraint (gilt ab PROJ-4)

KI-Logik (LLM-Calls via Claude, Embedding-Calls, Vektor-Operationen) gehört in dedizierte Service-Dateien unter `src/services/` — nicht direkt in API Routes oder Server Components.

Konkret für PROJ-4: Extraktions-Logik in `src/services/extraction.ts`, Embedding-Logik in `src/services/embeddings.ts`. API Routes rufen nur diese Services auf.

Quelle: Architektur-Review 2026-05-19 gegen "Web Application Development & Tech Stacks 2026"-Leitfaden.
