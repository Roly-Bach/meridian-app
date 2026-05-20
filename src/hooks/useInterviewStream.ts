'use client'

import { useCallback, useRef, useState } from 'react'

export function useInterviewStream(token: string) {
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const streamRequest = useCallback(
    async (
      url: string,
      body: Record<string, string>,
      onChunk: (text: string) => void
    ) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setIsStreaming(true)
      setError(null)

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({})) as { error?: string }
          throw new Error(data.error ?? `Fehler ${res.status}`)
        }

        const reader = res.body?.getReader()
        if (!reader) throw new Error('Keine Antwort vom Server')
        const decoder = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          onChunk(decoder.decode(value, { stream: true }))
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setError((err as Error).message)
      } finally {
        setIsStreaming(false)
      }
    },
    []
  )

  const sendMessage = useCallback(
    (userInput: string, onChunk: (text: string) => void) =>
      streamRequest(`/api/interview/${token}/chat`, { user_input: userInput }, onChunk),
    [streamRequest, token]
  )

  const reconnect = useCallback(
    (onChunk: (text: string) => void) =>
      streamRequest(`/api/interview/${token}/reconnect`, {}, onChunk),
    [streamRequest, token]
  )

  const clearError = useCallback(() => setError(null), [])

  return { isStreaming, error, sendMessage, reconnect, clearError }
}
