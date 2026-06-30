# Product Requirements Document

## Vision
Meridian erhebt implizites Prozesswissen von Mitarbeitern durch KI-geführte Interviews, speichert es strukturiert mit Vektorsemantik in Supabase pgvector und leitet daraus automatisch priorisierte KI Use Cases mit ROI-Berechnung ab. Unternehmen verlieren kritisches Wissen wenn Mitarbeiter gehen; KI Use Cases entstehen aus Bauchgefühl statt Daten. Meridian macht beides systematisch und messbar.

### Prototyp-Fokus (Stand 2026-06-30)
Die Vision adressiert zwei Aspekte: (i) Wissensverlust-Sicherung und (ii) Identifikation KI-prädestinierter Prozessstellen. Der Prototyp fokussiert bewusst auf **Aspekt (ii) KI-Potenzial-Analyse**; Aspekt (i) Wissensmanagement ist vorerst zurückgestellt. Konsequenz: Vollständigkeit und Tiefe auf Gesamt-Prozessebene sind nachrangig — entscheidend ist das Erfassen der relevanten Stellen, ihrer quantitativen Potenzial-Facetten (Frequenz, Dauer, Fehlerquote, Medienbrüche → ROI) und ihrer Abhängigkeiten. Diese Priorisierung steuert die Eval-Metrik-Wahl (siehe [ADR-020 Nachtrag](adr/ADR-020-eval-methodik-modell-benchmarking.md) und `docs/evals/instrument-validierung/metrik-audit.md`).

## Target Users
- **KI-Berater / Strategieberater** — begleiten Unternehmen bei KI-Adoption, brauchen Datengrundlage statt Schätzungen
- **Heads of Operations / Process Owner** — wollen Prozesswissen sichern bevor Mitarbeiter gehen
- **Mitarbeiter (interviewte Person)** — passiver Nutzer der Interview Engine, kein Tech-Background nötig

## Core Features (Roadmap)

Siehe `features/INDEX.md` für vollständigen Feature-Status inkl. Typ, Domain, Appetite und Bugs.

## Success Metrics
- Interview vollständig abschließbar (Start → wrap_up → Abschluss)
- ≥5 Wissensobjekte mit Embeddings nach jedem Interview
- ≥1 Use Case pro zutreffender Heuristik-Regel
- ROI-Berechnung korrekt (frequency × duration × hourly_rate × reduction_rate)
- State überlebt Seitenaktualisierung / Verbindungsabbruch

## Constraints
- Solo-Developer MVP, kein fixes Deadline-Datum
- Backend: Supabase (PostgreSQL + pgvector + Auth)
- KI-Stack: Provider-agnostisch via `INTERVIEW_MODEL` env var (Anthropic / Google, Default: `google/gemini-3.1-flash-lite`), ElevenLabs Scribe v2 Realtime (Voice/STT), text-embedding-3-small (Embeddings)
- Deployment: Vercel
- Desktop-only für MVP — kein Mobile
- Design system: siehe `docs/design-system.md` (Meridian Pink #E040FB, Linear-ähnlich)

## Non-Goals
- Mobile App
- Multi-Tenant SaaS-Abrechnung / Stripe
- Voice-Output (TTS) des Agenten
- Echtzeit-Kollaboration mehrerer Interviewer
- Export-Feature (PDF/Excel) für Use Cases
