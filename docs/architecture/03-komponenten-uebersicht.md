# 03 — Komponenten-Übersicht (C4 Level 3, systemweit)

**Zweck:** Die Aggregationsebene zwischen Level 2 (2 Container) und den einzelnen Component-Deep-Dives. Zeigt alle Components innerhalb des Next.js-App-Containers und wie sie tatsächlich voneinander abhängen — nicht behauptet, sondern aus dem Import-Graph abgeleitet. Component-Deep-Dives (mit eigenem internen Übersichtsdiagramm je Component) folgen in eigenen Dateien ab `04-*`.

## Methodik (Grounding)

Kanten sind **nicht** aus dem Gedächtnis gezeichnet. Ablauf:

1. `npx madge --json --ts-config tsconfig.json --extensions ts,tsx --exclude '\.test\.(ts|tsx)$' src` — vollständiger Datei-Import-Graph, 187 Dateien (Rest sind Tests, per Exclude draußen).
2. Jede Datei per Skript gegen die Zuordnungsregeln aus [`01-woerterbuch.md`](01-woerterbuch.md) gemappt (0 unmapped Dateien nach Korrektur zweier Skript-Bugs — `database.types.ts`/`use-toast.ts` erst falsch, dann korrekt erkannt).
3. Datei-Kanten auf Component-Ebene aggregiert, Kanten *innerhalb* derselben Component verworfen (die zeigen die internen Übersichtsdiagramme der Deep-Dives, nicht dieses Dokument).

Rohes Skript + Zwischenergebnis bei Bedarf reproduzierbar, nicht Teil des Repos (Scratch-Artefakt).

## Diagramm

Gezeigt werden nur Kanten zwischen den 7 fachlichen Components. **Infrastruktur**, **Geteiltes Fundament** und das Crosscutting Concept `_telemetry` sind bewusst ausgeblendet — praktisch jede Component importiert davon (DB-Client, Rate-Limiting, UI-Bausteine), das Einzeichnen aller dieser Kanten hätte nur Rauschen erzeugt und die eigentlich interessanten Business-Logic-Kanten verdeckt. Diese drei bleiben trotzdem "unsichtbare Basisabhängigkeit jeder Component" — siehe `01-woerterbuch.md`.

```mermaid
graph LR
    subgraph GRP["Interview (Gruppierung)"]
        IV["Interview-Verwaltung<br/>15 Dateien"]
        IO["Interview-Oberfläche<br/>14 Dateien"]
        IE["Interview-Engine<br/>15 Dateien"]
        IS["Interview-State<br/>8 Dateien"]
        SE["Synthetische Evaluation<br/>40 Dateien"]
    end
    PB["Prozessbasis<br/>17 Dateien"]
    UC["Use-Case-Engine<br/>15 Dateien"]

    IO -->|"4×"| IE
    IE -->|"11×"| IS
    IE -->|"3×"| PB
    IS -->|"5×"| IE
    SE -->|"8×"| IE
    SE -->|"3×"| IS
    SE -->|"4×"| PB
```

*Kantenzahlen Stand nach Korrektur-Runde 2026-07-13 (`slotConflictResolver.ts` → Interview-State, `interviewSemantic.ts` → Crosscutting, siehe unten) — vor der Korrektur zeigte diese Kanten IE→IS 10×, IS→IE 13×, PB→IE 2× zusätzlich, alle über die zwei jetzt umklassifizierten Dateien.*

*Nachtrag nach Cleanup-Tranche 2026-07-14 (`00-vorgeschlagene-anpassungen.md` #20/#21, madge erneut gelaufen): IE→PB 10×→**3×** (`RawExtraction`/`KnowledgeObjectType` nach `interviewSemantic.ts` verschoben strich 4 Kanten, `cosineSim` nach `embeddings.ts` verschoben strich weitere 3; die verbleibenden 3× sind ausschließlich `runInterviewTurn.ts`s `defaultProdPorts()`-dynamische-Importe — echte Verhaltens-Kopplung, kein Typ-Nebeneffekt, siehe Eintrag #22 in `00-vorgeschlagene-anpassungen.md`, bewusst nicht Teil dieser Tranche). IS→PB 6×→**0×** (dieselbe `RawExtraction`-Verschiebung — `turnStore/applyIntent.ts` importierte den Typ vorher aus `extraction.ts`, jetzt aus `interviewSemantic.ts`; die Kante existiert nach madge-Neuprüfung nicht mehr). Prozessbasis 18→17 Dateien (`embeddings.ts` raus, jetzt Crosscutting neben `_telemetry.ts`/`interviewSemantic.ts`, siehe `01-woerterbuch.md`).*

## Kanten im Detail

| Von → Nach | Beispiel-Import | Charakter |
|---|---|---|
| Interview-Oberfläche → Interview-Engine | `app/interview/[token]/page.tsx` → `services/interviewTypes.ts` | Typen für den Client-State, keine Business-Logik |
| Interview-Engine → Interview-State | `services/interviewAgent.ts` → `services/turnStore/port.ts` (Ports, erwartete Richtung) + `services/slotConflictResolver.ts` (der Legacy-Pfad importiert das jetzt in Interview-State geführte Modul zurück) | Größtenteils erwartet, ein Teil ist die Legacy-Pfad-Rückkante |
| Interview-Engine → Prozessbasis | `services/runInterviewTurn.ts` → `services/extraction.ts`/`processEnrichment.ts`/`processClustering.ts` (alle 3 nur in `defaultProdPorts()`s dynamischen Importen) | Echte Verhaltens-Kopplung (Post-Turn-Pipeline-Trigger), nicht Typ-Nebeneffekt — siehe `00-vorgeschlagene-anpassungen.md` #22 |
| Interview-State → Interview-Engine | `services/turnStore/intents.ts` → `services/interviewTypes.ts` | Typen für Intent-Payloads, keine Business-Logik mehr (vor der Korrektur lief die Hauptmasse dieser Kante über `slotConflictResolver`/`interviewSemantic`, beide jetzt umklassifiziert) |
| Synthetische Evaluation → Interview-Engine/-State/Prozessbasis | `services/__evals__/interview/evalStore.ts` → diverse | Erwartet — der Eval-Runner treibt echte Turns/Extraktion |

**Ohne Kanten zu anderen Components:** Interview-Verwaltung (reines CRUD auf `interviews`, keine Business-Logik-Berührung) und Use-Case-Engine (liest `process_steps`/`process_clusters` ausschließlich direkt über Supabase, kein einziger Code-Import von Prozessbasis-Dateien — die Kopplung läuft komplett über die gemeinsame Datenbank, nicht über den Import-Graph. Für madge unsichtbar, für die Architektur trotzdem real).

## Drei Funde — Klärung 2026-07-13, alle umgesetzt

(Ergänzt um einen vierten Fund unten: Klärung 2026-07-14, Cleanup-Tranche.)

1. **`slotConflictResolver.ts`**: Interview-Engine → Interview-State. Nur 3 Importeure systemweit (`interviewAgent.ts` Legacy-Pfad, `turnStore/applyIntent.ts`, `turnStore/intents.ts`), kein Importeur aus dem aktiven Engine-Kern; die Datei heißt "Konfliktauflösung" — genau Interview-States eigene Aufgabenbeschreibung. **Umgesetzt** in `01-woerterbuch.md`, inkl. Umzug der zwei zugehörigen quellenlosen Tests.
2. **`interviewSemantic.ts`**: Interview-Engine → zweites Crosscutting Concept neben `_telemetry.ts`. 35 Importeure quer durch praktisch alle Components. **Umgesetzt** in `01-woerterbuch.md`.
3. **`stepIdentity.ts`**: Nutzerauftrag war "prüfen, ob Legacy-Code + `stepIdentity.ts` gelöscht werden kann". **Ergebnis: nein, nicht löschbar** — ursprüngliche Vermutung (nur 1 Importeur → Legacy → löschbar) war falsch, importer-count allein war irreführend, ohne zu prüfen ob `interviewAgent.ts` selbst erreichbar ist. Tatsächlich bündelt `interviewAgent.ts` zwei Dinge: `buildTools()` (aktiv, `interviewAnalyst.ts` UND `interviewQuickExtract.ts` importieren es; der `register_step`-Tool darin ruft `stepIdentity.ts`s `classifyStepSimilarity`/`generateMissingEmbeddings` bei jeder Schritt-Registrierung auf — aktive Deduplizierungslogik, Linie zu KI-2) und `createInterviewStream()` (aktiv via `start/route.ts` bei **jedem** Interview-Kaltstart, tot via `reconnect/route.ts` — dort nachweislich unerreichbar, `history` endet strukturell immer mit `role:'assistant'`, KI-22-Kommentar in `reconnect/route.ts:98-108`). Bleibt bei Interview-Engine im Wörterbuch — keine Korrektur nötig, nur die Lösch-Prämisse war falsch. Tatsächlich toter Code (klein, sicher entfernbar) + eine größere Anschlussfrage (sollte die `isStart`-Begrüßung über `runInterviewTurn.ts` statt über den separaten Pfad laufen, verwandt mit PROJ-37 Static-Prompt-Drift) als Eintrag 3 in [`00-vorgeschlagene-anpassungen.md`](00-vorgeschlagene-anpassungen.md) festgehalten, noch nicht umgesetzt.
4. **Nutzeranliegen "Interview-Gruppierung möglichst unabhängig von Prozessbasis" (2026-07-14, Cleanup-Tranche #20/#21):** vor der Tranche 10 IE→PB-Dateikanten, grep-Kante-für-Kante geprüft — 4 reine Typ-Importe (`RawExtraction`, zentral in `InterviewContext.extractionsLog` verbaut) + 3 reine Vektor-Mathe-/Embedding-Utility-Importe (`generateEmbedding`/`cosineSim` für interview-internes Live-Dedup, kein fachlicher Bezug zu Prozessbasis' Cluster-Aufgabe) + 3 echte Verhaltens-Kopplung (`runInterviewTurn.ts`s `defaultProdPorts()`). **Umgesetzt:** `RawExtraction`/`KnowledgeObjectType` nach `interviewSemantic.ts`, `cosineSim` nach `embeddings.ts` (jetzt selbst Crosscutting Concept) — beide ohne Verhaltensänderung. Ergebnis, madge-verifiziert: IE→PB 10×→3×, IS→PB 6×→0× (dieselbe `RawExtraction`-Verschiebung traf auch `turnStore/applyIntent.ts`s Typ-Import). Die verbleibenden 3× IE→PB sind die bereits unter Fund 3/`00-vorgeschlagene-anpassungen.md` #22 dokumentierte echte Verhaltens-Kopplung — bewusst nicht Teil dieser Tranche, wartet auf eigene Design-Entscheidung (Trigger-Verantwortung umkehren: Prozessbasis sollte den Post-Completion-Trigger selbst kontrollieren, nicht `runInterviewTurn.ts`).
