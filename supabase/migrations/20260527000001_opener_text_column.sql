-- ============================================================================
-- Migration: PROJ-17 / PROJ-3 — opener_text in interview_state
-- Date: 2026-05-27
-- ============================================================================

-- Saves the streamed opener (first agent message) so the Interview UI
-- can prepend it in the chat history on reconnect.
ALTER TABLE interview_state
  ADD COLUMN IF NOT EXISTS opener_text TEXT;
