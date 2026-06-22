/**
 * MemoryTurnStore — an in-process, in-memory TurnStore backend (PROJ-34).
 *
 * Not used in prod or eval; it exists as the lightweight test double for the
 * tool/caller migration (assert tool feedback + resulting state without booting
 * PGlite or mocking Supabase) and as a third reference implementation of the
 * `TurnStoreBackend` contract. Pure, no I/O.
 */

import type { Json } from '@/lib/database.types'
import type { StepEntry } from '@/services/interviewSemantic'
import type { RawExtraction } from '@/services/extraction'
import type { AnalystBriefing } from '@/services/interviewTypes'
import { createTurnStore, type TurnStore, type TurnStoreBackend } from './port'
import type { KnowledgeObjectInsert, TurnSnapshot } from './intents'

export interface MemoryState {
  stepTracker: StepEntry[]
  topicsCovered: string[]
  topicsOpen: string[]
  extractionsLog: RawExtraction[]
  nextBriefing: AnalystBriefing | null
  analystStatus: string | null
  knowledgeObjects: KnowledgeObjectInsert[]
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

export class MemoryBackend implements TurnStoreBackend {
  readonly state: MemoryState

  constructor(initial: Partial<MemoryState> = {}) {
    this.state = {
      stepTracker: initial.stepTracker ?? [],
      topicsCovered: initial.topicsCovered ?? [],
      topicsOpen: initial.topicsOpen ?? [],
      extractionsLog: initial.extractionsLog ?? [],
      nextBriefing: initial.nextBriefing ?? null,
      analystStatus: initial.analystStatus ?? 'idle',
      knowledgeObjects: initial.knowledgeObjects ?? [],
    }
  }

  async loadSnapshot(): Promise<TurnSnapshot> {
    return {
      stepTracker: clone(this.state.stepTracker),
      topicsCovered: clone(this.state.topicsCovered),
      topicsOpen: clone(this.state.topicsOpen),
      extractionsLog: clone(this.state.extractionsLog),
    }
  }

  async patchStepField(_interviewId: string, stepIndex: number, subPath: string[], value: Json): Promise<void> {
    // Mirror jsonb_set(create_missing=true) on the in-memory tracker.
    let obj = this.state.stepTracker[stepIndex] as unknown as Record<string, unknown>
    for (let i = 0; i < subPath.length - 1; i++) {
      const key = subPath[i]
      if (obj[key] == null || typeof obj[key] !== 'object') obj[key] = {}
      obj = obj[key] as Record<string, unknown>
    }
    obj[subPath[subPath.length - 1]] = value as unknown
  }

  async setStepTracker(_interviewId: string, tracker: StepEntry[]): Promise<void> {
    this.state.stepTracker = clone(tracker)
  }

  async setTopics(_interviewId: string, covered: string[], open: string[]): Promise<void> {
    this.state.topicsCovered = covered
    this.state.topicsOpen = open
  }

  async setExtractionsLog(_interviewId: string, log: RawExtraction[]): Promise<void> {
    this.state.extractionsLog = clone(log)
  }

  async insertKnowledgeObject(row: KnowledgeObjectInsert): Promise<void> {
    this.state.knowledgeObjects.push(row)
  }

  async updateInterview(
    _interviewId: string,
    fields: { next_briefing?: AnalystBriefing; analyst_status?: string },
    onlyIfNotDone?: boolean,
  ): Promise<void> {
    if (onlyIfNotDone && this.state.analystStatus === 'done') return
    if (fields.next_briefing !== undefined) this.state.nextBriefing = fields.next_briefing
    if (fields.analyst_status !== undefined) this.state.analystStatus = fields.analyst_status
  }
}

/** Convenience: a TurnStore + its backing state for assertions. */
export function createMemoryTurnStore(initial: Partial<MemoryState> = {}): { store: TurnStore; backend: MemoryBackend } {
  const backend = new MemoryBackend(initial)
  return { store: createTurnStore(backend), backend }
}
