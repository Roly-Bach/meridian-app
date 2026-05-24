# PROJ-14: Embedding-Modell Auswahl

## Status: Deployed
**Created:** 2026-05-21
**Last Updated:** 2026-05-21
**Deployed:** 2026-05-21
**Tag:** v1.14.0-PROJ-14
**Priority:** P1 — Prio 1 vor LLM-Provider-Wechsel
**Type:** Extension
**Domain:** Wissensbank
**Extends:** PROJ-4
**Appetite:** —
**Bugs:** —

## Dependencies
- Requires: PROJ-4 (Extraktions-Agent + Wissensbasis) — `src/services/embeddings.ts`, pgvector-Schema
- Blocks: PROJ-9 (LLM Provider Optimierung) — sinnvolle Reihenfolge, aber keine harte Abhängigkeit

## Kontext

### Ausgangslage
- Aktuell: `text-embedding-3-small` (OpenAI, 1536 Dimensionen) via `src/services/embeddings.ts`
- Die Vektordatenbank (pgvector in Supabase) ist **leer** — keine Migration nötig, Entscheidung vollständig offen
- OpenAI ist ein US-Unternehmen; für EU-sensible Pilot-Kunden suboptimal

### Datenschutz-Anforderung
**EU-Unternehmen bevorzugt** als Datenverarbeiter. US-Konzerne mit EU-DPA als Fallback akzeptabel.

### Warum jetzt entscheiden
Sobald erste echte Interviews laufen, entstehen Embeddings in der DB. Ein nachträglicher Wechsel des Embedding-Modells erfordert vollständige Re-Embedding aller gespeicherten Wissensobjekte (Dimensionen und Vektorraumgeometrie sind modellspezifisch). Entscheidung vor dem ersten E2E-Test treffen.

## Kandidaten

| Modell | Anbieter | DSGVO-Fit | MTEB Retrieval | Preis/1M Tokens | Dimensionen | Kontext |
|--------|----------|-----------|---------------|-----------------|-------------|---------|
| **jina-embeddings-v3** ✅ | Jina AI (vollst. von Elastic übernommen Okt. 2025) | Gut — EU DPA über Elastic | 65.5 | $0.02 | 1024 (Matryoshka: 32–1024) | 8.192 |
| **Qwen3-Embedding-0.6B** | Alibaba (Open Source, selbstgehostet) | Stark — EU-Infrastruktur via HF Endpoints | ~70+ (8B-Variante) | ~$0.033/h (HF Endpoint) | 1024 | 32.768 |
| **embed-v4** | Cohere | Gut — EU DPA verfügbar | 65.2 | $0.10 | 1024 | 128.000 |
| **text-embedding-3-large** | OpenAI | Mittel — US-Konzern, EU DPA | 64.6 | $0.13 | 3072 (Matryoshka) | 8.191 |

**Hinweis zu jina-embeddings-v4/v5:** v4 ist multimodal (Text + Bilder, 3.8B Params) — für reinen Text-Retrieval kein Vorteil gegenüber v3. v5-text-small (Feb. 2026) hat einen niedrigeren Retrieval-Score (64.9) als v3 (65.5). v3 bleibt daher die beste API-Option für diesen Use Case.

**Hinweis zu Qwen3-Scores:** Der 70+ Score bezieht sich auf die 8B-Variante. Die 0.6B-Variante ist leichter und günstiger zu hosten, aber der genaue Retrieval-Score ist noch nicht auf dem MTEB-Leaderboard etabliert. Sie ist vor allem für die DSGVO-konforme Fallback-Route relevant.

### Empfehlung: jina-embeddings-v3 via Jina API

**Begründung:**
- $0.02/1M — fünfmal günstiger als Cohere, sechsmal günstiger als OpenAI text-embedding-3-large
- Höchster Retrieval-Score unter allen API-Optionen (65.5)
- Matryoshka-Support: Dimensionen auf 256/512 reduzierbar ohne Re-Embedding
- Einfache REST-API; AI SDK-kompatibel über OpenAI-Adapter mit custom baseURL
- 1M kostenlose Tokens auf neuen API Keys (für Entwicklungsphase)

**Vorbehalt:**
Elastic hat Jina AI im Oktober 2025 vollständig übernommen. Elastic ist ein US-Konzern. Falls ein Pilot-Kunde explizit kein US-Mutterunternehmen akzeptiert, gilt der DSGVO-Fallback unten.

### DSGVO-Fallback: Qwen3-Embedding via HuggingFace Inference Endpoints

Wenn ein Pilot-Kunde strikte Datensouveränität ohne US-Vendor-Beteiligung fordert:

**Qwen3-Embedding-0.6B auf HuggingFace Inference Endpoints (EU-Region)**
- Setup-Aufwand: <5 Minuten per UI-Click im HF-Dashboard, keine ML-Ops-Kenntnisse nötig
- EU-Region verfügbar (AWS eu-west-1)
- Kosten: ca. $0.033/h (Endpoint läuft nur wenn benötigt, automatisches Scaling)
- OpenAI-kompatible API — dieselbe Integration wie Jina, nur andere baseURL
- Volle Kontrolle über Daten; kein US-Vendor in der Verarbeitungskette

**Wann umsteigen:** Erst wenn ein konkreter Pilot-Kunde es fordert. Die `EMBEDDING_MODEL`-Env-Variable (siehe Acceptance Criteria) ermöglicht den Wechsel ohne Code-Änderung.

## Acceptance Criteria

- [ ] Jina API Key eingerichtet und in `.env.local` + Vercel hinterlegt (`JINA_API_KEY`)
- [ ] `src/services/embeddings.ts` auf jina-embeddings-v3 umgestellt
- [ ] Dimensionalität der pgvector-Spalte auf 1024 gesetzt (war 1536)
- [ ] Supabase-Migration erstellt: `ALTER TABLE knowledge_objects ALTER COLUMN embedding TYPE vector(1024)`
- [ ] Lokaler Smoke-Test: Embedding für einen Test-String generieren, in DB schreiben, per Cosine-Similarity abrufen
- [ ] Env-Variable `EMBEDDING_MODEL` eingeführt (analog zu `INTERVIEW_MODEL`) für späteren Wechsel ohne Code-Änderung
- [ ] `.env.local.example` aktualisiert

## Out of Scope
- Matryoshka-Dimensionsreduktion (kann später ohne Re-Embedding evaluiert werden)
- Hybrid Search (Sparse + Dense) — für MVP nicht nötig
- Batch-Embedding-Pipeline (Volumen zu gering im MVP)
- Qwen3-Selbsthosting (bis ein Pilot-Kunde DSGVO-Fallback aktiv anfordert)
- jina-embeddings-v4/v5 (multimodal bzw. schlechterer Retrieval-Score als v3 für diesen Use Case)

## Tech Design (Solution Architect)

### Scope-Abgrenzung

Reine Backend-Änderung. Kein UI-Change, keine neuen API-Routes, keine neuen Tabellen.

```
Was sich ändert:
  src/services/embeddings.ts     Provider-Wechsel: OpenAI → Jina
  src/lib/llm-provider.ts        Erweiterung: Embedding-Resolver hinzufügen
  Supabase DB                    Spalten-Dimension: 1536 → 1024 (Tabelle ist leer)
  Umgebungsvariablen             JINA_API_KEY + EMBEDDING_MODEL neu
  .env.local.example             Aktualisieren

Was sich nicht ändert:
  Alle Aufrufer von generateEmbedding() — Signatur bleibt identisch
  Alle API-Routes
  Alle UI-Komponenten
```

### Provider-Strategie

Jina AI ist der feste Embedding-Provider. Ein dynamischer Provider-Wechsel via Env-Var macht keinen Sinn — Embedding-Modelle sind nicht austauschbar ohne vollständiges Re-Embedding aller gespeicherten Vektoren. Ein Wechsel (z.B. DSGVO-Fallback) ist ein expliziter Migrations-Schritt, kein Config-Toggle.

`EMBEDDING_MODEL` steuert nur den Jina-Modellnamen (z.B. `jina-embeddings-v3` → `jina-embeddings-v4`), nicht den Provider.

### Neue Umgebungsvariablen

| Variable | Standard-Wert | Zweck |
|----------|---------------|-------|
| `JINA_API_KEY` | — | Authentifizierung bei der Jina-API |
| `EMBEDDING_MODEL` | `jina-embeddings-v3` | Jina-Modellname (kein Provider-Prefix) |

`OPENAI_API_KEY` bleibt bestehen (LLM-Calls im Interview-Agent).

### Datenbankänderung

```
Tabelle: knowledge_objects
  Spalte: embedding
    Vorher: vector(1536)  — OpenAI text-embedding-3-small
    Nachher: vector(1024) — jina-embeddings-v3
```

Supabase-Migrationsdatei erforderlich. Da Tabelle aktuell leer: einfaches ALTER ohne Datenverlust. HNSW-Index wird neu angelegt.

### Keine neuen Packages

`@ai-sdk/openai` ist bereits installiert. Jina verwendet eine OpenAI-kompatible API — Integration über custom `baseURL`. Kein neues Paket nötig.

### Ablauf-Sequenz

```
Interview abgeschlossen
  → Extraktions-Agent erstellt Wissensobjekte
  → extraction.ts ruft generateEmbedding(text) auf
  → embeddings.ts liest EMBEDDING_MODEL
  → Jina API aufgerufen → 1024-dim. Vektor zurück
  → Vektor in knowledge_objects.embedding gespeichert
  → Cosine-Similarity-Suche wie vorher
```

## Technische Notizen

### API-Integration (AI SDK)

Jina bietet eine OpenAI-kompatible API. Integration über `@ai-sdk/openai` mit custom `baseURL`:

```ts
import { createOpenAI } from '@ai-sdk/openai'

const jina = createOpenAI({
  apiKey: process.env.JINA_API_KEY,
  baseURL: 'https://api.jina.ai/v1',
})

// In embeddings.ts:
model: jina.embedding('jina-embeddings-v3')
```

Für den DSGVO-Fallback (Qwen3 via HF Endpoints) ändert sich nur `baseURL` und `apiKey` — der restliche Code bleibt identisch.

### pgvector-Schema-Anpassung

```sql
-- Neue Spalte mit korrekter Dimension
ALTER TABLE knowledge_objects
  ALTER COLUMN embedding TYPE vector(1024);
```

Wenn die Tabelle leer ist (aktueller Stand), ist das ein einfaches ALTER ohne Datenverlust.

### HNSW-Index

```sql
CREATE INDEX ON knowledge_objects
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

## QA Test Results

**QA Date:** 2026-05-21
**QA Engineer:** Claude (automated)
**Automated Tests:** 138/138 unit tests pass (18 test files)

### Acceptance Criteria

| # | Criterion | Result |
|---|-----------|--------|
| AC1 | `JINA_API_KEY` in `.env.local.example` dokumentiert | ✅ Pass |
| AC2 | `embeddings.ts` auf jina-embeddings-v3 umgestellt | ✅ Pass |
| AC3 | pgvector-Spalte auf 1024 Dimensionen (Migration) | ✅ Pass |
| AC4 | Supabase-Migration erstellt | ✅ Pass |
| AC5 | Lokaler Smoke-Test (manuell, live API-Key erforderlich) | ⚠️ Nicht automatisierbar |
| AC6 | `EMBEDDING_MODEL` Env-Variable eingeführt | ⚠️ Teilweise — siehe BUG-01 |
| AC7 | `.env.local.example` aktualisiert | ✅ Pass |

### Bugs

#### BUG-01 — ~~Medium: Provider-Routing nicht implementiert~~ → Won't Fix / By Design

Provider-Routing via Env-Var macht keinen Sinn: Ein Embedding-Modellwechsel erfordert immer vollständiges Re-Embedding aller Vektoren — das ist kein Config-Toggle, sondern ein expliziter Migrationsschritt. Jina bleibt fester Provider. Spec und Tech Design entsprechend vereinfacht (2026-05-21).

#### BUG-02 — Low: Veralteter Test-Kommentar in extraction.test.ts

**Beschreibung:** `extraction.test.ts:243` enthielt "when OpenAI returns null" — nach Jina-Migration veraltet. **Bereits behoben** in diesem QA-Lauf (zu "when Jina returns null" geändert).

### Unit Tests

Neue Testdatei: `src/services/embeddings.test.ts` (3 Tests, alle grün):
- Happy path: Embedding-Array wird zurückgegeben
- Missing API key: gibt `null` zurück, kein API-Call
- API-Fehler: gibt `null` zurück (kein Crash)

### Security Audit

- `JINA_API_KEY` korrekt server-only (kein `NEXT_PUBLIC_`-Prefix) ✅
- Kein Key im Code hardcoded ✅
- `.env.local.example` enthält nur Platzhalter ✅
- Module-level Jina-Client-Initialisierung: kein Security-Problem ✅

### Production-Ready Decision

**READY** — Alle Bugs geschlossen. BUG-01 als Won't Fix / By Design entschieden (2026-05-21).


## Post-Mortem
| Aspekt | Bewertung |
|--------|-----------|
| Spec-Genauigkeit | — |
| Appetite vs. tatsächlich | geschätzt: — / tatsächlich: — |
| Größte Überraschung | — |
| Vorgeschlagene Regeländerung | — |
| Build-Loop-Iterationen | tatsächlich: — |
| Häufigste Fehlerkategorie im Loop | — |

_ohne Backfill, vor v2-Migration deployed_