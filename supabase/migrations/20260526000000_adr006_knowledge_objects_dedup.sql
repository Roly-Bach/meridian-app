-- ============================================================================
-- Migration: ADR-006 D13 — Workspace-Level Knowledge Object Deduplication
-- Adds existing_count and last_seen_at to knowledge_objects for dedup tracking.
-- existing_count: how many semantically identical objects were merged into this one.
-- last_seen_at: timestamp of the most recent duplicate seen.
-- Both default to safe values for existing rows.
-- Date: 2026-05-26
-- ============================================================================

ALTER TABLE knowledge_objects
  ADD COLUMN IF NOT EXISTS existing_count int4 NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();
