'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { MessageList, type Message } from './MessageList'
import { ChatInput } from './ChatInput'
import { useInterviewStream } from '@/hooks/useInterviewStream'

type Turn = {
  id: string
  turn_number: number
  user_input: string
  agent_response: string
  created_at: string
}

type Props = {
  token: string
  employeeName: string
  existingTurns: Turn[]
  openerText?: string | null
  status: 'created' | 'active'
  onCompleted?: () => void
}

function turnsToMessages(turns: Turn[], openerText?: string | null): Message[] {
  const opener: Message[] = openerText
    ? [{ id: 'opener', role: 'agent' as const, content: openerText }]
    : []
  return [
    ...opener,
    ...turns.flatMap((t) => [
      { id: `${t.id}-user`, role: 'user' as const, content: t.user_input },
      { id: `${t.id}-agent`, role: 'agent' as const, content: t.agent_response },
    ]),
  ]
}

export function ChatInterface({ token, employeeName, existingTurns, openerText, status, onCompleted }: Props) {
  const [messages, setMessages] = useState<Message[]>(() =>
    turnsToMessages(existingTurns, existingTurns.length > 0 ? openerText : null)
  )
  const [showReconnectBanner, setShowReconnectBanner] = useState(() => existingTurns.length > 0)
  const reconnectBannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { isStreaming, error, sendMessage, reconnect, start, clearError } = useInterviewStream(token)

  // Auto-dismiss reconnect banner after 5s
  useEffect(() => {
    if (!showReconnectBanner) return
    reconnectBannerTimer.current = setTimeout(() => setShowReconnectBanner(false), 5_000)
    return () => {
      if (reconnectBannerTimer.current) clearTimeout(reconnectBannerTimer.current)
    }
  }, [showReconnectBanner])

  // Auto-greet: cold start (no turns) → /start, returning employee → /reconnect.
  // Neither writes the greeting as a turn in the DB.
  useEffect(() => {
    const isColdStart = status === 'created' && existingTurns.length === 0
    const greetFn = isColdStart ? start : reconnect

    const agentMsgId = `greet-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      { id: agentMsgId, role: 'agent', content: '', isStreaming: true },
    ])

    greetFn((chunk) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === agentMsgId ? { ...m, content: m.content + chunk } : m))
      )
    })
      .then(() => {
        setMessages((prev) =>
          prev.map((m) => (m.id === agentMsgId ? { ...m, isStreaming: false } : m))
        )
      })
      .catch(() => {
        setMessages((prev) => prev.filter((m) => m.id !== agentMsgId))
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (error) {
      toast.error(error)
      clearError()
    }
  }, [error, clearError])

  async function checkCompleted() {
    try {
      const res = await fetch(`/api/interview/${token}`)
      if (!res.ok) return
      const data = await res.json() as { interview?: { status: string } }
      if (data.interview?.status === 'completed') {
        onCompleted?.()
      }
    } catch {
      // Non-critical — ignore
    }
  }

  function handleSend(userInput: string) {
    const userMsgId = `user-${Date.now()}`
    const agentMsgId = `agent-${Date.now()}`

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: 'user', content: userInput },
      { id: agentMsgId, role: 'agent', content: '', isStreaming: true },
    ])

    sendMessage(userInput, (chunk) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === agentMsgId ? { ...m, content: m.content + chunk } : m))
      )
    })
      .then(async () => {
        setMessages((prev) =>
          prev.map((m) => (m.id === agentMsgId ? { ...m, isStreaming: false } : m))
        )
        await checkCompleted()
      })
      .catch(() => {
        // Error is shown via the `error` state → toast. Remove empty agent bubble.
        setMessages((prev) => prev.filter((m) => m.id !== agentMsgId))
      })
  }

  return (
    <div className="flex flex-col h-screen bg-[#FAFAFA]">
      <header className="border-b border-[#E5E5E5] bg-white px-6 py-3 flex items-center gap-3 flex-shrink-0">
        <span className="text-[12px] text-[#E040FB] font-semibold tracking-wide">Meridian</span>
        <span className="text-[#E5E5E5]">|</span>
        <span className="text-[14px] font-medium text-[#111111]">Interview mit {employeeName}</span>
      </header>

      {showReconnectBanner && (
        <div className="flex items-center justify-between bg-[#FFF8E1] border-b border-[#FFE082] px-6 py-2 text-[13px] text-[#7B6000]">
          <span>Verbindung unterbrochen — dein Gespräch wurde fortgesetzt.</span>
          <button
            onClick={() => setShowReconnectBanner(false)}
            className="ml-4 text-[#7B6000] hover:text-[#3E3000] leading-none"
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>
      )}

      <MessageList messages={messages} />

      <ChatInput
        onSend={handleSend}
        disabled={isStreaming}
        voiceToken={token}
        onVoiceCommitted={handleSend}
        isStreamingAgent={isStreaming}
      />
    </div>
  )
}
