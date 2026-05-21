import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { arrayBufferToBase64, float32ToInt16Pcm, useVoiceInput } from './useVoiceInput'

// ── Helpers unit tests ────────────────────────────────────────────────────────

describe('arrayBufferToBase64', () => {
  it('encodes a known byte sequence correctly', () => {
    const buf = new Uint8Array([72, 101, 108, 108, 111]).buffer // "Hello"
    expect(arrayBufferToBase64(buf)).toBe(btoa('Hello'))
  })

  it('handles an empty buffer', () => {
    expect(arrayBufferToBase64(new ArrayBuffer(0))).toBe('')
  })
})

describe('float32ToInt16Pcm', () => {
  it('converts +1.0 to max positive Int16', () => {
    const samples = new Float32Array([1.0])
    const buf = float32ToInt16Pcm(samples, 16000) // no resampling needed at 16 kHz
    const view = new Int16Array(buf)
    expect(view[0]).toBe(0x7fff)
  })

  it('converts -1.0 to -32767', () => {
    const samples = new Float32Array([-1.0])
    const buf = float32ToInt16Pcm(samples, 16000)
    const view = new Int16Array(buf)
    expect(view[0]).toBe(-0x7fff)
  })

  it('clamps values above 1.0', () => {
    const samples = new Float32Array([2.0])
    const buf = float32ToInt16Pcm(samples, 16000)
    const view = new Int16Array(buf)
    expect(view[0]).toBe(0x7fff)
  })

  it('clamps values below -1.0', () => {
    const samples = new Float32Array([-2.0])
    const buf = float32ToInt16Pcm(samples, 16000)
    const view = new Int16Array(buf)
    expect(view[0]).toBe(-0x7fff)
  })

  it('converts 0.0 to 0', () => {
    const samples = new Float32Array([0.0])
    const buf = float32ToInt16Pcm(samples, 16000)
    const view = new Int16Array(buf)
    expect(view[0]).toBe(0)
  })

  it('resamples from 32000 Hz to 16000 Hz (2:1 ratio)', () => {
    // 4 input samples at 32 kHz → 2 output samples at 16 kHz
    const samples = new Float32Array([0.5, 0.5, -0.5, -0.5])
    const buf = float32ToInt16Pcm(samples, 32000)
    const view = new Int16Array(buf)
    expect(view.length).toBe(2)
  })
})

// ── Hook integration tests ────────────────────────────────────────────────────

// WebSocket mock
// Note: onopen/onmessage/onerror/onclose are set as properties by the hook,
// so we must call them directly rather than using dispatchEvent.
class MockWebSocket {
  static OPEN = 1
  static CONNECTING = 0
  static CLOSING = 2
  static CLOSED = 3

  readyState = MockWebSocket.CONNECTING
  url: string
  sent: string[] = []

  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: Event) => void) | null = null

  constructor(url: string) {
    this.url = url
    MockWebSocket._instances.push(this)
  }

  send(data: string) {
    this.sent.push(data)
  }

  close() {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.(new Event('close'))
  }

  // Test helper: simulate server open
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.(new Event('open'))
  }

  // Test helper: simulate server message
  simulateMessage(data: unknown) {
    const event = new MessageEvent('message', { data: JSON.stringify(data) })
    this.onmessage?.(event)
  }

  simulateError() {
    this.onerror?.(new Event('error'))
    this.close()
  }

  static _instances: MockWebSocket[] = []
  static latest(): MockWebSocket {
    return MockWebSocket._instances[MockWebSocket._instances.length - 1]
  }
}

// AudioContext mock
class MockAudioContext {
  sampleRate = 16000
  // No audioWorklet property — forces ScriptProcessor fallback
  audioWorklet = undefined

  createMediaStreamSource = vi.fn().mockReturnValue({
    connect: vi.fn(),
  })

  createScriptProcessor = vi.fn().mockReturnValue({
    connect: vi.fn(),
    disconnect: vi.fn(),
    addEventListener: vi.fn(),
    onaudioprocess: null as ((e: AudioProcessingEvent) => void) | null,
  })

  close = vi.fn().mockResolvedValue(undefined)
  destination = {}
}

beforeEach(() => {
  MockWebSocket._instances = []

  // Global mocks
  vi.stubGlobal('WebSocket', MockWebSocket)
  vi.stubGlobal('AudioContext', MockAudioContext)
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }],
      }),
    },
  })

  // fetch mock for voice-token endpoint
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sessionToken: 'test-session-token' }),
    })
  )
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('useVoiceInput — state transitions', () => {
  it('starts in idle state', () => {
    const onCommitted = vi.fn()
    const { result } = renderHook(() =>
      useVoiceInput({ token: 'test-token', onCommitted })
    )
    expect(result.current.state).toBe('idle')
    expect(result.current.partialText).toBe('')
  })

  it('transitions to connecting then listening on start()', async () => {
    const onCommitted = vi.fn()
    const { result } = renderHook(() =>
      useVoiceInput({ token: 'test-token', onCommitted })
    )

    // Kick off start — do NOT await here so we can observe intermediate state
    act(() => {
      void result.current.start()
    })

    // Should be connecting immediately
    expect(result.current.state).toBe('connecting')

    // Wait for WS to be created and open it
    await waitFor(() => MockWebSocket._instances.length > 0)
    act(() => {
      MockWebSocket.latest().simulateOpen()
    })

    await waitFor(() => result.current.state === 'listening')
    expect(result.current.state).toBe('listening')
  })

  it('does not start when disabled=true', async () => {
    const onCommitted = vi.fn()
    const { result } = renderHook(() =>
      useVoiceInput({ token: 'test-token', onCommitted, disabled: true })
    )

    await act(async () => {
      await result.current.start()
    })

    expect(result.current.state).toBe('idle')
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('useVoiceInput — WebSocket messages', () => {
  async function setupListening(onCommitted: (text: string) => void) {
    const { result } = renderHook(() =>
      useVoiceInput({ token: 'test-token', onCommitted })
    )

    act(() => {
      void result.current.start()
    })

    await waitFor(() => MockWebSocket._instances.length > 0)
    act(() => {
      MockWebSocket.latest().simulateOpen()
    })
    await waitFor(() => result.current.state === 'listening')

    return result
  }

  it('sets partialText on partial_transcript message', async () => {
    const onCommitted = vi.fn()
    const result = await setupListening(onCommitted)

    act(() => {
      MockWebSocket.latest().simulateMessage({
        message_type: 'partial_transcript',
        text: 'Hallo Welt',
      })
    })

    expect(result.current.partialText).toBe('Hallo Welt')
  })

  it('calls onCommitted and clears partialText on committed_transcript', async () => {
    const onCommitted = vi.fn()
    const result = await setupListening(onCommitted)

    act(() => {
      MockWebSocket.latest().simulateMessage({
        message_type: 'committed_transcript',
        text: '  Ich arbeite im Vertrieb.  ',
      })
    })

    expect(onCommitted).toHaveBeenCalledWith('Ich arbeite im Vertrieb.')
    expect(result.current.partialText).toBe('')
  })

  it('does NOT call onCommitted when committed text is empty/whitespace', async () => {
    const onCommitted = vi.fn()
    await setupListening(onCommitted)

    act(() => {
      MockWebSocket.latest().simulateMessage({
        message_type: 'committed_transcript',
        text: '   ',
      })
    })

    expect(onCommitted).not.toHaveBeenCalled()
  })

  it('returns to idle on WS close (normal)', async () => {
    const onCommitted = vi.fn()
    const result = await setupListening(onCommitted)

    act(() => {
      MockWebSocket.latest().close()
    })

    await waitFor(() => result.current.state === 'idle')
  })
})

describe('useVoiceInput — cleanup and error handling', () => {
  async function setupListening(onCommitted: (text: string) => void) {
    const { result, unmount } = renderHook(() =>
      useVoiceInput({ token: 'test-token', onCommitted })
    )

    act(() => {
      void result.current.start()
    })

    await waitFor(() => MockWebSocket._instances.length > 0)
    act(() => {
      MockWebSocket.latest().simulateOpen()
    })
    await waitFor(() => result.current.state === 'listening')

    return { result, unmount }
  }

  it('closes WS on unmount', async () => {
    const onCommitted = vi.fn()
    const { unmount } = await setupListening(onCommitted)

    const mockWs = MockWebSocket.latest()
    const closeSpy = vi.spyOn(mockWs, 'close')

    act(() => {
      unmount()
    })

    expect(closeSpy).toHaveBeenCalled()
  })

  it('closes AudioContext on unmount', async () => {
    const onCommitted = vi.fn()

    // Capture AudioContext instances created during the hook's start()
    const createdContexts: MockAudioContext[] = []
    vi.stubGlobal('AudioContext', class extends MockAudioContext {
      constructor() {
        super()
        createdContexts.push(this)
      }
    })

    const { result, unmount } = renderHook(() =>
      useVoiceInput({ token: 'test-token', onCommitted })
    )

    act(() => {
      void result.current.start()
    })

    await waitFor(() => MockWebSocket._instances.length > 0)
    act(() => {
      MockWebSocket.latest().simulateOpen()
    })
    await waitFor(() => result.current.state === 'listening')

    act(() => {
      unmount()
    })

    expect(createdContexts.length).toBeGreaterThan(0)
    expect(createdContexts[0].close).toHaveBeenCalled()
  })

  it('WS error sets state to error', async () => {
    const onCommitted = vi.fn()
    const { result } = await setupListening(onCommitted)

    act(() => {
      MockWebSocket.latest().onerror?.(new Event('error'))
    })

    await waitFor(() => result.current.state === 'error')
    expect(result.current.state).toBe('error')
  })
})
