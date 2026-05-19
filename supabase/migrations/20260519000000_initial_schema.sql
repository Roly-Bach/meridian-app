-- Meridian MVP — Initial Schema
-- Date: 2026-05-19
-- Author: Lias Hemmersbach
-- Related ADR: docs/adr/ADR-002-hybrid-backend-eu.md

-- ============================================================================
-- Extensions
-- ============================================================================

-- pgvector für Embeddings (Vektor-Suche über Interview-Wissen)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- Tabellen
-- ============================================================================

-- Unternehmen (Pilot-Kunden, Standorte der Mitarbeiter-Interviews)
CREATE TABLE unternehmen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  branche text,
  notizen text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Mitarbeiter (Interview-Teilnehmer)
CREATE TABLE mitarbeiter (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unternehmen_id uuid NOT NULL REFERENCES unternehmen(id) ON DELETE CASCADE,
  name text NOT NULL,
  abteilung text,
  rolle text,
  email text,
  einwilligung_datum timestamptz,
  einwilligung_version text,
  notizen text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Interviews
CREATE TABLE interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mitarbeiter_id uuid NOT NULL REFERENCES mitarbeiter(id) ON DELETE CASCADE,
  datum date NOT NULL,
  dauer_minuten integer,
  status text NOT NULL DEFAULT 'geplant'
    CHECK (status IN ('geplant', 'durchgefuehrt', 'transkribiert', 'analysiert', 'archiviert')),
  thema text,
  transcript text,
  audio_storage_path text,
  notizen text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Wissens-Chunks (für Vektor-Suche und Analyse)
-- vector(1536) entspricht OpenAI text-embedding-3-small.
-- Bei Wechsel zu Gemini text-embedding-004: vector(768).
-- Bei Wechsel zu OpenAI text-embedding-3-large: vector(3072).
CREATE TABLE knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  content text NOT NULL,
  embedding vector(1536),
  embedding_model text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- pgvector Index für Ähnlichkeitssuche (IVFFlat, gut bis ~100k Chunks)
-- Bei > 1M Chunks: HNSW prüfen.
CREATE INDEX idx_knowledge_chunks_embedding
  ON knowledge_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Foreign-Key-Indexes für Performance
CREATE INDEX idx_mitarbeiter_unternehmen ON mitarbeiter(unternehmen_id);
CREATE INDEX idx_interviews_mitarbeiter ON interviews(mitarbeiter_id);
CREATE INDEX idx_interviews_status ON interviews(status);
CREATE INDEX idx_knowledge_chunks_interview ON knowledge_chunks(interview_id);

-- ============================================================================
-- updated_at Trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_unternehmen_updated BEFORE UPDATE ON unternehmen
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_mitarbeiter_updated BEFORE UPDATE ON mitarbeiter
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_interviews_updated BEFORE UPDATE ON interviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- Row Level Security
-- ============================================================================
-- Initial: Nur authenticated users können lesen/schreiben.
-- Verfeinerung in späterer Migration: pro Unternehmen, Rolle, etc.

ALTER TABLE unternehmen ENABLE ROW LEVEL SECURITY;
ALTER TABLE mitarbeiter ENABLE ROW LEVEL SECURITY;
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- Authenticated users: full access (für MVP-Phase, später eingeschränkt)
CREATE POLICY "Authenticated users can read unternehmen"
  ON unternehmen FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert unternehmen"
  ON unternehmen FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update unternehmen"
  ON unternehmen FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete unternehmen"
  ON unternehmen FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read mitarbeiter"
  ON mitarbeiter FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert mitarbeiter"
  ON mitarbeiter FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update mitarbeiter"
  ON mitarbeiter FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete mitarbeiter"
  ON mitarbeiter FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read interviews"
  ON interviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert interviews"
  ON interviews FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update interviews"
  ON interviews FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete interviews"
  ON interviews FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read knowledge_chunks"
  ON knowledge_chunks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert knowledge_chunks"
  ON knowledge_chunks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update knowledge_chunks"
  ON knowledge_chunks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete knowledge_chunks"
  ON knowledge_chunks FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- Seed-Data (optional, nur für lokales Testen, in Production weglassen)
-- ============================================================================

-- Auskommentiert für Production. Aktivieren für lokalen Smoke-Test.

-- INSERT INTO unternehmen (name, branche) VALUES
--   ('Mahr GmbH', 'Praezisionsmesstechnik'),
--   ('Knoll Maschinenbau', 'Schleifmaschinen');

-- INSERT INTO mitarbeiter (unternehmen_id, name, abteilung, rolle) VALUES
--   ((SELECT id FROM unternehmen WHERE name = 'Mahr GmbH'), 'Test-Mitarbeiter', 'Fertigung', 'Schichtleiter');
