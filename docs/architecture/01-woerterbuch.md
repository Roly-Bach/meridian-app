# Wörterbuch — Component-Namen ↔ Code

**Zweck:** bildet die Doku-eigene Namensgebung ab, nicht Fachsprache — dafür ist [`CONTEXT.md`](../../CONTEXT.md) zuständig. Hier steht, welcher C4-Component-Name welchem Code-Pfad entspricht. Grundlage für den Doku-Baum ab Schritt 3 (Level 1–4).

**Component** (C4-Begriff, Level 3) ≠ **Cluster** (Fachbegriff, `process_clusters`, siehe `CONTEXT.md`) — bewusst getrennt gehalten, siehe dortige Kollisions-Notiz.

---

## Interview (Gruppierung, kein eigenständiges Component)

| Component | Code |
|---|---|
| **Interview-Verwaltung** | `app/api/interviews/*` **außer** `[id]/reextract/route.ts` (siehe Prozessbasis), `components/interviews/*`, `components/pdf/InterviewReport.tsx`, `services/reportGenerator.ts`, `app/dashboard/page.tsx` |
| **Interview-Oberfläche** | `components/interview/*`, `hooks/{useVoiceInput,useInterviewStream}.ts`, `lib/audio/pcm-worklet.ts`, `app/interview/[token]/page.tsx`, `app/api/interview/[token]/voice-token/route.ts` |
| **Interview-Engine** | `services/{runInterviewTurn,interviewOrchestrator,interviewTalker,interviewAnalyst,interviewAgent,interviewQuickExtract,interviewTypes,conversationSignals,talkerPrompt,talkerGroundingGuard,stepIdentity}.ts`, `app/api/interview/[token]/{chat,start,reconnect,route}.ts`. `interviewAgent.ts` bündelt zwei Dinge mit unterschiedlicher Erreichbarkeit — `buildTools()` aktiv (Analyst+QuickExtract importieren es), `createInterviewStream()` aktiv via `start/route.ts` (jeder Kaltstart), aber tot via `reconnect/route.ts` (`isReconnect`-Zweig unerreichbar, siehe `00-vorgeschlagene-anpassungen.md` #3) — bleibt trotzdem eine Datei/ein Component, keine Aufteilung nötig für die Zuordnung. |
| **Interview-State** | `services/turnStore/*` (`port`, `intents`, `applyIntent`, `supabaseTurnStore`, `pgliteTurnStore`, `memoryTurnStore`), `services/slotWriteTrail.ts` (Observability-Emitter, ADR-015), `services/slotConflictResolver.ts` (Konfliktauflösung — **umklassifiziert 2026-07-13**, vorher fälschlich unter Interview-Engine: Laufzeit-Importeure sind ausschließlich `turnStore/applyIntent.ts` + der Legacy-Pfad `interviewAgent.ts`, keiner aus dem aktiven Engine-Kern, siehe `03-komponenten-uebersicht.md` Fund 1). Zwei quellenlose Testdateien ohne Source-Pendant gehören ebenfalls hierher (**umgezogen 2026-07-13** von Interview-Engine, da sie Konfliktauflösung/Race-Conditions testen, nicht Dialogführung): `services/stepRevisionIntegrity.test.ts`, `services/slotWriteRace.test.ts` — beide testen `interviewSemantic`/`slotConflictResolver`. |
| **Synthetische Evaluation** | `services/__evals__/interview/*` (82 Dateien: Runner, Scorer, Personas, Replay, Validation) |

## Prozessbasis

`services/{extraction,processEnrichment,processClustering,embeddings,schemaValidator,substepGenerator}.ts`, `schemas/prozessschritt-schema.json`, `lib/processStepsAggregation.ts`, `components/ProcessStepsTable.tsx`, `app/api/{interview/[token]/clarification,interviews/[id]/reextract,knowledge/search,process-steps/*}`, `app/dashboard/process-steps/page.tsx`

`schemaValidator.ts` hier statt bei Synthetischer Evaluation einsortiert, obwohl aktuell nur der Eval-Scorer `schemaConformanceRate.ts` es importiert (siehe Diskussion) — Zuordnung nach Schema-Besitz, nicht nach aktuellem Aufrufer.

## Use-Case-Engine (KI-Maßnahmen)

`services/{useCaseEngine,useCaseInsights}.ts`, `app/api/use-cases/*`, `components/{UseCaseBoardClient,UseCaseCard,UseCaseSheet,MetricsGrid,RoiBreakdown,ParticipantList}.tsx`, `app/dashboard/use-cases/{page.tsx,roadmap/page.tsx}`

## Infrastruktur

`lib/{supabase,supabase-server,supabase-admin,database.types,supabase-types,llm-provider,ratelimit,langfuse,utils}.ts`, `middleware.ts`, `instrumentation.ts`, `app/auth/*`, `app/login/*`, `app/signup/*`, `test/setup.ts`

Eigener Unterabschnitt **Shell** (technisches Grundgerüst, gehört fachlich zu keinem einzelnen Component, umschließt alle drei Dashboard-Bereiche gemeinsam): `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `app/dashboard/layout.tsx`, `components/dashboard/SidebarNav.tsx`

## Geteiltes Fundament — bewusst kein eigenständiges Component

`components/ui/*` (shadcn, vendored, "nie neu implementieren"), `hooks/{use-mobile,use-toast}.tsx` (vendored shadcn-Hooks). Werden als Abhängigkeit erwähnt, bekommen aber keinen Deep-Dive.

## Crosscutting Concept (arc42), kein einzelnes Component

`services/_telemetry.ts` — Langfuse-Tracing-Wiring, importiert von Modulen aus praktisch allen Components (Interview-Engine, Prozessbasis, Use-Case-Engine). Gehört in den arc42-Crosscutting-Abschnitt des Doku-Baums, nicht zwanghaft einem einzelnen Component zugeordnet.

`services/interviewSemantic.ts` — geteilte Typen/Konstanten/Utilities (`POTENZIAL_SLOT_NAMES`, `TAZITE_SLOT_NAMES`, `tokenJaccardNorm`, Normalisierungs-Helfer). **Umklassifiziert 2026-07-13**, vorher fälschlich unter Interview-Engine geführt: 35 Importeure quer durch Interview-Engine, Interview-State, Prozessbasis (`processEnrichment.ts`, `schemaValidator.ts`) und ~15 Eval-Scorer (siehe `03-komponenten-uebersicht.md` Fund 2) — verhält sich wie ein zweites Crosscutting Concept, nicht wie Interview-Engine-eigener Code.

## Offene Mikro-Zuordnungen (niedrige Konfidenz, noch nicht entschieden)

- `app/api/interview/[token]/objects/route.ts` — liefert `knowledge_objects` eines Interviews, ohne Service-Layer-Umweg (reiner Supabase-Read). Käme sowohl als "einfache Dokumentation eines Interviews" (→ Interview-Verwaltung, analog PDF-Report) als auch nach Datenherkunft (`knowledge_objects` → Prozessbasis) infrage. Vorläufig Prozessbasis, nach Datenherkunft-Regel wie `schemaValidator`.

## Vollständigkeits-Check (2026-07-12)

Alle 276 Dateien aus `00-ist-stand.md` einzeln gegen die obigen Buckets geprüft (Ordner für Ordner, Zuordnung wo nötig per Import-Grep verifiziert statt vermutet). Dabei gefunden und korrigiert: `reextract/route.ts` stand doppelt (Interview-Verwaltung + Prozessbasis) — gehört nach Importen eindeutig zu Prozessbasis, aus Interview-Verwaltung entfernt. `slotWriteTrail.ts` fehlte komplett — gehört nach Importen zu Interview-State, nicht Interview-Engine. Zwei quellenlose Tests fehlten — ergänzt bei Interview-Engine. Keine weiteren Lücken oder Doppelzuordnungen gefunden.

## Korrektur-Runde (2026-07-13) — systemweiter Import-Graph (`03-komponenten-uebersicht.md`)

Der Vollständigkeits-Check vom 2026-07-12 prüfte jede Datei einzeln gegen die Buckets, aber nicht die *Kanten zwischen* den Buckets — das deckte drei Fehlzuordnungen erst beim Aggregieren des systemweiten Import-Graphs (`madge`) auf, nicht beim datei-für-datei-Screening:

- `slotConflictResolver.ts`: Interview-Engine → Interview-State (nur 3 Importeure systemweit, davon 2 in Interview-State, keiner im aktiven Engine-Kern).
- `interviewSemantic.ts`: Interview-Engine → zweites Crosscutting Concept (35 Importeure quer durch fast alle Components).
- `stepIdentity.ts`: **bleibt** Interview-Engine — ursprünglich (fälschlich) als Lösch-Kandidat vermutet ("nur 1 Importeur, Legacy"), nach Prüfung der tatsächlichen Erreichbarkeit von `interviewAgent.ts` (dessen `buildTools()` aktiv von Analyst/QuickExtract genutzt wird) als aktiv bestätigt. Importer-count allein ist kein verlässliches Lösch-Signal, wenn der einzige Importeur selbst mehrere, unterschiedlich erreichbare Exporte bündelt.

Zwei quellenlose Tests (`stepRevisionIntegrity.test.ts`, `slotWriteRace.test.ts`) folgten `slotConflictResolver.ts` nach Interview-State um (testen Konfliktauflösung/Race-Conditions, nicht Dialogführung — Zuordnung nach Verhalten, nicht nach ursprünglichem Nachbar-Import).
