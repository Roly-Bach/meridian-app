# ADR-006: Interview-Engine — Technische Schulden & Eval-Findings 2026-05-26

**Status:** Proposed (2026-05-26, erweitert 2026-05-26)
**Author:** lyas53
**Repository:** Roly-Bach/meridian-app
**Auslöser:** Validierungs-Eval nach ADR-005-Umsetzung — `docs/evals/interview/2026-05-25-buchhalter-andy-meyer.md`
**Erweitert durch:** IT-Support-Eval — `docs/evals/interview/2026-05-26-it-support.md`
**Referenz-Baseline:** `docs/evals/interview/2026-05-25-buchhalter.md` (Eval vor ADR-005, Auslöser für ADR-005)
**Supersedes:** Ergänzt ADR-005 (2026-05-25), ersetzt ihn nicht

---

## Context

Der Eval-Lauf mit Andreas Meier (Buchhalter-Persona) hat ADR-005 ausgelöst. Nach Umsetzung der ADR-005-Entscheidungen wurde ein Validierungslauf mit der gleichen Persona unter geändertem Namen (Andy Meyer) durchgeführt. Der Lauf besteht die Pass-Kriterien, zeigt aber zwei Kategorien offener Probleme:

**Residual-Schwächen aus ADR-005:** Mehrere Entscheidungen (D3, D4, D7, D9, D10) sind im Prompt entweder nicht wirksam genug formuliert oder decken Grenzfälle nicht ab, die im Validierungslauf sichtbar wurden.

**Neu identifizierte technische Schulden:** Code-Review der Interview-Engine deckte sieben strukturelle Probleme auf — von Race Conditions über blockierende I/O bis zu fehlendem Token-Lifecycle-Management.

ADR-005-Entscheidungen, die im Validierungslauf korrekt umgesetzt waren: Du-Anrede durchgehend (D1), kein Agenten-Name (D2), kein Greeting-Repeat in Turn 2 (D3 — partiell, s. Befund B), aktive Prozessauswahl durch Agenten (D4), Wrap-up-Puffer vor coverage_check (D5), Stundensatz nicht abgefragt (D6), `rule_based`-Klassifikation korrekt (D8), kein leerer Stream (D12).

### Befunde Eval-Analyse (P0/P1/P2/P3)

**A (P0) — Premature Interview Closure**
`complete_interview` wird gleichzeitig mit der Abschlussfrage im selben Turn aufgerufen. Die Antwort des Mitarbeiters auf die Abschlussfrage wird nie empfangen. Im Andy-Meyer-Lauf: Mahnprozess in Turn 14 erwähnt, aber API bereits geschlossen — Prozessschritt nicht im step_tracker. D5/ADR-005 (Wrap-up-Puffer) adressiert nur den Übergang in `coverage_check`, nicht die finale Sequenz.

**B (P1) — D3/ADR-005 nicht wirksam**
Turn 2 (Andy Meyer): *"Hallo Andy. Schön, dass du dir die Zeit nimmst."* — identisches Muster wie Andreas Meier Turn 2. Opener-Wiederholung trotz D3-Anweisung. System-Prompt-Constraint zu abstrakt formuliert.

**C (P1) — D10/ADR-005-Lücke: Spannenangaben**
D10 regelt unsichere Einzelwerte ("ich würde schätzen"), nicht Spannen ("16 bis 24 Stunden"). Agent übernimmt stillschweigend oberes Ende: 1440 min statt ~1200 min Mittelwert. Betrifft Monatsabschluss in beiden Evals.

**D (P1) — data_sources Slot unzuverlässig**
Rechnungsprüfung (Andy Meyer): `data_sources = —` obwohl Persona in Turn 2 explizit E-Mail, SAP FI, DocuWare nannte. Ursache: `register_step`-Call erfolgt bevor die Datenquellen vollständig besprochen wurden. Kein Slot-Audit vor `complete_interview`.

**E (P2) — D4/ADR-005: Begründung bei Prozessauswahl fehlt**
D4 schreibt vor: "begründet kurz warum — typisch ein Satz." Turn 2 Andy Meyer: *"lass uns direkt mit der Rechnungsprüfung starten"* ohne Begründung.

**F (P2) — D7/ADR-005: Übergangsmuster nicht abgedeckt**
Turn 9 Andy Meyer: *"Lass uns den Fokus kurz auf den zweiten Bereich verschieben"* — funktional identisch mit dem verbotenen *"Lassen Sie uns nun den nächsten Aspekt beleuchten"*. Themenübergänge fehlen in der D7-Verbotsliste.

**G (P3) — D9/ADR-005: Narrativität zu schwach**
Persona liefert in Turn 2–3 weiterhin vollständig strukturierte Antworten mit allen Slot-Werten. D9 enthält die Ausnahme "unaufgefordertes Nennen bleibt erlaubt" — diese hebelt die Constraint für quantitative Werte komplett aus.

**H (P1) — Du-Instruction überschrieben durch "Herr"-Kontext** *(IT-Support-Eval 2026-05-26)*
ADR-005 D1 ("Du als Standard") greift nicht wenn die Persona mit Nachnamen + "Herr" adressiert werden kann. Im buchhalter-andy-meyer-Lauf (Vorname: Andy) war D1 korrekt. Im IT-Support-Lauf (Michael Braun) nutzt der Agent durchgehend "Sie" + "Herr Braun" — Turn 1: "Hallo Herr Braun", Turn 2: "Schön Sie kennenzulernen", alle Folge-Turns. Das Modell inferiert aus dem Nachnamen einen formalen Gesprächskontext und überschreibt die System-Prompt-Anweisung "Kein Sie." Die Anweisung ist zu abstrakt formuliert und enthält kein Negativbeispiel für den Herr/Frau-Fall.

**I (P1) — Neuer Prozess in Abschlussantwort nicht aufgenommen** *(IT-Support-Eval 2026-05-26)*
In Turn 14 antwortet Michael auf die Abschlussfrage mit: "Software-Freigaben. Das nervt. Muss immer zum IT-Leiter, dauert bis 3 Tage." — ein expliziter Prozess mit Pain-Point-Signal. Der Agent schließt das Interview sofort ab ohne nachzufragen ob dieser Prozess noch aufgenommen werden soll. Abgrenzung zu Befund A: Befund A regelt den Sequenz-Bug (complete_interview im selben Turn wie die Abschlussfrage). Befund I ist inhaltlich: auch nach korrekter Sequenz würde der Agent eine neue Prozessnennung in der Abschlussantwort nicht als Explorations-Signal erkennen.

**J (P2) — rule_based-Klassifikation bei gemischter Regelbasierung** *(IT-Support-Eval 2026-05-26)*
Michael sagt explizit: "Regelbasiert — halb halb. Wiki-Fälle ja, Rest nein." — ein gemischter Prozess mit Standard-Workflow für bekannte Fälle und situativer Entscheidung bei neuen Fällen. Der Agent klassifiziert `rule_based = false`. ADR-005 D8 lautet: "rule_based=true wenn der Prozess einer definierten Reihenfolge folgt — auch wenn es Ausnahmen gibt." Die Instruction deckt den "halb-halb"-Fall nicht explizit ab; das Modell bewertet den situativen Anteil stärker als den regelbasierten Anteil.

### Befunde Codebase-Analyse (technisch)

**1 — Prompt Caching fehlt**
`buildSystemPrompt()` wird jeden Turn vollständig neu aufgebaut und gesendet (`src/services/interviewAgent.ts:127`). Statischer Anteil (Gesprächsführungsregeln, Tool-Instruktionen, Phasenmodell, Verbotslisten): ~70 % des Prompts, identisch über alle Turns. Dynamischer Anteil (timerMinutes, stepTracker, extractionsLog): ~30 %, Turn-spezifisch. Token-Kosten statischer Anteil: ~1500–2000 Token pro Turn.

Anthropic AI SDK v6: `cache_control: { type: 'ephemeral' }` auf System-Messages unterstützt. Gemini: Context Caching API existiert, aber nicht nativ im AI SDK abstrahiert — erfordert `CachedContent`-Objekt + Referenz via `providerOptions`, eigenes TTL-Management.

**2 — Extraktion blockiert Response-Abschluss**
`extractAndEmbed()` in `onFinish` awaited (`route.ts:173`). Vercel-Function bleibt offen bis Extraktion + Embedding abgeschlossen. Jina-Embedding: ~300–500 ms zusätzlich pro Turn. Mitarbeiter sieht "Agent schreibt…" obwohl Text längst fertig ist. `enrichProcessSteps` und Clustering laufen bereits fire-and-forget — Extraktion ist inkonsistent dazu.

**3 — Agent max. 1 Tool-Call vor Text**
`stopWhen`-Logik (`interviewAgent.ts:554–558`): stoppt wenn `steps.length >= 2` oder `last.text.trim().length > 0`. Agent kann `register_step` + `record_slot` nicht im selben Turn aufrufen — braucht zwei Turns. Führt zu unnötig langen Gesprächsverläufen und verpassten Slots in engem Zeitfenster.

**4 — formatExtractionsLog: redundante process_step-Einträge**
`formatExtractionsLog()` (`interviewAgent.ts:107–110`) gibt `[process_step] "Titel"` aus. Derselbe Kontext ist vollständig im `step_tracker` vorhanden — mit Slots, Status und Rolle. `pain_point`, `tool`, `role` sind einzigartig und existieren nirgendwo sonst.

**5 — Voice-Token kein Refresh**
`useVoiceInput.ts`: `sessionToken` wird einmalig bei `start()` gefetcht. ElevenLabs Session-Token läuft nach 900 s ab. Kein TTL-Tracking, kein Auto-Refresh, kein Fehlerhandling für abgelaufene Sessions. Bei Interviews >15 min aktiver Spracheingabe: Voice-Input verliert Verbindung ohne Fehlermeldung an den Nutzer.

**6 — Redundante Wissensobjekte über Interviews**
`extractAndEmbed()` extrahiert aus jedem Interview unabhängig. Zwei Interviews mit gleichem Mitarbeiterprofil im selben Workspace erzeugen duplizierte `knowledge_objects`. Kein Deduplication-Mechanismus auf Workspace-Ebene. Effekt: verrauschte Wissensbank, verfälschte ROI-Aggregation, fehlerhaftes Clustering.

**7 — Clustering-Threshold hardcoded**
0.85 Cosine-Similarity in `processClustering.ts` — kein Tuning ohne Code-Deploy.

---

## Decisions

### D1 — Complete-Interview-Sequenz: Abschlussfrage vor complete_interview

Der Agent stellt die Abschlussfrage ("Gibt es noch Prozesse, die wir nicht besprochen haben?") als regulären Turn. Im darauffolgenden Turn — nach Empfang der Mitarbeiter-Antwort — wertet er die Antwort aus und ruft `complete_interview` auf.

System-Prompt-Anweisung:
> `complete_interview` wird erst aufgerufen, nachdem der Mitarbeiter auf die Abschlussfrage geantwortet hat. Die Abschlussfrage und `complete_interview` dürfen nie im selben Turn erscheinen.

Adressiert: Befund A (P0).

### D2 — D3-Verstärkung: Negativbeispiel im System-Prompt

System-Prompt erhält explizites Negativbeispiel mit Few-Shot-Constraint:

> Ab Turn 2: Beginne direkt mit der inhaltlichen Reaktion auf die letzte Antwort. Keine Begrüßung, kein "Schön dass du dir Zeit nimmst", kein Selbstverweis.
>
> Falsch: *"Hallo [Name]. Schön, dass du dir die Zeit nimmst. Das klingt nach..."*
> Richtig: *"Die Rechnungsprüfung ist ein guter Startpunkt. [Frage]"*

Adressiert: Befund B (P1).

### D3 — D10-Erweiterung: Spannenangaben → Mittelwert-Bestätigung

Bei Spannenangaben ("X bis Y Stunden/Minuten") fragt der Agent einmalig nach dem repräsentativen Wert:

> *"Soll ich mit dem Mittelwert rechnen, also etwa [Mittelwert]?"*

Bestätigt der Mitarbeiter: Mittelwert als `duration_minutes` extrahiert. Lehnt er ab oder präzisiert er: den genannten Wert verwenden. Kein stilles Übernehmen des oberen oder unteren Endes.

Adressiert: Befund C (P1).

### D4 — Slot-Audit vor complete_interview

Vor `complete_interview` prüft der Agent intern, ob für jeden Eintrag im `step_tracker` die Pflicht-Slots (`frequency_per_month`, `duration_minutes`, `rule_based`) gefüllt sind. Fehlende Slots werden in einer einzigen Frage nachgefragt — maximal ein Slot pro Schritt, mehrere Schritte gesammelt in einem Turn. Bestätigt der Mitarbeiter, dass er keine weitere Angabe machen kann, wird `complete_interview` trotzdem aufgerufen.

System-Prompt-Anweisung ergänzt die `coverage_check`-Phase um expliziten Slot-Audit-Schritt.

Adressiert: Befund D (P1).

### D5 — D4/ADR-005: Begründungspflicht bei Prozessauswahl

Bei aktiver Prozessauswahl (D4/ADR-005) folgt immer ein kurzer Begründungssatz. Formulierungsbeispiel im System-Prompt:

> *"Da du sagst, die Rechnungsprüfung läuft täglich, fangen wir damit an — das ist die Basis für den Rest."*

Adressiert: Befund E (P2).

### D6 — D7/ADR-005: Übergangsmuster in Verbotsliste

Die Verbotsliste in D7/ADR-005 wird um Übergangsphrasen zwischen Themen erweitert.

**Verboten (Ergänzung):**
- "Lass uns den Fokus auf X verschieben"
- "Kommen wir nun zu"
- "Wechseln wir zum nächsten Thema"
- "Ich möchte nun auf X eingehen"

**Stattdessen:** direkte Anschlussfrage, die den Themenübergang impliziert ohne ihn anzukündigen.
Beispiel: *"Du hast den Monatsabschluss erwähnt — wie läuft der bei euch ab?"*

Adressiert: Befund F (P2).

### D7 — D9/ADR-005: Narrativität — quantitative Werte auf Nachfrage

Die Persona-Constraint aus D9/ADR-005 wird präzisiert. Die "unaufgefordertes Nennen bleibt erlaubt"-Ausnahme wird für quantitative Slot-Werte gestrichen:

> Mengenangaben (frequency, duration), Prozentwerte und Systembezeichnungen (SAP-Module, Tool-Namen) werden erst genannt, wenn der Agent explizit danach fragt.
>
> Qualitative Kontextinformationen — Beschreibungen, Probleme, Ausnahmen, Zusammenhänge — dürfen weiterhin unaufgefordert genannt werden.

Adressiert: Befund G (P3).

### D8 — Extraktion fire-and-forget

`extractAndEmbed()` in `onFinish` wird nicht mehr awaited. Die Funktion wird als unblockierendes Promise gestartet. Fehler werden via `console.error` geloggt.

Der `extractions_log`-Update im State erfolgt weiterhin synchron im `onFinish`-Handler — nur die Embedding-Erstellung ist asynchron entkoppelt.

Konsequenz: `extractions_log` im Folge-Turn kann in seltenen Fällen einen Turn verzögert sein. Akzeptabel, da der Agent den Log als Kontext-Hint verwendet, nicht als Steuersignal für die aktuelle Antwort.

Adressiert: Befund 2.

### D9 — Tool-Step-Limit auf 3 erhöhen

`stopWhen`-Logik wird angepasst: Agent stoppt sobald ein Step Text enthält oder wenn 3 Steps erreicht sind (statt bisher 2).

```typescript
stopWhen: ({ steps }) => {
  if (steps.length === 0) return false
  const last = steps[steps.length - 1]
  return last.text.trim().length > 0 || steps.length >= 3
}
```

Ermöglicht: `register_step` (Step 1, tool-only) + `record_slot` (Step 2, tool-only) + Text-Response (Step 3).

Adressiert: Befund 3.

### D10 — process_step aus formatExtractionsLog entfernen

In `formatExtractionsLog()` (`interviewAgent.ts:107–110`) wird der `process_step`-Branch entfernt. Nur `pain_point`, `tool`, `role` bleiben im Prompt-Abschnitt "Extrahierte Wissensobjekte".

`process_step`-Kontext ist vollständig im `step_tracker` vorhanden und wird dort mit mehr Detail (Slots, Status, Rolle) formatiert. Doppelter Kontext erzeugt keine Mehrwert und belegt ca. 10–20 Token pro Schritt pro Turn.

Adressiert: Befund 4.

### D11 — Prompt-Struktur: statisch/dynamisch trennen + phasenabhängiges Laden

> **⚠️ Vorbehalt Caching-Implementierung:** Provider-seitiges Caching ist abhängig vom eingesetzten Modell und zeigt zum Zeitpunkt des ADR bekannte Limitierungen. Details im Abschnitt "Caching-Strategie nach Provider". Vor Implementierung verifizieren.

`buildSystemPrompt()` wird in zwei strukturell getrennte Blöcke aufgeteilt — unabhängig davon ob Caching aktiv ist, da die Trennung selbst Token-Ersparnis durch phasenabhängiges Laden bringt:

**Statischer Block** (~1300 Tokens, immer zuerst, immer identisch innerhalb einer Phase):
- Phasenmodell, Tool-Regeln, Verbotsliste, Gesprächsregeln
- Methodik-Sektionen: nur die jeweils aktive Phase wird eingebunden

**Dynamischer Block** (~200–600 Tokens, immer am Ende):
- Interview-Kontext (Name, Rolle, Fokusthemen, Phase, Timer)
- Schritt-Tracker (aktueller Slot-Stand)
- Extrahierte Wissensobjekte

**Caching-Strategie nach Provider (Stand Mai 2026, verifiziert):**

- **Anthropic:** `cache_control: { type: 'ephemeral' }` als Trennmarker zwischen statischem und dynamischem Block. Unterstützt von AI SDK v6 via `providerOptions`. Erwartete Ersparnis: ~60–70 % der Input-Tokens ab Turn 2. Status: sauber implementierbar, keine bekannten Bugs.

- **Gemini 2.5 Flash / 3.x Flash (Non-Lite):** Implizites Caching automatisch aktiv für Prefixe mit > 1.024 Tokens. Kein API-Setup nötig. Bestätigt für `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-3.5-flash`. Explizites Caching via `cachedContent` in `@ai-sdk/google` vorhanden, aber **Vercel AI SDK Bug #3333** blockiert die Kombination mit `system_instruction` + `tools` — genau die Kombination die wir nutzen.

- **`gemini-3.1-flash-lite` (aktuelles Standardmodell):** Lite-Varianten sind in der offiziellen Google-Caching-Dokumentation nicht aufgeführt. Implicit Caching: **nicht bestätigt**. Explizites Caching: nicht dokumentiert. → Caching-Effekt für das aktuelle Standardmodell unklar.

- **Nebius AI / Fireworks AI (PROJ-9-Plan, Kimi K2.6 / DeepSeek V4 Pro):** Kein Caching-Support erwartet — OpenAI-kompatible API ohne eigene Caching-Abstraktion.

**Phasenabhängiges Laden:** Anstatt alle fünf Methodik-Sektionen immer einzubinden, wird nur die aktive Phase geladen. In `quantify_step` werden `intro`-, `explore_step`-, `bottleneck_probe`-, `coverage_check`- und `wrap_up`-Sektionen ausgeblendet (~500 Tokens weniger Rauschen). Dieser Gewinn gilt unabhängig vom Provider und unabhängig davon ob Caching greift.

**Konsequenz:** Die Strukturtrennung statisch/dynamisch wird implementiert (Tokenersparnis durch phasenabhängiges Laden). Das `cache_control`-Marking wird für Anthropic-Modelle aktiviert. Für Gemini: Caching wird erst implementiert wenn Bug #3333 im Vercel AI SDK behoben ist oder das Standardmodell auf eine bestätigte Non-Lite-Variante wechselt (PROJ-9).

Adressiert: Befund 1.

### D12 — Voice-Token Refresh

`useVoiceInput.ts` erhält TTL-Tracking: beim Fetch des `sessionToken` wird der Zeitstempel gespeichert. 60 s vor Ablauf (t = 840 s nach Verbindungsaufbau) wird automatisch ein neuer Token gefetcht und die WebSocket-Verbindung neu initialisiert.

Bei Refresh-Fehler: `toast.error`-Meldung, State auf `'error'`. Kein stilles Verlieren der Verbindung.

Adressiert: Befund 5.

### D13 — Workspace-Level Deduplication (async, post-Interview)

Deduplication wird als asynchroner Post-Interview-Job implementiert, nicht als Pre-Check während der Extraktion. Begründung: kein Latenzeinfluss auf den Interview-Stream, einfachere Insert-Logik, robuster gegenüber Race Conditions bei schnell aufeinanderfolgenden Interviews.

**Ablauf:**
1. Interview completed → `extractions_pending = true` (bereits gesetzt in `complete_interview`-Tool)
2. Bestehender Enrichment-Job nach Interview-Abschluss wird um Dedup-Schritt erweitert
3. Dedup-Query: für jeden `process_step` im Workspace mit Cosine-Similarity > 0.92 (via pgvector) und gleicher `role` → mergen statt duplizieren
4. `existing_count` (neues Feld, Default 1) auf dem überlebenden Objekt inkrementieren, `last_seen_at` aktualisieren

Schwelle 0.92 bewusst höher als Clustering-Threshold (0.85) — nur echte Duplikate, keine semantischen Varianten.

Erfordert: DB-Migration (Felder `existing_count`, `last_seen_at` auf `knowledge_objects`).

**Abgrenzung zu PROJ-18:** PROJ-18 (Prozessschritt-Deduplication, deployed) clustert `process_steps` auf Workspace-Ebene für die UI-Darstellung. D13 operiert eine Ebene tiefer: es verhindert doppelte `knowledge_objects` (Rohdaten der Extraktion, vor dem Enrichment-Schritt). Beide Maßnahmen sind komplementär.

**Abgrenzung Knowledge-Informed Interviewing (PROJ-19):** Die verwandte Frage — soll der Agent vor dem Interview auf vorhandenes Workspace-Wissen zugreifen, um gezieltere Fragen zu stellen — ist ein eigenes Feature (PROJ-19, Roadmap) mit anderem Scope.

Adressiert: Befund 6.

### D14 — Clustering-Threshold als Env-Var

`CLUSTERING_THRESHOLD` als Env-Var mit Default `0.85` in `processClustering.ts`. Dokumentation in `.env.local.example`. Kein Workspace-Config-Feld im MVP.

Adressiert: Befund 7.

### D15 — Du-Anrede: Expliziter Vorname + Herr/Frau-Verbot

Die System-Prompt-Anweisung zu Anrede wird um expliziten Vornamen-Anker und Negativbeispiel erweitert:

> Sprich den Mitarbeiter mit dem Vornamen und "du" an — unabhängig davon ob der vollständige Name im Profil steht. Verwende nie "Sie", nie "Herr [Nachname]", nie "Frau [Nachname]".
>
> Falsch: "Hallo Herr Braun, schön Sie kennenzulernen."
> Richtig: "Hallo Michael, schön dass du dir die Zeit nimmst."

Der Vorname wird aus `employee_name` extrahiert (erster Token bei Leerzeichen-Split). Falls kein Vorname isolierbar: Anrede ohne Namen ("Hallo, schön dass du da bist.").

Adressiert: Befund H (P1).

### D16 — Abschlussantwort: Neuer Prozess als Explorations-Signal

Wenn der Mitarbeiter in der Antwort auf die Abschlussfrage ("Gibt es noch etwas Wichtiges?") einen neuen Prozess, eine neue Tätigkeit oder einen Pain Point mit klarem Prozesscharakter nennt, fragt der Agent einmalig nach ob dieser noch aufgenommen werden soll — vor `complete_interview`.

System-Prompt-Anweisung (wrap_up-Sektion):

> Wenn der Mitarbeiter auf die Abschlussfrage mit einem neuen Prozess oder einer bisher nicht erwähnten Tätigkeit antwortet, biete einmalig an diesen aufzunehmen: "Das klingt nach einem weiteren relevanten Ablauf — sollen wir den noch kurz mit aufnehmen?" Wenn ja: zurück zu explore_step. Wenn nein oder kurze Ablehnung: complete_interview aufrufen.

Abgrenzung zu D1 (complete_interview-Sequenz): D1 stellt sicher, dass complete_interview nach der Abschlussantwort kommt, nicht gleichzeitig. D16 regelt was passiert wenn die Abschlussantwort inhaltlich einen neuen Prozess enthält.

Adressiert: Befund I (P1).

### D17 — rule_based: Gemischte Regelbasierung = true

Die rule_based-Instruction wird um den "halb-halb"-Fall erweitert:

> `rule_based = true` wenn ein definierter Standard-Workflow für bekannte Fälle existiert — auch wenn unbekannte oder neue Fälle situativ entschieden werden. Der situative Anteil schließt Regelbasierung nicht aus, solange ein Standardablauf als Baseline vorhanden ist.
>
> `rule_based = false` nur wenn grundsätzlich jeder Fall individuell beurteilt wird und kein wiederholbarer Standardablauf existiert.
>
> Formulierung "halb-halb" → `rule_based = true` (Standard-Workflow vorhanden, Ausnahmen existieren).

Adressiert: Befund J (P2).

---

## Consequences

**Positiv:**
- Race Condition bei Interview-Abschluss beseitigt — letzter Prozessschritt des Mitarbeiters geht nicht mehr verloren.
- Extraktion entkoppelt vom Response-Stream — wahrgenommene Latenz nach Agent-Text sinkt um ~300–500 ms.
- Agent kann zwei Tool-Calls in einem Turn ausführen — natürlichere Gesprächsführung, weniger Turns.
- Wissensbank nicht mehr durch Eval- oder Mehrfach-Interview-Duplikate verrauscht.
- Prompt Caching (Anthropic): ~60–70 % Token-Ersparnis auf statischen Anteil ab Turn 2. Für Gemini: erst nach Vercel AI SDK Bug-Fix #3333 oder Modellwechsel zu Non-Lite-Variante (PROJ-9).
- Phasenabhängiges Laden: ~500 Tokens weniger Rauschen pro Turn durch Ausblenden inaktiver Methodik-Sektionen — gilt für alle Provider sofort.
- D15: Du-Anrede funktioniert auch bei Personas mit deutschem Nachnamen — keine Regression beim Wechsel der Persona-Kategorie.
- D16: Spontan genannte Prozesse in der Abschlussantwort gehen nicht verloren (vgl. IT-Support: "Software-Freigaben" wurde nicht aufgenommen).
- D17: rule_based-Klassifikation korrekt für gemischte Workflows — Use-Case-Engine bekommt zuverlässigere Heuristik-Basis.

**Negativ:**
- D8 (fire-and-forget): `extractions_log` im Folge-Turn kann theoretisch einen Turn hinter dem tatsächlichen Stand sein. Akzeptabel, da der Agent den Log als Kontext-Hint nutzt, nicht als Steuersignal.
- D9 (Step-Limit 3): Erhöhtes Risiko von unerwünschtem Verhalten wenn das Modell in Tool-only-Steps Text generiert. Mitigiert durch bestehende `text.trim().length > 0`-Abbruchbedingung.
- D13 (async Dedup): Zwischen Interview-Ende und Dedup-Abschluss existieren temporäre Duplikate. Kein Problem für laufende Interviews, da diese Objekte noch nicht im Workspace-Index erscheinen.
- D11 (Prompt Caching + phasenabhängiges Laden): Statischer und dynamischer Anteil müssen klar getrennt gehalten werden. Phasenabhängiges Laden erfordert Pflege wenn neue Phasen hinzukommen.

**Offene Fragen:**
- D13: Soll `existing_count` im Use-Case-Engine-Scoring berücksichtigt werden (häufig genannter Prozess = höhere Konfidenz)? Kein MVP-Scope, als Extension vorgemerkt.
- Knowledge-Informed Interviewing: Agent lädt vor Interviewstart eine Zusammenfassung des vorhandenen Workspace-Wissens (gleiche Rolle/Abteilung) und stellt gezieltere Fragen. Separates Feature-Spec erforderlich (PROJ-18 vorgemerkt).
- D11 Gemini-Caching: aktivieren sobald Vercel AI SDK Bug #3333 behoben oder Standardmodell auf `gemini-2.5-flash` / Non-Lite-Variante gewechselt (abhängig von PROJ-9).

**Folgeentscheidungen:**
- System-Prompt-Änderungen (D1–D7) müssen mit neuem Eval-Lauf (gleiche Buchhalter-Persona) verifiziert werden.
- D13 erfordert Supabase-Migration vor Deployment.

---

## Umsetzung

| # | Entscheidung | Datei(en) | Aufwand |
|---|-------------|-----------|---------|
| D1 | complete_interview-Sequenz | System-Prompt (interviewAgent.ts) | S |
| D2 | D3-Verstärkung Opener | System-Prompt | S |
| D3 | D10 Spannen-Extraktion | System-Prompt | S |
| D4 | Slot-Audit vor complete_interview | System-Prompt | S |
| D5 | D4 Begründungspflicht | System-Prompt | S |
| D6 | D7 Übergangsmuster | System-Prompt | S |
| D7 | D9 Narrativität verschärft | Persona-Definition (eval-Skill: `buchhalter.ts`) | S |
| D8 | Extraktion fire-and-forget | `src/app/api/interview/[token]/chat/route.ts` | S |
| D9 | Tool-Step-Limit auf 3 | `src/services/interviewAgent.ts:554` | S |
| D10 | process_step aus formatExtractionsLog | `src/services/interviewAgent.ts:107–110` | S |
| D11 | Prompt-Struktur statisch/dynamisch + phasenabhängiges Laden | `src/services/interviewAgent.ts` (buildSystemPrompt) | M |
| D11b | Anthropic cache_control (erst nach D11-Refactor) | `src/services/interviewAgent.ts` (streamText call) | S |
| D11c | Gemini Caching | abhängig von Vercel AI SDK Bug #3333 + PROJ-9 | blockiert |
| D12 | Voice-Token Refresh | `src/hooks/useVoiceInput.ts` | M |
| D13 | Workspace-Deduplication | `src/services/extraction.ts` + DB-Migration | M |
| D14 | Clustering-Threshold als Env-Var | `src/services/processClustering.ts` + `.env.local.example` | S |
| D15 | Du-Anrede: Vorname + Herr/Frau-Verbot | System-Prompt (interviewAgent.ts) | S |
| D16 | Abschlussantwort: Neuer Prozess als Explorations-Signal | System-Prompt (wrap_up-Sektion) | S |
| D17 | rule_based halb-halb = true | System-Prompt (quantify_step-Instruktion) | S |

D1–D10 und D14–D17: keine Schema-Migration. D11–D13: etwas mehr Aufwand, D13 erfordert Supabase-Migration.
