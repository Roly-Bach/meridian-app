import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useInterviewStream } from './useInterviewStream'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeStreamResponse(chunks: string[], status = 200): Response {
  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
  return new Response(readable, { status })
}

function makeErrorResponse(body: object, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useInterviewStream', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('sendMessage: accumulates chunks and calls onChunk for each', async () => {
    const chunks = ['Hallo ', 'Welt', '!']
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(makeStreamResponse(chunks))

    const { result } = renderHook(() => useInterviewStream('tok123'))
    const received: string[] = []

    await act(async () => {
      await result.current.sendMessage('Hi', (chunk) => received.push(chunk))
    })

    expect(fetch).toHaveBeenCalledWith(
      '/api/interview/tok123/chat',
      expect.objectContaining({ method: 'POST' })
    )
    expect(received.join('')).toBe('Hallo Welt!')
    expect(result.current.isStreaming).toBe(false)
  })

  it('reconnect: calls correct endpoint with empty body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(makeStreamResponse(['OK']))

    const { result } = renderHook(() => useInterviewStream('tok-abc'))

    await act(async () => {
      await result.current.reconnect(() => {})
    })

    expect(fetch).toHaveBeenCalledWith(
      '/api/interview/tok-abc/reconnect',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({}),
      })
    )
  })

  it('error: sets error state on non-200 response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      makeErrorResponse({ error: 'Interview not found' }, 404)
    )

    const { result } = renderHook(() => useInterviewStream('bad-token'))

    await act(async () => {
      await result.current.sendMessage('Hi', () => {})
    })

    expect(result.current.error).toBe('Interview not found')
    expect(result.current.isStreaming).toBe(false)
  })

  it('error: falls back to generic error message when response has no error field', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('', { status: 500 })
    )

    const { result } = renderHook(() => useInterviewStream('tok'))

    await act(async () => {
      await result.current.sendMessage('Hi', () => {})
    })

    expect(result.current.error).toContain('500')
    expect(result.current.isStreaming).toBe(false)
  })

  it('clearError: resets error state', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      makeErrorResponse({ error: 'some error' }, 500)
    )

    const { result } = renderHook(() => useInterviewStream('tok'))

    await act(async () => {
      await result.current.sendMessage('Hi', () => {})
    })

    expect(result.current.error).not.toBeNull()

    act(() => result.current.clearError())

    expect(result.current.error).toBeNull()
  })

  it('timeout: sets German timeout error after 90s', async () => {
    vi.useFakeTimers()

    let capturedSignal: AbortSignal | undefined
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce((_url, init) => {
      capturedSignal = init?.signal as AbortSignal
      return new Promise<Response>((_resolve, reject) => {
        capturedSignal!.addEventListener('abort', () => {
          const err = new DOMException('', 'AbortError')
          Object.defineProperty(err, 'cause', { value: capturedSignal!.reason })
          reject(err)
        })
      })
    })

    const { result } = renderHook(() => useInterviewStream('tok'))

    let sendPromise: Promise<void>
    act(() => {
      sendPromise = result.current.sendMessage('Hi', () => {})
    })

    // Advance to trigger 90s timeout
    vi.advanceTimersByTime(90_000)
    await act(async () => { await sendPromise! })

    vi.useRealTimers()

    expect(capturedSignal?.aborted).toBe(true)
    expect(capturedSignal?.reason).toBe('timeout')
    expect(result.current.error).toBe('Antwort dauert zu lange – bitte erneut versuchen.')
    expect(result.current.isStreaming).toBe(false)
  })

  it('timeout: manual abort (new request) does NOT set error', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce((_url, init) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          // No cause set → manual abort, not timeout
          reject(new DOMException('Aborted', 'AbortError'))
        })
      })
    })

    const { result } = renderHook(() => useInterviewStream('tok'))

    let firstPromise: Promise<void>
    act(() => {
      firstPromise = result.current.sendMessage('Hi', () => {})
    })

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(makeStreamResponse([]))
    await act(async () => {
      await result.current.sendMessage('Hi again', () => {})
    })
    await act(async () => { await firstPromise! })

    expect(result.current.error).toBeNull()
  })

  it('abort: aborting in-flight request does not set error', async () => {
    let resolveStream!: () => void
    const pendingStream = new Promise<void>((res) => { resolveStream = res })
    const encoder = new TextEncoder()

    const readable = new ReadableStream({
      async start(controller) {
        await pendingStream
        controller.enqueue(encoder.encode('chunk'))
        controller.close()
      },
    })

    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(
      (_url, init) =>
        new Promise((resolve) => {
          // resolve immediately so the hook can start reading
          resolve(new Response(readable, { status: 200 }))
          // honor abort signal
          init?.signal?.addEventListener('abort', () => resolveStream())
        })
    )

    const { result } = renderHook(() => useInterviewStream('tok'))

    // start streaming in background
    let sendPromise: Promise<void>
    act(() => {
      sendPromise = result.current.sendMessage('Hi', () => {})
    })

    // abort by starting a new request (hook aborts previous on next call)
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(makeStreamResponse([]))
    await act(async () => {
      await result.current.sendMessage('Hi again', () => {})
    })

    await act(async () => { await sendPromise! })

    expect(result.current.error).toBeNull()
  })
})
