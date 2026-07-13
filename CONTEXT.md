# Meridian

Meridian erhebt implizites Prozesswissen von Mitarbeitern durch KI-geführte Interviews, strukturiert es in einer Prozessbasis und leitet daraus priorisierte KI-Maßnahmen mit ROI-Berechnung ab.

## Language

### Interview-Ablauf

**Interview**:
Eine Erhebungssitzung zwischen dem System und einem Mitarbeiter, bestehend aus einer Folge von Turns. Endet mit Interview-Status `completed` und speist die Prozessbasis.
_Avoid_: Session, Gespräch

**Turn**:
Ein einzelner Austausch (Mitarbeiter-Input + Agent-Antwort) innerhalb eines Interviews, atomar als Paar persistiert.
_Avoid_: Message, Runde

**Interview-Status**:
Der grobe Lebenszyklus-Zustand eines Interviews: `created` → `active` → `completed`. Genau ein Wert pro Interview.
_Avoid_: Phase, State — beide meinen etwas anderes, siehe unten

**Phase**:
Der feingranulare Gesprächsschritt innerhalb eines aktiven Interviews (`intro`, `process_loop`, `walkthrough_step`, `slot_completion`, `coverage_check`, `wrap_up`, `clarification`). Wechselt mehrfach innerhalb eines einzigen Interview-Status `active`.
_Avoid_: Status (ohne Präfix), State

**Interview-State**:
Die Persistenz- und Konfliktauflösungs-Schicht, die den akkumulierten Erhebungsstand eines Interviews (Step-Tracker, Slots, Topics, Extraktions-Log) speichert und konkurrierende Schreibzugriffe auflöst. Ist selbst kein Zustandswert, sondern der Mechanismus, der Zustand persistiert.
_Avoid_: TurnStore, Turn Store — bisheriger Code-/Arbeitsname, wird abgelöst; State ohne Interview-Präfix, wegen Verwechslungsgefahr mit Phase/Interview-Status

**Talker**:
Die nutzersichtbare Hälfte der Dual-Loop-Interview-Engine (ADR-011) — generiert den sichtbaren Antworttext.
_Avoid_: Chatbot

**Analyst**:
Die asynchron im Hintergrund laufende Hälfte der Dual-Loop-Interview-Engine — extrahiert strukturiertes Wissen (Schritte/Slots), erzeugt keinen sichtbaren Text.
_Avoid_: Extractor

### Prozessbasis

**Prozessschritt** (Schritt):
Eine erfasste, strukturierte Einheit eines Mitarbeiter-Arbeitsablaufs (ID-Format `S001` etc.), die atomare Einheit der Prozessbasis. "Schritt" ist die Kurzform (u.a. im JSON-Schema), "Prozessschritt" die Langform in Prosa — beide gültig, keine Präferenz.
_Avoid_: Prozess (ein Prozess besteht aus mehreren Prozessschritten, nicht dasselbe)

**Schritt-Status**:
Der Erfassungsfortschritt EINES Prozessschritts im Step-Tracker: `exploring` → `walkthrough` → `done`. Nicht zu verwechseln mit Interview-Status, der gilt für das ganze Interview, nicht pro Schritt.
_Avoid_: Status ohne Präfix, State

**Slot**:
Ein einzelner quantifizierbarer oder qualitativer Datenpunkt zu einem Prozessschritt (z.B. Häufigkeit, Dauer), mit Konfidenz-Wert und Beleg-Zitat.
_Avoid_: Feld, Field

**Prozessbasis**:
Die aggregierte, strukturierte Sammlung aller erfassten Prozessschritte über alle Interviews hinweg, angereichert um Potenzial- und Governance-Facetten. Zentrales Datenprodukt von Meridian (PRD-Aspekt ii: KI-Potenzial-Analyse).
_Avoid_: Wissensbank — abgelöster Vorgänger-Begriff (alte Domain-Bezeichnung)

**Cluster**:
Eine Gruppe ähnlicher Prozessschritte, die von unterschiedlichen Mitarbeitern/Interviews berichtet und für die Maßnahmen-Ableitung zusammengeführt werden (mit Pro-Teilnehmer-ROI-Breakdown). Rein fachlicher Begriff.
_Avoid_: Component — das ist ein Architektur-Doku-Begriff (siehe `docs/architecture/`-Wörterbuch), keine fachliche Bedeutung, nicht mit diesem Cluster-Begriff vermischen

**Wissensobjekt**:
Ein aus dem Interview-Transkript extrahierter Pain Point oder Tool-Hinweis. Eigenständig von einem Prozessschritt, kann aber einem zugeordnet sein.
_Avoid_: Knowledge Object — Code-/Tabellenname (`knowledge_objects`), im Fließtext "Wissensobjekt" bevorzugen

### KI-Maßnahmen

**Use Case**:
Ein heuristisch abgeleiteter, ROI-bewerteter Automatisierungskandidat, gebunden an einen Prozessschritt oder Cluster (`services/useCaseEngine.ts`, Regeln R1–R8/P1–P4/C1–C3). Technischer/Code-naher Begriff — Domain "Use Case Engine", DB-Tabelle `use_cases`, PRD-Wortlaut. Für sich genommen unspezifisch: könnte im allgemeinen Sprachgebrauch auch eine nicht-KI-bezogene Prozessverbesserung meinen.

**KI-Maßnahme**:
Dieselbe Sache wie Use Case, aber begrifflich geschärft: macht explizit, dass es nicht um Prozessverbesserung im Allgemeinen geht, sondern gezielt um Fälle, in denen KI-Anwendungen Mehrwert schaffen können. Bevorzugt in Prosa/Produkt-Text, wo diese Abgrenzung wichtig ist (u.a. Thesis-Kontext). "Use Case" bleibt der Begriff in Code/DB/bestehenden Specs — kein Ersetzen, sondern situative Präzisierung.
_Avoid_: — kein technisches Duplikat, dieselbe Sache mit geschärfter Bedeutung

---

_Wird inkrementell erweitert, sobald neue Begriffe im Gespräch auftauchen — kein Anspruch auf vollständige PRD-Abdeckung in einem Durchgang._
