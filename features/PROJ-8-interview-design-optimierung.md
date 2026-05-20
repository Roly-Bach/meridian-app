# PROJ-8: Interview-Design Optimierung

## Status: Roadmap
**Created:** 2026-05-20
**Last Updated:** 2026-05-20

## Dependencies
- Requires: PROJ-2 (Interview Engine Backend) — Agent-Service, System Prompt
- Requires: PROJ-3 (Interview UI) — Chat-Interface

## Kontext

### Wo sind die Agent Operating Procedures?

Die gesamte Gesprächssteuerung des KI-Interviewers ist aktuell in einer einzigen Funktion `buildSystemPrompt()` in [src/services/interviewAgent.ts:27](../src/services/interviewAgent.ts#L27) eingebettet. Es gibt kein separates Dokument, das die Interviewlogik beschreibt oder begründet.

**Problem:** Die Methodik ist implizit und nicht auf wissenschaftlicher Grundlage dokumentiert. Phase-Übergänge, Fragestrategien und Gesprächsregeln sind direkt im Code ohne Begründung.

## User Stories

- Als Entwickler möchte ich die Interview-Methodik in einem dedizierten Dokument (`docs/agent-procedures.md`) lesen können, damit ich Änderungen am System Prompt nachvollziehen kann.
- Als Berater möchte ich, dass der Interview-Agent wissenschaftlich fundierte Fragetechniken anwendet, damit ich qualitativ hochwertigeres Prozesswissen extrahiere.
- Als Mitarbeiter möchte ich, dass das Interview einem natürlichen Gesprächsfluss folgt, damit ich mich nicht befragt fühle sondern gehört.

## Acceptance Criteria

### Dokumentation: `docs/agent-procedures.md`

- [ ] Neue Datei `docs/agent-procedures.md` erstellt als "Single Source of Truth" für Agent-Verhalten
- [ ] Dokument enthält: wissenschaftliche Grundlagen, Phasenbeschreibung mit Begründung, Fragekatalog pro Phase, Transition-Regeln, Qualitätskriterien
- [ ] `buildSystemPrompt()` in `interviewAgent.ts` verweist auf dieses Dokument (Kommentar)

### Wissenschaftliche Grundlagen (Research-Phase)

Relevante Methoden zu evaluieren und anzupassen für einen KI-gestützten Kontext:

- [ ] **TODS (Task-Oriented Dialogue System)** — strukturierte Dialogführung mit State Tracking; bereits in Out-of-Scope von PROJ-2 erwähnt, jetzt explizit einplanen
- [ ] **Critical Incident Technique (CIT)** nach Flanagan (1954) — Fokus auf konkrete Ereignisse statt abstrakte Aussagen; besonders wertvoll für Prozess-Extraktion
- [ ] **Cognitive Task Analysis (CTA)** — Methode zur Wissenserhebung von Experten; ermöglicht tiefes Verständnis impliziter Entscheidungsprozesse
- [ ] **SECI-Modell** (Nonaka & Takeuchi) — Explizitierung von tacit knowledge; Grundlage für Wissensmanagement
- [ ] **Appreciative Inquiry** — Wertschätzende Gesprächsführung; erhöht Gesprächsbereitschaft

### Verbesserungen am System Prompt

- [ ] **Fragekatalog pro Phase** im System Prompt verankert — konkrete Beispielfragen statt genereller Beschreibung
- [ ] **Konkret-Abstrakt-Prinzip**: Agent fragt zuerst nach konkreten Beispielen ("Erzählen Sie mir von einem typischen Montag..."), nicht nach abstrakten Prozessen
- [ ] **Schweige-Toleranz**: Agent akzeptiert kurze Pausen ohne sofort nachzufragen
- [ ] **Paraphrasierung**: Agent paraphrasiert Antworten vor Folgefragen um Verständnis zu signalisieren
- [ ] **Tiefbohr-Regeln**: bei vagen Antworten gezielt nachbohren mit Technik des "Laddering" (Warum ist das so? Was passiert dann?)
- [ ] **Wrap-Up-Qualität**: Zusammenfassung am Ende enthält konkrete Prozessschritte, nicht nur Themen
- [ ] **Halluzinations-Guard**: Agent vermeidet Interpretationen, fragt stattdessen nach ("Habe ich das richtig verstanden, dass...")

### Agent Operating Procedures Dokument — Struktur

```markdown
# Agent Operating Procedures — Meridian Interview Agent

## 1. Wissenschaftliche Grundlagen
## 2. Interview-Ziel und Erfolgskriterien
## 3. Phasenmodell (intro / exploration / deepdive / wrap_up)
### 3.1 Intro
### 3.2 Exploration
### 3.3 Deepdive
### 3.4 Wrap-Up
## 4. Fragetechniken
## 5. Transition-Regeln (wann Phase wechseln)
## 6. Qualitätskriterien für Antworten
## 7. Umgang mit schwierigen Situationen
```

## Edge Cases

| Szenario | Erwartetes Verhalten |
|---|---|
| Mitarbeiter antwortet sehr kurz ("Ich weiß nicht") | Agent verwendet Konkretisierungstechnik, kein direktes Nachhaken |
| Mitarbeiter weicht vom Thema ab | Agent folgt kurz dem Faden, kehrt dann sanft zurück |
| Mitarbeiter erwähnt sensibles Thema (Konflikt, Fehler) | Agent bleibt neutral-wertschätzend, dokumentiert ohne Bewertung |

## Technical Requirements

- Keine Schema-Änderungen erforderlich
- Änderungen ausschließlich an `src/services/interviewAgent.ts` → `buildSystemPrompt()`
- Neues Dokument: `docs/agent-procedures.md`
- Die Änderungen am Prompt müssen mit bestehenden E2E-Tests kompatibel sein

## Out of Scope

- Voice-TTS Ausgabe des Agenten
- Mehrsprachige Interviews (aktuell nur Deutsch)
- Adaptive Fragestrategie via separatem ML-Modell (wäre PROJ-11+)
- Automatische Qualitätsbewertung einzelner Turns
