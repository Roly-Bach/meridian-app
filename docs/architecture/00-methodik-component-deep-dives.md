# Methodik — Component-Deep-Dives (Level 3/4)

**Zweck:** Verbindliche, wiederverwendbare Vorgaben für jede `04-*.md`/`05-*.md`-Component-Deep-Dive-Datei. Entstanden während `04-interview-engine.md` (2026-07-13), aber bewusst hier ausgelagert statt im Kopf dieser einen Datei — sonst müsste jede künftige Component-Doku `04-interview-engine.md` komplett lesen und die Regeln manuell heraussuchen, statt sie an einem festen Ort nachzuschlagen. **Vor Start jeder weiteren Component-Deep-Dive-Datei zuerst dieses Dokument lesen.**

**Verhältnis zu anderen Doku-Dateien:** [`01-woerterbuch.md`](01-woerterbuch.md) definiert Namen (Component ↔ Code, inkl. "Modul", siehe dort) — reine Vokabular-Referenz. Dieses Dokument definiert Vorgehen/Struktur — wie eine Component-Deep-Dive-Datei aufgebaut wird und welche Prüfungen dabei verbindlich sind. [`00-vorgeschlagene-anpassungen.md`](00-vorgeschlagene-anpassungen.md) sammelt die inhaltlichen Ergebnisse (Funde), die aus der Anwendung dieser Methodik entstehen.

---

## Grounding-Pflicht (gilt für alle Abschnitte)

Jede Funktionstabelle, jeder Zeilenverweis und jede Kritik muss gegen den tatsächlichen Code verifiziert sein — nicht nur gegen Recherche-Zusammenfassungen von Explore-Agenten. Agent-Outputs sind zulässige Recherche-Grundlage/Checkliste, aber beim eigentlichen Schreiben wird jede betroffene Datei erneut direkt gelesen (Read-Tool), bevor eine Zeile ins Dokument übernommen wird. Grund: Sub-Agent-/Erst-Vermutungen können falsch liegen — Beispiel aus der Interview-Engine-Session: eine Importer-Count-Vermutung zu `stepIdentity.ts` ("nur 1 Importeur, also tot") war falsch, erst der Blick auf den tatsächlichen Code (ist `interviewAgent.ts` selbst erreichbar?) klärte es. Allgemeiner: "nur 1 Importeur, also tot" braucht immer eine Prüfung, ob dieser eine Importeur selbst erreichbar ist.

## Level-3-Template — 7 Abschnitte

1. **Verantwortung** — 1 Absatz: was die Component tut, explizit auch was sie NICHT tut (Abgrenzung zu Nachbar-Components).
2. **Schnittstellen** — Haupt-Seam(s), Aufrufer, berührte DB-Tabellen. Architektonische Besonderheiten (z.B. mehrere parallele Einstiegspunkte) explizit benennen, nicht glätten.
3. **Übersichtsdiagramm** — Mermaid, interner Abhängigkeitsgraph aggregiert auf Verantwortungsgruppen. Kanten aus dem echten madge-Graph (`npx madge --json --ts-config tsconfig.json --extensions ts,tsx --exclude '\.test\.(ts|tsx)$' src`, gefiltert auf componenten-interne Kanten), nicht aus dem Gedächtnis gezeichnet. Reine Typ-Dateien (component-weit importiert) als impliziter Unterbau ausblenden, sonst Rauschen.
4. **Code-Walkthrough** — pro Datei: Zweck-Satz + Funktionstabelle + Ablauf-Prosa + kritische Einordnung. Details siehe die zwei Pflicht-Regeln unten (Zweck-Sätze, Funktionstabellen-Vollständigkeit).
5. **Level-4-Diagramme** — selektiv, nur bei echter Komplexität (z.B. ein Sequenzdiagramm für den komplexesten Kontrollfluss, ein Flowchart für eine mehrstufige Kaskade). Nicht jede Component braucht eins.
6. **Verweise** — ADRs gruppiert (nicht einzeln aufgezählt), Known Issues als kurze Liste mit Link auf `features/INDEX.md` (kein Text-Duplikat).
7. **Schwachstellen & Verbesserungspotenzial** — konsolidiert aus Abschnitt 4, keine neue Recherche. Struktur: 7.1 Neu-Verdrahtung (siehe Regel unten), 7.2 konsolidierte Fund-Liste, 7.3 Known-Issues-Querverweis im Detail (siehe Regel unten).

## Vier verbindliche Regeln

### Regel 1 — Zweck-Sätze-Pflicht

Jede Datei (und jede eigenständig dokumentierte Funktion, z.B. eine Fabrikfunktion wie `buildTools()`) bekommt direkt unter der Überschrift, vor der Funktionstabelle, einen `**Zweck (einfach):**`-Satz in einfacher Sprache — verständlich ohne Vorwissen des restlichen Dokuments, aber ohne wichtige Information zu verlieren. Kein Ersatz für die technische Ablauf-Prosa danach, sondern ein schneller Einstiegspunkt davor.

### Regel 2 — Funktionstabellen-Vollständigkeit

Jede benannte Funktion mit eigener Logik bekommt eine Tabellenzeile — unabhängig davon, ob sie auf Modul-Ebene steht oder in einer anderen Funktion verschachtelt ist (Ousterhout-Sinne von "Modul", siehe `01-woerterbuch.md`). Ausnahme: anonyme Ein-Zeiler ohne eigenständige Logik (z.B. ein einzeiliges `.map()`-Callback) werden nur in der Ablauf-Prosa erwähnt, nicht tabellarisch. Verifikation: pro Datei per Grep (`function`/`const = (...) =>`-Deklarationen zählen) gegen die fertige Tabelle abgleichen, nicht nur beim Schreiben "aus dem Kopf" entscheiden, was relevant wirkt — in der Interview-Engine-Session deckte genau dieser Abgleich zwei vorher übersehene, aber substanzielle verschachtelte Funktionen auf (`fmtPotenzial`/`fmtTazite` in `talkerPrompt.ts`, die sieben Tool-Funktionen in `buildTools()`).

### Regel 3 — Neu-Verdrahtung statt "Aufteilen?"

Abschnitt 7.1 stellt bewusst nicht die Frage "ist das lang, also aufteilen?" — das widerspricht dem Deep-Modules-Prinzip (`/codebase-design`: ein Modul soll ein einfaches Interface haben, das erhebliche Komplexität dahinter verbirgt; viele kleine, flache Module erhöhen die Zahl der Schnittstellen ohne reale Komplexität zu reduzieren — Übersicht geht verloren, nicht wird sie gewonnen). Stattdessen fünf Kategorien pro Fund:

- **Trennen** — eine Modulgrenze existiert de facto schon (unterschiedliche Interfaces/Aufrufer), liegt aber zufällig zusammen mit einer anderen Verantwortung in derselben Einheit.
- **Zusammenführen** — dieselbe Logik existiert mehrfach unabhängig; Ziel ist weniger Code-Stellen, nicht mehr Einheiten.
- **Intern restrukturieren** — die Einheit bleibt bestehen, interne Lesbarkeit profitiert von benannten Zwischenschritten, ohne neue Schnittstellen-Grenze.
- **Löschen** — kein Aufrufer mehr vorhanden (grep-verifiziert); nichts zu verdrahten, nur eine tote Einheit zu entfernen.
- **Unverändert** — bereits ein gutes Deep Module oder ein angemessen dünner Adapter; weitere Zerlegung wäre reine Fragmentierung.

Kriterium pro Fund: würde eine neue Modulgrenze ein bereits vorhandenes Deep Module sichtbar machen (gut), oder nur ein flaches Adapter-Fragment erzeugen (schlecht)? Zeilenzahl/Komplexität allein ist **kein** Signal — weder dafür, etwas zusammenzulassen ("ist lang, aber kohärent, also unverändert"), noch dafür, etwas zu trennen ("ist groß/komplex, also eigenes Modul"). Der einzig tragfähige Trenn-Grund ist ein **konkreter, grep-verifizierbarer zweiter Konsument oder eine nachweisbar unabhängige Verantwortung** — nicht die gefühlte Komplexität einer Teil-Einheit.

**Selbstkorrektur-Beispiel aus der Interview-Engine-Session** (lehrreicher als ein sauberer Fall, weil es den Fehler beim Namen nennt): die erste Fassung von Abschnitt 7.1 empfahl, alle 7 Werkzeuge in `buildTools()` einzeln auszulagern. Nutzer-Rückfrage führte zur ersten Revision: nur `register_step`/`record_slot` seien "groß/komplex genug", die übrigen 5 blieben gebündelt. Zweite Nutzer-Rückfrage deckte auf, dass auch diese Revision noch denselben Fehler enthielt, nur an zwei statt sieben Werkzeugen — "groß/komplex genug" ist dieselbe Größen-Heuristik wie das ursprüngliche "aufteilen, weil lang", nur eine Stufe subtiler. Erst ein Grep-Check auf tatsächliche externe Referenzen brachte Klarheit: `register_step` hat keinen einzigen externen Aufrufer außerhalb der vollständigen `buildTools()`-Rückgabe (kein Grund zu trennen), `record_slot` hat zwar einen echten zweiten Konsumenten (`interviewQuickExtract.ts`, überschreibt `execute` per Objekt-Spread) — aber eine Dateiverschiebung hätte dessen eigentliches Problem (das fragile Override-Muster selbst) nicht gelöst, nur den Speicherort geändert. Ergebnis: alle 7 Werkzeuge bleiben gebündelt, der reale `record_slot`-Fund wird stattdessen als "Intern restrukturieren" (Kompatibilitäts-Test ergänzen) geführt. **Lektion:** bei jedem "Trennen"-Vorschlag explizit fragen "gibt es einen konkreten zweiten Konsumenten, oder wirkt das nur groß?" — und diese Frage per Grep beantworten, nicht per Einschätzung.

### Regel 4 — Known-Issues-Querverweis inkl. Residualrisiko hinter gelösten Issues

Abschnitt 7.3 prüft **jede** Known Issue aus `features/INDEX.md`, die die Component berührt — nicht nur die noch offenen. Auch bei formal "gelösten" Issues gilt die Prüffrage: *zeigt der jetzige Code am Fix selbst ein Residualrisiko, das über das ursprünglich dokumentierte Symptom hinausgeht?* Mit explizitem Vermerk auch dann, wenn nichts gefunden wurde (Transparenz über den durchgeführten Check, nicht nur über positive Funde). Ein "gelöst"-Status bedeutet nur, dass das ursprünglich dokumentierte Symptom weg ist, nicht dass der Fix selbst robust ist.

---

## Nicht Teil dieser Methodik (bewusste Abgrenzung)

- Kein automatischer Aufruf des `codebase-design`-Skills pro Component-Doku — die Deep-Modules-Kriterien aus Regel 3 werden als Prüflinse mitgeführt, ohne den Skill selbst live laufen zu lassen. Ein gezielter Skill-Lauf bleibt als möglicher separater Schritt offen, falls für eine bestimmte Component gewünscht.
- Diese Methodik-Datei ersetzt keine Umsetzung — Abschnitt 7.1 jeder Component-Doku bleibt eine Empfehlung, keine ausgeführte Änderung. Umsetzung läuft über `00-vorgeschlagene-anpassungen.md` und eigene Freigabe.
