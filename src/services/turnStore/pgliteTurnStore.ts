/**
 * PGliteTurnStore — the Eval adapter (PROJ-34 / ADR-018 D4, D7).
 *
 * A local in-process Postgres (PGlite, WASM) with NO network and NO
 * EVAL_WORKSPACE_ID. Loads the real repo migrations (`supabase/migrations/`) —
 * the single schema truth, also for PGlite — preceded by an inert bootstrap
 * that stubs the Supabase-only constructs (roles, `auth` schema + `auth.uid()`,
 * vector extension) so the GRANT/POLICY/vector lines load without the tests
 * touching auth. PGlite runs as the owning superuser and therefore bypasses
 * RLS, so the policies are inert.
 *
 * Hard-fails on a migration that won't load (ADR-018 Edge Case) rather than
 * silently drifting; the gated Stufe-3 contract test against real Supabase is
 * the second line of defence.
 *
 * Node/eval-only: imports `@electric-sql/pglite`. Never bundled into the Next
 * client. Pinned at pglite 0.4.6 — the last version bundling `./vector`.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { vector } from '@electric-sql/pglite/vector'
import { normalizeStepEntry, type StepEntry, type RawExtraction } from '@/services/interviewSemantic'
import type { Json } from '@/lib/database.types'
import type { AnalystBriefing } from '@/services/interviewTypes'
import {
  createInterviewStore,
  type InterviewStore,
  type InterviewStoreBackend,
  type InterviewRow,
  type StateRow,
  type TurnRow,
  type InsertTurnInput,
} from './port'
import type { KnowledgeObjectInsert, TurnSnapshot } from './intents'

/**
 * Inert bootstrap (ADR-018 D7). Runs before the repo migrations. Everything
 * here exists only so the Supabase-specific migration lines parse — the eval
 * never authenticates and never exercises RLS.
 */
const INERT_BOOTSTRAP = `
-- pgvector so vector(N) columns + ivfflat/hnsw indexes load as DDL.
CREATE EXTENSION IF NOT EXISTS vector;

-- Supabase pre-provisions this schema (+ the search_path below) on every real
-- project; PROJ-16's "move vector extension to extensions schema" migration
-- (ALTER EXTENSION vector SET SCHEMA extensions) assumes both already exist —
-- its own comment says so ("DB search_path already includes extensions").
-- PGlite starts from a bare Postgres with neither, so the migration fails
-- without this (schema missing, then "type vector does not exist" once the
-- ALTER FUNCTION lines in the same migration try to resolve it unqualified).
CREATE SCHEMA IF NOT EXISTS extensions;
SET search_path TO "$user", public, extensions;

-- Supabase roles referenced by GRANT ... TO <role> lines.
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE anon;          EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role;  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Minimal auth schema: FK target (auth.users) + auth.uid() used in RLS policies.
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email              text,
  raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
`

function defaultMigrationsDir(): string {
  return join(process.cwd(), 'supabase', 'migrations')
}

/** Reads `*.sql` migrations in filename (chronological) order. */
function loadMigrationSql(dir: string): Array<{ name: string; sql: string }> {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((name) => ({ name, sql: readFileSync(join(dir, name), 'utf8') }))
}

export interface PGliteTurnStoreHandle {
  store: InterviewStore
  /** Raw PGlite handle — for the runner's final-state reads and seeding. */
  db: PGlite
  /** Create the workspace + interview + interview_state rows a turn needs. */
  seedInterview(opts: SeedInterviewOptions): Promise<void>
  /** Read the persisted, normalized step_tracker (the eval's finalStepTracker). */
  readStepTracker(interviewId: string): Promise<StepEntry[]>
  close(): Promise<void>
}

export interface SeedInterviewOptions {
  interviewId: string
  workspaceId: string
  employeeName?: string
  employeeRole?: string | null
  department?: string | null
  focusTopics?: string | null
  maxDurationMinutes?: number
  userId?: string
}

class PGliteBackend implements InterviewStoreBackend {
  constructor(private readonly db: PGlite) {}

  async loadSnapshot(interviewId: string): Promise<TurnSnapshot> {
    const [res, briefingRes] = await Promise.all([
      this.db.query<{
        step_tracker: unknown
        topics_covered: string[] | null
        topics_open: string[] | null
        extractions_log: unknown
      }>(
        `SELECT step_tracker, topics_covered, topics_open, extractions_log
         FROM interview_state WHERE interview_id = $1`,
        [interviewId],
      ),
      this.db.query<{ next_briefing: unknown }>(
        `SELECT next_briefing FROM interviews WHERE id = $1`,
        [interviewId],
      ),
    ])
    const row = res.rows[0]
    const rawTracker = (row?.step_tracker as unknown[] | null) ?? []
    const nextBriefing = briefingRes.rows[0]?.next_briefing as { usedFillerPhrases?: string[] } | null
    return {
      stepTracker: rawTracker.map((raw, i) => normalizeStepEntry(raw, i + 1)),
      topicsCovered: row?.topics_covered ?? [],
      topicsOpen: row?.topics_open ?? [],
      extractionsLog: (row?.extractions_log as RawExtraction[] | null) ?? [],
      usedFillerPhrases: nextBriefing?.usedFillerPhrases ?? [],
    }
  }

  async patchStepField(interviewId: string, stepIndex: number, subPath: string[], value: Json): Promise<void> {
    await this.db.query(
      `SELECT patch_interview_step_field($1::uuid, $2::int, $3::text[], $4::jsonb)`,
      [interviewId, stepIndex, subPath, JSON.stringify(value)],
    )
  }

  async setStepTracker(interviewId: string, tracker: StepEntry[]): Promise<void> {
    await this.db.query(
      `UPDATE interview_state SET step_tracker = $2::jsonb, updated_at = now() WHERE interview_id = $1`,
      [interviewId, JSON.stringify(tracker)],
    )
  }

  async setTopics(interviewId: string, covered: string[], open: string[]): Promise<void> {
    await this.db.query(
      `UPDATE interview_state SET topics_covered = $2::text[], topics_open = $3::text[], updated_at = now() WHERE interview_id = $1`,
      [interviewId, covered, open],
    )
  }

  async setExtractionsLog(interviewId: string, log: RawExtraction[]): Promise<void> {
    await this.db.query(
      `UPDATE interview_state SET extractions_log = $2::jsonb, updated_at = now() WHERE interview_id = $1`,
      [interviewId, JSON.stringify(log)],
    )
  }

  async insertKnowledgeObject(row: KnowledgeObjectInsert): Promise<void> {
    await this.db.query(
      `INSERT INTO knowledge_objects (interview_id, workspace_id, type, content, source_quote)
       VALUES ($1::uuid, $2::uuid, $3, $4::jsonb, $5)`,
      [row.interview_id, row.workspace_id, row.type, JSON.stringify(row.content), row.source_quote],
    )
  }

  async updateInterview(
    interviewId: string,
    fields: { next_briefing?: AnalystBriefing; analyst_status?: string },
    onlyIfNotDone?: boolean,
  ): Promise<void> {
    const sets: string[] = []
    const params: unknown[] = [interviewId]
    if (fields.next_briefing !== undefined) {
      params.push(JSON.stringify(fields.next_briefing))
      sets.push(`next_briefing = $${params.length}::jsonb`)
    }
    if (fields.analyst_status !== undefined) {
      params.push(fields.analyst_status)
      sets.push(`analyst_status = $${params.length}`)
    }
    if (sets.length === 0) return
    const guard = onlyIfNotDone ? ` AND analyst_status IS DISTINCT FROM 'done'` : ''
    await this.db.query(`UPDATE interviews SET ${sets.join(', ')} WHERE id = $1${guard}`, params)
  }

  // ── Orchestration (runInterviewTurn) ────────────────────────────────────────

  async loadInterview(interviewId: string): Promise<InterviewRow | null> {
    const res = await this.db.query<InterviewRow>(
      `SELECT id, workspace_id, employee_name, employee_role, department, focus_topics, status, max_duration_minutes, analyst_status, next_briefing
       FROM interviews WHERE id = $1`,
      [interviewId],
    )
    return res.rows[0] ?? null
  }

  async loadState(interviewId: string): Promise<StateRow | null> {
    const res = await this.db.query<StateRow>(
      `SELECT phase, timer_minutes, topics_covered, topics_open, extractions_log, step_tracker, opener_text
       FROM interview_state WHERE interview_id = $1`,
      [interviewId],
    )
    return res.rows[0] ?? null
  }

  async loadTurns(interviewId: string): Promise<TurnRow[]> {
    const res = await this.db.query<TurnRow>(
      `SELECT turn_number, user_input, agent_response, created_at
       FROM turns WHERE interview_id = $1 ORDER BY turn_number ASC`,
      [interviewId],
    )
    return res.rows
  }

  async insertTurn(row: InsertTurnInput): Promise<{ id: string } | null> {
    try {
      const res = await this.db.query<{ id: string }>(
        `INSERT INTO turns (interview_id, turn_number, user_input, agent_response)
         VALUES ($1::uuid, $2, $3, $4) RETURNING id`,
        [row.interviewId, row.turnNumber, row.userInput, row.agentResponse],
      )
      return res.rows[0] ?? null
    } catch (err) {
      console.error('[PGliteTurnStore] insertTurn failed:', (err as Error).message)
      return null
    }
  }

  async updatePhase(interviewId: string, phase: string): Promise<void> {
    await this.db.query(
      `UPDATE interview_state SET phase = $2, updated_at = now() WHERE interview_id = $1`,
      [interviewId, phase],
    )
  }

  async completeInterview(interviewId: string): Promise<void> {
    await this.db.query(
      `UPDATE interviews SET status = 'completed', extractions_pending = true WHERE id = $1`,
      [interviewId],
    )
  }

  async setAnalystStatus(interviewId: string, status: string): Promise<void> {
    await this.db.query(`UPDATE interviews SET analyst_status = $2 WHERE id = $1`, [interviewId, status])
  }

  async updateStateAfterTurn(
    interviewId: string,
    fields: { timerMinutes?: number; extractionsLog?: RawExtraction[]; openerText?: string },
  ): Promise<void> {
    const sets: string[] = ['updated_at = now()']
    const params: unknown[] = [interviewId]
    if (fields.timerMinutes !== undefined) {
      params.push(fields.timerMinutes)
      sets.push(`timer_minutes = $${params.length}`)
    }
    if (fields.extractionsLog !== undefined) {
      params.push(JSON.stringify(fields.extractionsLog))
      sets.push(`extractions_log = $${params.length}::jsonb`)
    }
    if (fields.openerText !== undefined) {
      params.push(fields.openerText)
      sets.push(`opener_text = $${params.length}`)
    }
    await this.db.query(`UPDATE interview_state SET ${sets.join(', ')} WHERE interview_id = $1`, params)
  }

  async loadStepTracker(interviewId: string): Promise<unknown[]> {
    const res = await this.db.query<{ step_tracker: unknown }>(
      `SELECT step_tracker FROM interview_state WHERE interview_id = $1`,
      [interviewId],
    )
    return (res.rows[0]?.step_tracker as unknown[] | null) ?? []
  }
}

/**
 * Boot a PGlite instance, run the inert bootstrap + the real repo migrations,
 * and return the TurnStore plus seed/read helpers. Throws hard if any migration
 * fails to load.
 */
export async function createPGliteTurnStore(opts?: { migrationsDir?: string }): Promise<PGliteTurnStoreHandle> {
  const db = new PGlite({ extensions: { vector } })
  await db.exec(INERT_BOOTSTRAP)

  const dir = opts?.migrationsDir ?? defaultMigrationsDir()
  for (const { name, sql } of loadMigrationSql(dir)) {
    try {
      await db.exec(sql)
    } catch (err) {
      // Hard fail (ADR-018 D7) — never silently drift.
      throw new Error(`[PGliteTurnStore] migration "${name}" failed to load: ${(err as Error).message}`)
    }
  }

  const backend = new PGliteBackend(db)
  const store = createInterviewStore(backend)

  return {
    store,
    db,
    async seedInterview(o: SeedInterviewOptions): Promise<void> {
      const userId = o.userId ?? '00000000-0000-0000-0000-0000000000aa'
      await db.query(`INSERT INTO auth.users (id) VALUES ($1::uuid) ON CONFLICT DO NOTHING`, [userId])
      await db.query(
        `INSERT INTO workspaces (id, name, user_id) VALUES ($1::uuid, $2, $3::uuid) ON CONFLICT DO NOTHING`,
        [o.workspaceId, 'Eval Workspace', userId],
      )
      await db.query(
        `INSERT INTO interviews (id, workspace_id, employee_name, employee_role, department, focus_topics, status, access_token, token_expires_at, max_duration_minutes, analyst_status)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, 'active', $7, now() + interval '7 days', $8, 'idle')`,
        [
          o.interviewId,
          o.workspaceId,
          o.employeeName ?? 'Eval Persona',
          o.employeeRole ?? null,
          o.department ?? 'Eval Department',
          o.focusTopics ?? null,
          `eval-${o.interviewId}`,
          o.maxDurationMinutes ?? 30,
        ],
      )
      await db.query(
        `INSERT INTO interview_state (interview_id, phase, step_tracker) VALUES ($1::uuid, 'intro', '[]'::jsonb)`,
        [o.interviewId],
      )
    },
    async readStepTracker(interviewId: string): Promise<StepEntry[]> {
      const res = await db.query<{ step_tracker: unknown }>(
        `SELECT step_tracker FROM interview_state WHERE interview_id = $1`,
        [interviewId],
      )
      const raw = (res.rows[0]?.step_tracker as unknown[] | null) ?? []
      return raw.map((r, i) => normalizeStepEntry(r, i + 1))
    },
    async close(): Promise<void> {
      await db.close()
    },
  }
}
