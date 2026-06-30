# Persona- + Tester-Design-Review (PROJ-40 Kriterium C)

> Stufe-1-Instrument-Validierung: Design-Validität von Persona und Tester-System-Prompt.
> Erstellt 2026-06-30. Quelle: Persona-Quellcode + corpus-weite Transkript-Fehlersuche (96 Läufe).

## 1. Design-Checkliste

**Persona**
- P1 realistisch: Identität, Rolle, Prozesse plausibel.
- P2 vollständig: genug Prozesstiefe für ein 15–35-Turn-Interview (Pain Points, Tools, Frequenzen, ggf. spät auftauchender Prozess).
- P3 nicht-trivial kooperativ: gibt nicht alles sofort preis, erzwingt Laddering/Nachfragen.
- P4 KI-Potenzial-tauglich (Refokus): enthält automatisierbarkeits-relevante Signale (Frequenz, Dauer, Fehlerquote, Medienbrüche, Regelbasiertheit, Abhängigkeiten).

**Tester-System-Prompt**
- T1 bleibt in Rolle (wird nicht zum Interviewer).
- T2 legt nicht alles in Turn 1 offen.
- T3 über-kooperiert nicht (strukturiert/verschenkt nicht, was der Agent erfragen soll).
- T4 bleibt geerdet (erfindet keine Fakten jenseits des Prozesswissens).

## 2. Per-Persona-Review

| Item | buchhalter | vertriebler | it-support |
|------|-----------|-------------|-----------|
| P1 realistisch | ✅ | ✅ | ✅ |
| P2 vollständig | ✅ (2 Prozesse + versteckter Mahnprozess in `additionalContext`) | ⚠️ dünner (2 Prozesse, kein versteckter) | ✅ (2 Prozesse + Medienbruch-Hinweis) |
| P3 nicht-trivial kooperativ | ✅ stark (6 Tendencies inkl. explizitem Tool-/Zahlen-Zurückhalten) | ❌ über-kooperativ (s. §3) | ❌ über-kooperativ bei Tools (s. §3) |
| P4 KI-Potenzial-Signale | ✅ Rechnungsprüfung = starker Kandidat (Frequenz, Medienbrüche 3 Systeme, 5/100 Fehler) | ✅ aber Werte vage | ✅ Ticket-Bearbeitung = starker Kandidat (15–20/Tag, 3× Tool-Wechsel) |

**Kern-Asymmetrie:** buchhalter ist deutlich stärker engineered (6 Tendencies, darunter „Mengenangaben, Prozentwerte und Tool-Namen nur auf direkte Nachfrage", Anti-Wiederholung, Kontextregel). vertriebler und it-support haben je nur 3 Tendencies und KEINE Tool-Zurückhalte-Regel. Das Messwerkzeug ist über die Personas ungleich kalibriert.

## 3. Transkript-Fehlersuche (Fehlermodi)

Corpus-weit, Anteil der Läufe mit Preisgabe schon in Turn 1 (Antwort auf die Begrüßung):

| Persona | n | Turn-1 mit Zahl | Turn-1 mit Tool-Name |
|---------|---|-----------------|----------------------|
| buchhalter | 66 | **0 %** | **0 %** |
| vertriebler | 11 | 45 % | **91 %** |
| it-support | 19 | 16 % | **100 %** |

- **Rollenbruch (T1):** nicht gefunden. Alle Tester bleiben in Mitarbeiter-Rolle.
- **Voraus-Komplett-Offenlegung / Über-Kooperation (T2/T3):** bestätigt bei vertriebler + it-support. Belege:
  - it-support Turn 1: „Ticket-Bearbeitung und Hardware-Tausch. Jira abarbeiten, Remote Desktop, Wiki-Recherche, Imaging von Geräten." — beide Prozesse + vier Tools unaufgefordert.
  - vertriebler Turn 1: „… Bestandskunden in Salesforce … Angebote, was ich so fünf bis zwanzig Mal pro Woche mache …" — Tool + Frequenz + Pain Point unaufgefordert.
  - buchhalter Turn 1 (Kontrast): reine Ablauf-Narration, kein Tool, keine Zahl.

**Ursache:** (a) vertriebler/it-support fehlt die explizite Tool-Zurückhalte-Tendency, die buchhalter hat; (b) Tool-Namen sind in die Prozess-`description` eingewoben, eine „beschreib deinen Tag"-Antwort nennt sie zwangsläufig; (c) die System-Prompt-Regel „Tool-Namen nur auf Nachfrage" wird durch den Persona-Inhalt überschrieben und ist bei den schwachen Personas wirkungslos.

## 4. Konsequenz für das Benchmarking (warum das zählt)

1. **Cross-Persona-Vergleichbarkeit gebrochen.** Bei buchhalter muss der Agent für Tools laddern (schwer); bei vertriebler/it-support bekommt er sie geschenkt (leicht). Hilfsmittel-/Medienbruch-Erfassung auf it-support misst die Großzügigkeit des Testers, nicht die Nachfrage-Fähigkeit des Interview-Modells.
2. **Trifft direkt die neuen KI-Potenzial-Metriken.** Tools (hilfsmittel), Systemlandschaft und Medienbrüche sind Automatisierbarkeits-Signale. Schenkt der Tester sie her, kann `potenzialCoverage` / Medienbruch-Erfassung nicht zwischen „Agent hat erkundet" und „Tester hat verschenkt" trennen. Der Refokus macht diesen Befund wichtiger, nicht unwichtiger.
3. **Über-Kooperation täuscht Qualität vor** für die schwach-engineerten Personas — genau die Mess-Verzerrung, die Stufe 1 vor dem Benchmarking abfangen soll.

## 5. Tester-System-Prompt-Review

- T1 (in Rolle): ✅.
- T4 (geerdet): ✅ „Erfinde keine Fakten" + „AUSSCHLIESSLICH auf Basis deines Prozesswissens". Milde Spannung: vertrieblers Tendency „erzählt Hintergrundgeschichten" lädt zum Improvisieren ein — ein schwaches Modell könnte Fakten erfinden, um die Geschichte zu füllen.
- T2/T3: Die Regel „Tool-Namen nur auf direkte Nachfrage" steht zwar im System-Prompt, wird aber (§3) bei zwei Personas nicht eingehalten. **Designfrage:** ist Tool-Namen-Zurückhalten überhaupt das richtige Ziel? In einem echten Interview nennt ein Mitarbeiter beim Beschreiben des Ablaufs natürlich seine Systeme. Das wirklich schwer zu Erfragende sind die **quantitativen** Werte (Frequenz, Dauer, Fehlerquote), nicht die Tool-Namen.

## 6. Offene Entscheidung — Auflösungs-Richtung

**Option A — auf Zurückhalten harmonisieren:** vertriebler + it-support bekommen dieselbe explizite Tool-/Zahlen-Zurückhalte-Tendency wie buchhalter. Maximiert die Nachfrage-Herausforderung, ist aber weniger realistisch und kämpft gegen die knappe/abschweifende Sprechweise.

**Option B (empfohlen) — natürliche Tool-Nennung zulassen, nur quantitative Potenzial-Werte zurückhalten:** Regel wird „Mengen/Zeit/Prozent nur auf direkte Nachfrage; Systeme dürfen beim Erzählen genannt werden". Realistischer, und das diskriminierende Signal wird, ob der Agent für die **ROI-kritischen Zahlen** laddert — genau das, was unter dem KI-Potenzial-Fokus zählt. Erfordert weiterhin, das Zahlen-Zurückhalten in vertriebler/it-support auf buchhalter-Niveau zu heben (heute 45 %/16 % Turn-1-Zahlen vs. buchhalters 0 %).

### Entscheidung (2026-06-30): beide Modi als kontrollierter Faktor + Persönlichkeiten bleiben divers

Nicht A oder B, sondern beide als **Tester-Offenlegungs-Modus** (Faktor im Versuchsplan):
- **Modus A** (`withhold_tools_and_numbers`): Tools UND Zahlen nur auf Nachfrage.
- **Modus B** (`withhold_numbers_only`): Systeme dürfen genannt werden, Mengen/Zeit/Prozent nur auf Nachfrage.

Kern-Prinzip: **Offenlegungs-Disziplin wird von der Persönlichkeit entkoppelt.** Heute steckt das Zurückhalten zufällig in den Persona-Tendencies (buchhalter streng, andere lose) — daher die 0 % vs. 91 %/100 %-Asymmetrie. Künftig kommt die Disziplin aus dem Modus-Schalter, einheitlich über alle Personas; die Personas behalten nur ihre **Persönlichkeits**-Tendencies (Verbosity, Ton, abschweifen/wortkarg, Anti-Wiederholung, Kontextregel). Personas dürfen sich also weiter unterschiedlich verhalten (Nutzer-Vorgabe), aber der Mess-Knopf „wie viel gibt der Tester unaufgefordert preis" ist kontrolliert, nicht akzidentell.

Konsequenz: Der Modus wird im Versuchsplan als Faktor geführt und in einem Validierungslauf empirisch geprüft, wie stark er das Interview-Modell-Ranking verschiebt (analog zur Tester-Stärke-Stabilität). Umsetzung (Tester-Prompt-Parametrisierung + Entkopplung der Persona-Tendencies) ist C-/Batch-2-Code.

## 7. Persona-Anreicherung für KI-Potenzial-Ground-Truth (für Batch-2-Korrektheits-Metriken)

Heute hat `ProcessEntry` nur Freitext-`frequency`. Für Korrektheits-Metriken (richtige KI-Kandidaten erkannt? Potenzial-Werte korrekt? Abhängigkeiten korrekt?) fehlt Ground Truth. Vorschlag: ein **separater Ground-Truth-Block** je Prozess, der NICHT an den Tester geht (Tester improvisiert weiter aus der vagen Narration, Realismus bleibt), nur von Scorern gelesen wird:

```
groundTruth?: {
  aiCandidate: boolean            // ist dieser Schritt ein KI-/Automatisierungs-Kandidat?
  potenzial: {                    // kanonische Soll-Werte (Punkt statt Range)
    frequency_per_month?: number
    duration_minutes?: number
    error_rate_percent?: number
    media_breaks?: number
  }
  dependsOn?: string[]            // Soll-Abhängigkeiten (Schritt-/Prozessnamen)
}
```

Vage Narration (Tester-Input) und kanonische Werte (Scorer-Wahrheit) bleiben getrennt — Probing-Realismus erhalten, Korrektheit messbar. Befüllung der drei Personas ist Teil der C-Umsetzung.

## 8. Status
Analyse + Entscheidung abgeschlossen (§6: beide Modi als Faktor, Persönlichkeiten bleiben divers, Disziplin von Persönlichkeit entkoppelt). Offen als Umsetzung (C-/Batch-2-Code): Tester-Prompt-Parametrisierung mit `disclosureMode`, Entkopplung der Persona-Tendencies, Ground-Truth-Befüllung (§7). Der Versuchsplan (E) führt „Tester-Offenlegungs-Modus" als Faktor.
