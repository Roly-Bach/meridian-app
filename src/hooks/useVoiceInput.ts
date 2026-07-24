'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { PCM_WORKLET_SOURCE } from '@/lib/audio/pcm-worklet'

export type VoiceInputState = 'idle' | 'connecting' | 'listening' | 'error'

export interface UseVoiceInputOptions {
  token: string
  onCommitted: (text: string) => void
  disabled?: boolean
}

export interface UseVoiceInputReturn {
  state: VoiceInputState
  partialText: string
  start: () => Promise<void>
  stop: () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Converts an ArrayBuffer (Int16 PCM) to a Base64 string. */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/** Downsample Float32 samples from inputRate → 16000 Hz, return Int16 PCM buffer. */
export function float32ToInt16Pcm(
  samples: Float32Array,
  inputRate: number
): ArrayBuffer {
  const targetRate = 16000
  const ratio = inputRate / targetRate
  const outLen = Math.floor(samples.length / ratio)
  const int16 = new Int16Array(outLen)

  for (let i = 0; i < outLen; i++) {
    const srcIdx = i * ratio
    const lo = Math.floor(srcIdx)
    const hi = Math.min(lo + 1, samples.length - 1)
    const frac = srcIdx - lo
    const sample = samples[lo] * (1 - frac) + samples[hi] * frac
    const clamped = Math.max(-1, Math.min(1, sample))
    int16[i] = Math.round(clamped * 0x7fff)
  }

  return int16.buffer
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useVoiceInput({
  token,
  onCommitted,
  disabled = false,
}: UseVoiceInputOptions): UseVoiceInputReturn {
  const [state, setState] = useState<VoiceInputState>('idle')
  const [partialText, setPartialText] = useState('')

  // Refs hold mutable resources so cleanup is always up to date
  const wsRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Keep a stable ref to onCommitted to avoid stale closure in WS handler
  const onCommittedRef = useRef(onCommitted)
  useEffect(() => {
    onCommittedRef.current = onCommitted
  }, [onCommitted])
  // Mirrors partialText for synchronous reads inside WS handlers/cleanup (state updates are async)
  const partialTextRef = useRef('')
  // Set right before we ourselves close the WS, so onclose can tell a deliberate
  // close apart from an unexpected server/network drop (both fire the same event).
  const intentionalCloseRef = useRef(false)

  const updatePartialText = useCallback((text: string) => {
    partialTextRef.current = text
    setPartialText(text)
  }, [])

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
  }, [])

  const cleanup = useCallback((opts?: { flushPartialAsFallback?: boolean }) => {
    clearRefreshTimer()

    // Close WS
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      intentionalCloseRef.current = true
      wsRef.current.close()
    }
    wsRef.current = null

    // Disconnect audio nodes and stop tracks
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => undefined)
      audioContextRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }

    // If the session ends without a final committed_transcript (dropped connection,
    // manual stop mid-sentence), use the last partial text instead of losing it.
    const leftoverPartial = partialTextRef.current.trim()
    if (opts?.flushPartialAsFallback && leftoverPartial) {
      onCommittedRef.current(leftoverPartial)
    }
    partialTextRef.current = ''
    setPartialText('')
  }, [clearRefreshTimer])

  const stop = useCallback(() => {
    cleanup({ flushPartialAsFallback: true })
    setState('idle')
  }, [cleanup])

  // openWebSocket is extracted so it can be called on initial start and on token refresh.
  // The audio pipeline (AudioContext + microphone) remains open across a refresh.
  const openWebSocketRef = useRef<((sessionToken: string) => void) | null>(null)

  const openWebSocket = useCallback((sessionToken: string) => {
    // Close existing WS without touching the audio pipeline (e.g. token-refresh reconnect —
    // mark intentional so the old socket's onclose doesn't report a false disconnect)
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      intentionalCloseRef.current = true
      wsRef.current.close()
    }
    wsRef.current = null
    clearRefreshTimer()

    const wsUrl = new URL('wss://api.elevenlabs.io/v1/speech-to-text/realtime')
    wsUrl.searchParams.set('token', sessionToken)
    wsUrl.searchParams.set('model_id', 'scribe_v2_realtime')
    wsUrl.searchParams.set('commit_strategy', 'vad')
    wsUrl.searchParams.set('vad_silence_threshold_secs', '2.5')
    wsUrl.searchParams.set('audio_format', 'pcm_16000')
    const ws = new WebSocket(wsUrl.toString())
    wsRef.current = ws

    ws.onopen = () => {
      setState('listening')
      // ElevenLabs session tokens expire after 900s. Refresh 60s before expiry.
      refreshTimerRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/interview/${token}/voice-token`, { method: 'POST' })
          if (!res.ok) throw new Error(`voice-token ${res.status}`)
          const json = (await res.json()) as { sessionToken: string }
          if (openWebSocketRef.current) openWebSocketRef.current(json.sessionToken)
        } catch {
          toast.error('Sprachaufnahme unterbrochen — bitte neu starten')
          setState('error')
        }
      }, 840_000)
    }

    ws.onmessage = (event: MessageEvent) => {
      let msg: { message_type?: string; text?: string }
      try {
        msg = JSON.parse(event.data as string) as typeof msg
      } catch {
        return
      }

      if (msg.message_type === 'partial_transcript') {
        updatePartialText(msg.text ?? '')
      } else if (msg.message_type === 'committed_transcript') {
        updatePartialText('')
        const trimmed = (msg.text ?? '').trim()
        if (trimmed) {
          onCommittedRef.current(trimmed)
        }
        // Auto-stop after commit — one answer per mic activation
        cleanup()
        setState('idle')
      }
    }

    let closedByError = false

    ws.onerror = () => {
      closedByError = true
      setState('error')
      toast.error('Sprachaufnahme unterbrochen')
    }

    ws.onclose = () => {
      const wasIntentional = intentionalCloseRef.current
      intentionalCloseRef.current = false
      cleanup({ flushPartialAsFallback: !wasIntentional })
      if (!closedByError) {
        if (!wasIntentional) {
          // Neither our own stop() nor a normal commit closed this — the connection
          // dropped unexpectedly (e.g. network blip) without ever firing onerror.
          toast.error('Verbindung zur Sprachaufnahme verloren — bitte erneut versuchen')
        }
        setState('idle')
      }
    }
  }, [token, cleanup, clearRefreshTimer, updatePartialText])

  // Keep ref current so the refresh timer callback always calls the latest version
  useEffect(() => {
    openWebSocketRef.current = openWebSocket
  }, [openWebSocket])

  const start = useCallback(async () => {
    if (disabled) return
    if (state !== 'idle' && state !== 'error') return

    cleanup()
    setState('connecting')

    // ── 1. Fetch session token ─────────────────────────────────────────────
    let sessionToken: string
    try {
      const res = await fetch(`/api/interview/${token}/voice-token`, {
        method: 'POST',
      })
      if (!res.ok) {
        throw new Error(`voice-token ${res.status}`)
      }
      const json = (await res.json()) as { sessionToken: string }
      sessionToken = json.sessionToken
    } catch {
      toast.error('Sprachaufnahme konnte nicht gestartet werden')
      setState('idle')
      return
    }

    // ── 2. Request microphone ──────────────────────────────────────────────
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
      streamRef.current = stream
    } catch (err) {
      const name = err instanceof Error ? err.name : ''
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        toast.error('Mikrofonzugriff verweigert — bitte in den Browser-Einstellungen erlauben')
      } else {
        toast.error('Sprachaufnahme konnte nicht gestartet werden')
      }
      setState('idle')
      return
    }

    // ── 3. Set up AudioContext + PCM pipeline ──────────────────────────────
    const audioContext = new AudioContext()
    audioContextRef.current = audioContext
    const source = audioContext.createMediaStreamSource(stream)

    const sendChunk = (buffer: ArrayBuffer) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
      const base64 = arrayBufferToBase64(buffer)
      wsRef.current.send(
        JSON.stringify({
          message_type: 'input_audio_chunk',
          audio_base_64: base64,
          sample_rate: 16000,
        })
      )
    }

    if (audioContext.audioWorklet) {
      // AudioWorklet path (modern browsers)
      const blob = new Blob([PCM_WORKLET_SOURCE], { type: 'application/javascript' })
      const blobUrl = URL.createObjectURL(blob)
      try {
        await audioContext.audioWorklet.addModule(blobUrl)
      } finally {
        URL.revokeObjectURL(blobUrl)
      }
      const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor')
      workletNode.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
        sendChunk(e.data)
      }
      source.connect(workletNode)
    } else {
      // ScriptProcessor fallback (older browsers)
      const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1)
      scriptProcessor.onaudioprocess = (e) => {
        const inData = e.inputBuffer.getChannelData(0)
        const pcm = float32ToInt16Pcm(inData, audioContext.sampleRate)
        sendChunk(pcm)
      }
      source.connect(scriptProcessor)
      scriptProcessor.connect(audioContext.destination)
    }

    // ── 4. Open WebSocket ──────────────────────────────────────────────────
    openWebSocket(sessionToken)
  }, [token, disabled, state, cleanup, openWebSocket])

  // Stop recording when disabled becomes true mid-session (e.g. agent is streaming).
  // Uses a ref so the effect dependency only tracks the disabled flag, not the full stop fn.
  const stopRef = useRef(stop)
  useEffect(() => { stopRef.current = stop }, [stop])
  const isActiveRef = useRef(false)
  useEffect(() => {
    isActiveRef.current = state !== 'idle' && state !== 'error'
  }, [state])
  useEffect(() => {
    if (disabled && isActiveRef.current) {
      stopRef.current()
    }
  }, [disabled])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { state, partialText, start, stop }
}
