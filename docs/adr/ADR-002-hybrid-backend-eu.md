# ADR-002: Hybrid-Backend mit EU-Region (Vercel + Supabase)

**Status:** Accepted (2026-05-19)
**Author:** Lias Hemmersbach
**Repository:** Roly-Bach/meridian-app
**Supersedes:** Keine
**Related:** ADR-001 (Fork-Audit)

## Context

Meridian baut den MVP für Interview-Engine, Vektor-DB und Analyse. Parallel läuft die Masterarbeit als Interview-Studie mit 2-4 deutschen Industrieunternehmen. Mitarbeiter-Interviews enthalten potenziell sensible Daten (Prozessbeschreibungen, persönliche Wahrnehmungen, ggf. Aussagen über Kollegen).

**Rechtlicher Rahmen:**
- DSGVO Art. 6: Verarbeitung personenbezogener Daten erfordert Rechtsgrundlage (Einwilligung)
- DSGVO Art. 9: Besondere Kategorien können in Mitarbeiterinterviews auftauchen (z.B. Gesundheit, politische Meinung)
- DSGVO Art. 28: Auftragsverarbeitungsverträge (AVV) mit jedem Cloud-Provider, der Daten verarbeitet
- Für TUM-Masterarbeit: Datenschutzkonzept vorab mit Lehrstuhl klären, ggf. Ethik-Votum

**Was das bedeutet:**
- Interview-Audio und Transkripte dürfen nicht in US-Rechenzentren ohne EU-SCCs + AVV + Risikoabwägung liegen
- Frontend-Hosting (statische Assets, keine personenbezogenen Daten) kann auf US-Edge laufen, aber EU-Region ist sauberer
- Daten-Layer (Postgres, Auth, Storage) muss in EU sein

## Decision

**Hybrid-Stack mit klar getrennten Schichten:**

| Schicht | Anbieter | Region | Begründung |
|---|---|---|---|
| Frontend-Host | Vercel | `fra1` (Frankfurt) | OAuth/Plugin bereits konfiguriert, Preview-Deploys pro PR, EU-Edge |
| Datenbank + Vektor-DB | Supabase | `eu-central-1` (Frankfurt) | Postgres + pgvector + Auth + Storage in einem, DSGVO-AVV |
| Auth | Supabase Auth | EU | Kein zusätzlicher US-Provider (Clerk), alles in einer Hand |
| File-Storage (Audio/Transkripte) | Supabase Storage | EU | DSGVO-konform mit AVV |
| LLM-Calls (Interview-Analyse) | Anthropic API direkt | (US-basiert, aber DPA-Vertrag verfügbar) | Beste Tool-Use-Qualität |

**Technologie-Konfiguration:**
- `vercel.json` mit `"regions": ["fra1"]`
- Supabase-Projekt in `eu-central-1`
- `.env.local` mit `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` Key wird nur server-seitig verwendet, nie im Frontend

## DB-Schema (initial)

Minimal für Vertical Slice, später erweitert:

```sql
-- Unternehmen (Pilot-Kunden, MA-Interview-Standorte)
CREATE TABLE unternehmen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  branche text,
  created_at timestamptz DEFAULT now()
);

-- Mitarbeiter (Interview-Teilnehmer)
CREATE TABLE mitarbeiter (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unternehmen_id uuid REFERENCES unternehmen(id),
  name text NOT NULL,
  abteilung text,
  rolle text,
  einwilligung_datum timestamptz,
  einwilligung_version text,
  created_at timestamptz DEFAULT now()
);

-- Interviews
CREATE TABLE interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mitarbeiter_id uuid REFERENCES mitarbeiter(id),
  datum date NOT NULL,
  status text CHECK (status IN ('geplant', 'durchgefuehrt', 'transkribiert', 'analysiert', 'archiviert')),
  transcript text,
  audio_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Wissens-Chunks (für Vektor-Suche)
CREATE TABLE knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid REFERENCES interviews(id),
  content text NOT NULL,
  embedding vector(1536), -- OpenAI-Embedding-Dim, anpassbar
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- pgvector Index für Ähnlichkeitssuche
CREATE INDEX ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

**Row Level Security:** Alle Tabellen mit RLS aktiviert, Policies pro Tabelle in separater Migration.

## Consequences

**Positiv:**
- DSGVO-konform für MA-Interviews und späteren Pilot
- Mahr/Knoll/Atlantic können bei Bedarf eigene AVVs prüfen
- Kostenneutral in MVP-Phase (Free-Tier reicht für 100 Interviews + 500 MB Daten)
- Klare Trennung Frontend (Vercel) und Daten (Supabase) erlaubt Provider-Wechsel ohne Rewrite

**Negativ:**
- Zwei Vendor-Konten zu pflegen (zwei AVVs, zwei Billing-Pläne)
- Bei Skalierung: Supabase EU-Region kann teurer sein als US-Region
- pgvector ist für > 1M Embeddings nicht ideal — späterer Wechsel zu dedizierter Vektor-DB (Qdrant Cloud EU) möglich

**Folgeentscheidungen:**
- ADR-003: Auth-Pattern (Magic Link vs. OAuth vs. SAML für Enterprise-Kunden)
- ADR-004: Audio-Storage (Supabase Storage vs. selbst-gehostet bei sensiblen Aufnahmen)
- ADR-005: Embedding-Modell-Wahl (OpenAI vs. Gemini vs. open-source)
- ADR-006: Migration zu dedizierter Vektor-DB bei > 500k Chunks

## AVV-Checkliste vor Pilot-Start

- [ ] Supabase AVV unterzeichnet (Dashboard → Settings → Compliance)
- [ ] Vercel AVV unterzeichnet (Dashboard → Settings → Privacy)
- [ ] Anthropic DPA unterzeichnet (`https://www.anthropic.com/legal/dpa`)
- [ ] Einwilligungserklärung-Template für Interview-Teilnehmer fertig
- [ ] TUM-Datenschutzbeauftragter konsultiert (für MA)
- [ ] Datenschutz-Konzept im MA-Repo dokumentiert
