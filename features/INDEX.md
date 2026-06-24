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
| KI-2 | ✅ Resolved | ~~Knowledge-Object-Tool-Duplikation: mehrere Records pro distinktem Tool (19 Records / 4 Tools im buchhalter-Lauf)~~ → gelöst 2026-06-22: Root Cause war `deduplicateKnowledgeObjects()` in [extraction.ts](../src/services/extraction.ts) — hardcoded `.eq('type', 'pain_point')`, `tool`-Type wurde nie gededuped. Generalisiert auf alle `ALLOWED_TYPES` mit typ-spezifischem Text-Feld (`content.name` für tool, `content.description` für pain_point). 3 neue Unit-Tests, 630/631 Tests grün. **Follow-up 2026-06-23:** Eval-Lauf zeigte weiterhin Duplikate bei Namens-Varianten ("SAP FI" / "SAP FI-Modul") — der Match-Gate war ein absoluter `levenshtein > 8`-Cutoff, zu starr für längere Namen. Ersetzt durch `isTextMatch()` (Substring-Containment + längen-normalisiertes Lev-Ratio ≤0.4). Fängt Präfix-/Suffix-Drift unabhängig von Stringlänge. Fängt NICHT echte Synonyme ohne gemeinsamen Substring (z.B. "Finanzbuchhaltungssystem" vs. "SAP FI") — bräuchte Extraktions-Zeit-Kanonisierung, bewusst nicht gemacht (Restrisiko dokumentiert). 2 neue Unit-Tests. | Eval 2026-06-19 | — (gelöst 2026-06-22, Follow-up 2026-06-23) |
| KI-5 | ✅ Resolved | ~~`dialog_naturalness`-Gate `≥ 0.70` vs. Mapping {0.33/0.67/1.0}: nur Stufe 3 passiert~~ → gelöst durch mains PROJ-31 (Gate auf `≥ 0.65` gesenkt, [runner.ts](../src/services/__evals__/interview/runner.ts)), integriert im Merge 2026-06-21. Lauf 2026-06-21: `dialog_naturalness 0.67 ≥ 0.65` → **PASS** | Eval 2026-06-20 | — (gelöst 2026-06-21) |
| KI-6 | ✅ Resolved | ~~`/eval-interview`-Skill Schritt-4 (manuelle PASS-Kriterien) und das automatische Runner-Gate (`runner.ts`) divergieren: die manuellen Kriterien kennen die `dialog_naturalness`-Gate-Bedingung nicht (Gate jetzt `≥ 0.65`), daher kann ein Lauf nach Schritt 4 PASS, nach Runner-Gate FAIL sein~~ → gelöst 2026-06-22: Schritt 4 in [eval-interview/SKILL.md](../.claude/skills/eval-interview/SKILL.md) übernimmt jetzt den exakten `runner.ts`-Gate-Code (alle 5 Schwellenwerte) statt eigener manueller Kriterien; Hinweis ergänzt, den Block bei jedem Schwellenwert-Change in `runner.ts` nachzuziehen | Eval 2026-06-20 | — (gelöst 2026-06-22) |
| KI-7 | ✅ Resolved | ~~**Mitarbeiter-Interview-Link bricht für echte (nicht eingeloggte) Mitarbeiter:** `/interview/[token]` und `/api/interview/[token]/chat` werden von `src/middleware.ts` zu `/login` redirected~~ → gelöst 2026-06-22: `/interview/` und `/api/interview/` (mit Trailing-Slash, um `/api/interviews` plural NICHT mitzutreffen) zu `PUBLIC_ROUTES` ergänzt. Token-Auth läuft pro Route eigenständig (z.B. `chat/route.ts` prüft `access_token` + Expiry selbst), nicht über Supabase-Session — Middleware-Block war nie nötig. Curl-verifiziert in Dev + Production-Build, E2E-Regression grün. | QA-Regression PROJ-15/16, 2026-06-22 | — (gelöst 2026-06-22) |
| KI-8 | ✅ Resolved | ~~**Geschützte `/api/*`-Routes redirecten unauthentifiziert zu `/login` (307) statt 401 JSON zurückzugeben** — falscher Contract für programmatische Clients (z.B. Tests, künftige externe API-Konsumenten); via Redirect-Follow sah ein POST ohne Auth wie ein 200 aus~~ → gelöst 2026-06-22 in `src/middleware.ts`: Pfade unter `/api/` bekommen bei fehlender Session direkt `NextResponse.json({error:'Unauthorized'}, {status:401})` statt Redirect. Page-Routes verhalten sich unverändert (Redirect zu `/login`). | QA-Regression PROJ-15/16 (`tests/PROJ-3-interview-ui.spec.ts`), 2026-06-22 | — (gelöst 2026-06-22) |
| KI-9 | 🟡 Signal gebaut, Live-Verifikation offen | ~~Talker-Halluzination wird von `hallucination_rate` nicht erfasst: Metrik greift nur auf Extraktions-/Schema-Ebene (evidence_quote-Kontamination), nicht auf konversationelle Faktentreue. Buchhalter-Lauf 2026-06-22 Turn 2: Agent erfand falsche Prämisse („Du hast vorhin 20 Rechnungen erwähnt") obwohl Persona in Turn 1 keine Zahl nannte — `hallucination_rate = 0` trotzdem. Zweite Reproduktion 2026-06-23 Turn 13 (wortgleich zum in `talkerPrompt.ts` Z.43 dokumentierten Verbots-Beispiel "Du hast vorhin 1200 Minuten erwähnt").~~ → 2026-06-23: neuer Scorer [talkerFactualGrounding.ts](../src/services/__evals__/interview/scorers/talkerFactualGrounding.ts) — Cross-Vendor-Judge liest komplettes Transkript, sucht Agent-Referenzen auf frühere Persona-Aussagen ("Du hast vorhin X erwähnt") und prüft ob X tatsächlich in einem vorherigen Mitarbeiter-Turn steht. Neue Score `talker_grounding_violations` (Ziel 0), in `runner.ts` verdrahtet (Frontmatter, Report-Tabelle, Langfuse-Push, Aggregat-Report). Noch NICHT Teil des PASS/FAIL-Gates (reine Beobachtungsmetrik wie `anchoring_violations`). 8 neue Unit-Tests (Parser + Mock-Judge), reproduziert den 1200-Minuten-Fall im Test. **Offen:** noch kein Live-Eval-Lauf mit echtem Judge gefahren — nächster `/eval-interview`-Lauf muss zeigen, ob die Metrik den realen Fall greift. | Eval 2026-06-22, 2026-06-23 | — (Signal gebaut 2026-06-23, Live-Verifikation offen) |
| KI-10 | ✅ Resolved | ~~`overwrite_churn` ist verfälscht: `computeTrailMetrics` ([runner.ts](../src/services/__evals__/interview/runner.ts) Z.262) filtert `source !== 'analyst'`, die echten Analyst-Labels heißen aber `analyst_online` / `analyst_catchup`. Dadurch zählen absichtliche Analyst-Verfeinerungen als Churn. Effekt: gemeldete churn ≈ 0.52–0.57, echter Quick-Extract-Churn nur ~0.02–0.04. Die PROJ-34-Neutralitäts-Baseline „≈0.38" basiert auf dieser Fehlzählung.~~ → gelöst 2026-06-23: Filter auf `!event.source?.startsWith('analyst')` geändert (matched jetzt `analyst`, `analyst_online`, `analyst_catchup`). 667 Tests grün (2 vorbestehende PGlite-Failures unverändert, kein Zusammenhang). Hinweis: nächster Eval-Lauf muss `overwrite_churn`-Baseline neu ziehen, „≈0.38" aus PROJ-34 ist obsolet. | Eval 2026-06-22 (PROJ-34) | — (gelöst 2026-06-23) |
| KI-11 | ✅ Resolved | ~~Eval-Lauf 2026-06-23 06:39 crashte auf Turn 24 mit `runInterviewTurn: interview ... not found`, im Eval-Report als „Supabase JWT-Clock-Skew" dokumentiert (gleiche Fehlerklasse wie frühere `JWT issued at future`-Vorfälle).~~ → Diagnose korrigiert 2026-06-23: Supabase Auth-Logs (`get_logs auth`, letzte 24h) zeigen **keinen** JWT-Fehler — die „JWT-Clock-Skew"-Theorie war eine unverifizierte Übernahme aus einem älteren Vorfall. Echte Ursache: [supabaseTurnStore.ts](../src/services/turnStore/supabaseTurnStore.ts) `loadInterview()` schluckte jeden Fetch-Error (inkl. transienter `TypeError: fetch failed`, gleiche Klasse wie die 3× Extraction-Fehler auf Turn 22) und gab `null` zurück — ununterscheidbar von einer echt fehlenden Zeile. [runInterviewTurn.ts:151](../src/services/runInterviewTurn.ts#L151) wertet `null` als "not found" und crasht hart. Fix: `withRetry()`-Helper (2 Retries, Backoff) in `loadInterview`, `insertTurn`, `completeInterview` — die drei Stellen auf dem kritischen Completion-Pfad. 3 neue Unit-Tests für `withRetry`, alle Tests grün. | Eval 2026-06-23 | — (gelöst 2026-06-23) |
| KI-12 | Medium | `dedup_slot_coverage`-Gate (`≥ 0.75`) ist der dominante reale FAIL-Grund über die Buchhalter-Lauf-Historie (10 Läufe 2026-06-22/23: 6 PASS / 3 FAIL / 1 PARTIAL), nicht durch KI-10/11/2 berührt. Wiederkehrendes Muster: dritter Prozess (meist spät im Gespräch entdeckt, z.B. Mahnlauf) bleibt bei `walkthrough` statt `done` — Interview erreicht `soft_confirm`-Lifecycle-Ende, bevor alle O-Slots für den dritten Prozess erhoben sind. Betroffen: 2026-06-22-00-11 (0.70), 2026-06-23-15-57 (0.70). Ungeklärt ob Ursache Turn-Budget (`MAX_TURNS=35`, `maxDurationMinutes=30`), Orchestrator-Phasenlogik (späte Prozess-Entdeckung verkürzt verbleibende Turns) oder Talker-Effizienz beim dritten Prozess ist — noch nicht tief diagnostiziert, nur als wiederkehrendes Muster über mehrere Läufe identifiziert. | Eval 2026-06-22, 2026-06-23 (über 10-Lauf-Historie identifiziert) | Diagnose offen — vermutlich M (Root-Cause-Analyse + ggf. Orchestrator-Anpassung) |

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
