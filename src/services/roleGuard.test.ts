import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('ai', () => ({ generateText: vi.fn() }))
vi.mock('@/lib/llm-provider', () => ({ resolveModel: vi.fn().mockReturnValue({}) }))

import { generateText } from 'ai'
import {
  prefilterQuestionSignal,
  checkRoleGuard,
  buildOffTopicRedirect,
} from './roleGuard'
import type { TurnMessage } from './interviewTypes'

function mockJudgeResponse(cls: 'meta' | 'off_topic') {
  vi.mocked(generateText).mockResolvedValueOnce({
    text: `{"class": "${cls}"}`,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
}

afterEach(() => {
  vi.clearAllMocks()
  delete process.env.GUARD_JUDGE_MODEL
})

// ─── prefilterQuestionSignal (deterministic, no LLM) ─────────────────────────

describe('prefilterQuestionSignal', () => {
  it('fires on a trailing question mark', () => {
    expect(prefilterQuestionSignal('Und die wäre?')).toBe(true)
  })

  it('fires on a question-word opener at the start of the turn', () => {
    expect(prefilterQuestionSignal('Kannst du mir das nochmal erklären')).toBe(true)
    expect(prefilterQuestionSignal('Was möchtest du wissen')).toBe(true)
    expect(prefilterQuestionSignal('Kann ich dir auch eine Frage stellen')).toBe(true)
  })

  it('does NOT fire on an embedded question word mid-statement (no "?", no question-word start)', () => {
    // AC example verbatim: no '?', starts with "ich" → no trigger.
    expect(prefilterQuestionSignal('ich weiß nicht wie oft das auftritt')).toBe(false)
  })

  it('does NOT fire on a plain statement', () => {
    expect(prefilterQuestionSignal('Ich prüfe die Rechnungen täglich um neun Uhr.')).toBe(false)
  })

  it('does NOT fire on an empty turn', () => {
    expect(prefilterQuestionSignal('   ')).toBe(false)
  })
})

// ─── checkRoleGuard ───────────────────────────────────────────────────────────

describe('checkRoleGuard', () => {
  it('does not call the judge when the prefilter does not fire (cost/latency guard for the normal case)', async () => {
    const result = await checkRoleGuard('Ich prüfe die Rechnungen täglich.', [], 'google/gemini-3.1-flash-lite')
    expect(result.checked).toBe(false)
    expect(generateText).not.toHaveBeenCalled()
  })

  it('classifies an interview-meta clarification as "meta" — Tim turn 11 fixture ("und die wäre?")', async () => {
    mockJudgeResponse('meta')
    const history: TurnMessage[] = [
      { role: 'assistant', content: 'Welche andere regelmäßige Aufgabe nimmt bei dir viel Zeit ein?' },
    ]
    const result = await checkRoleGuard('und die wäre?', history, 'google/gemini-3.1-flash-lite')
    expect(result.checked).toBe(true)
    expect(result.classification).toBe('meta')
  })

  it('classifies an off-topic question as "off_topic" — Tim turn 16 fixture (VW-Golf price)', async () => {
    mockJudgeResponse('off_topic')
    const history: TurnMessage[] = [{ role: 'assistant', content: 'Schieß los.' }]
    const result = await checkRoleGuard('Was kostet eigentlich ein neuer VW Golf?', history, 'google/gemini-3.1-flash-lite')
    expect(result.checked).toBe(true)
    expect(result.classification).toBe('off_topic')
  })

  it('classifies an off-topic question as "off_topic" — Tim turn 17 fixture (flight prices)', async () => {
    mockJudgeResponse('off_topic')
    const history: TurnMessage[] = [{ role: 'assistant', content: 'Ok, interessant.' }]
    const result = await checkRoleGuard('Und was kostet ungefähr ein Flug nach Mallorca?', history, 'google/gemini-3.1-flash-lite')
    expect(result.checked).toBe(true)
    expect(result.classification).toBe('off_topic')
  })

  it('fail-safe passthrough (class=meta) after the judge call fails on every retry, with console.error', async () => {
    vi.mocked(generateText).mockRejectedValue(new Error('rate limited'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await checkRoleGuard('Und was noch?', [], 'google/gemini-3.1-flash-lite')

    expect(result.checked).toBe(true)
    expect(result.classification).toBe('meta')
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('recovers from a malformed judge response with fail-safe passthrough (class=meta) and a console.warn', async () => {
    vi.mocked(generateText).mockResolvedValueOnce({ text: 'not json' } as Awaited<ReturnType<typeof generateText>>)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await checkRoleGuard('Wieso fragst du das überhaupt?', [], 'google/gemini-3.1-flash-lite')

    expect(result.classification).toBe('meta')
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('throws when GUARD_JUDGE_MODEL shares the talker model family (ADR-020 D2 invariant, reused from talkerGroundingGuard)', async () => {
    process.env.GUARD_JUDGE_MODEL = 'google/gemini-3.5-flash'
    await expect(
      checkRoleGuard('Und was noch?', [], 'google/gemini-3.1-flash-lite'),
    ).rejects.toThrow(/GUARD_JUDGE_MODEL misconfigured/)
  })
})

// ─── buildOffTopicRedirect (deterministic, no LLM call) ──────────────────────

describe('buildOffTopicRedirect', () => {
  it('re-anchors on the last assistant turn verbatim', () => {
    const history: TurnMessage[] = [
      { role: 'assistant', content: 'Wie oft passiert das ungefähr pro Woche?' },
      { role: 'user', content: 'Was kostet ein VW Golf?' },
    ]
    const redirect = buildOffTopicRedirect(history)
    expect(redirect).toContain('Wie oft passiert das ungefähr pro Woche?')
    expect(redirect).toMatch(/Interviewer/)
  })

  it('falls back to a generic re-anchor when there is no prior assistant turn', () => {
    const redirect = buildOffTopicRedirect([])
    expect(redirect.length).toBeGreaterThan(0)
  })

  it('BUG-2: does not re-embed a prior redirect when off-topic turns follow each other (Tim turn 16→17)', () => {
    const question = 'Schieß los.'
    const history: TurnMessage[] = [
      { role: 'assistant', content: question },
      { role: 'user', content: 'Was kostet ein VW Golf?' },
    ]
    const redirectA = buildOffTopicRedirect(history)
    expect(redirectA).toBe(`Dazu kann ich als Interviewer leider nichts beitragen — bleiben wir beim Prozessgespräch. ${question}`)

    // Turn B: the just-computed redirect is now the last assistant turn, exactly
    // as it would be persisted to history by runInterviewTurn.ts.
    const historyAfterA: TurnMessage[] = [
      ...history,
      { role: 'assistant', content: redirectA },
      { role: 'user', content: 'Und was kostet ungefähr ein Flug nach Mallorca?' },
    ]
    const redirectB = buildOffTopicRedirect(historyAfterA)

    // Same message as redirectA — no growth, no nested redirect prefix.
    expect(redirectB).toBe(redirectA)
    expect(redirectB.match(/Dazu kann ich als Interviewer/g)?.length).toBe(1)
  })

  it('BUG-2: a third consecutive off-topic turn still produces the same, non-growing redirect', () => {
    const question = 'Wie oft passiert das ungefähr pro Woche?'
    let history: TurnMessage[] = [{ role: 'assistant', content: question }]
    let redirect = ''
    for (let i = 0; i < 3; i++) {
      history = [...history, { role: 'user', content: `Off-topic Frage ${i}?` }]
      redirect = buildOffTopicRedirect(history)
      history = [...history, { role: 'assistant', content: redirect }]
    }
    expect(redirect).toBe(`Dazu kann ich als Interviewer leider nichts beitragen — bleiben wir beim Prozessgespräch. ${question}`)
    expect(redirect.match(/Dazu kann ich als Interviewer/g)?.length).toBe(1)
  })
})
