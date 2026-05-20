'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'
import { MessageList, type Message } from './MessageList'
import { ChatInput } from './ChatInput'
import { useInterviewStream } from '@/hooks/useInterviewStream'
import { useState } from 'react'

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
  status: 'created' | 'active'
  onCompleted?: () => void
}

function turnsToMessages(turns: Turn[]): Message[] {
  return turns.flatMap((t) => [
    { id: `${t.id}-user`, role: 'user' as const, content: t.user_input },
    { id: `${t.id}-agent`, role: 'agent' as const, content: t.agent_response },
  ])
}

export function ChatInterface({ token, employeeName, existingTurns, status, onCompleted }: Props) {
  const [messages, setMessages] = useState<Message[]>(() => turnsToMessages(existingTurns))
  const { isStreaming, error, sendMessage, reconnect, clearError } = useInterviewStream(token)

  // Auto-greet: on first open (no turns) OR on reconnect (existing turns + active).
  // Both cases stream via the reconnect endpoint (no DB write).
  useEffect(() => {
    if (status === undefined) return
    // Skip if this is a completed interview (shouldn't happen but guard anyway)

    const agentMsgId = `greet-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      { id: agentMsgId, role: 'agent', content: '', isStreaming: true },
    ])

    reconnect((chunk) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === agentMsgId ? { ...m, content: m.content + chunk } : m))
      )
    }).then(() => {
      setMessages((prev) =>
        prev.map((m) => (m.id === agentMsgId ? { ...m, isStreaming: false } : m))
      )
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
    }).then(async () => {
      setMessages((prev) =>
        prev.map((m) => (m.id === agentMsgId ? { ...m, isStreaming: false } : m))
      )
      await checkCompleted()
    })
  }

  return (
    <div className="flex flex-col h-screen bg-[#FAFAFA]">
      <header className="border-b border-[#E5E5E5] bg-white px-6 py-3 flex items-center gap-3 flex-shrink-0">
        <span className="text-[12px] text-[#E040FB] font-semibold tracking-wide">Meridian</span>
        <span className="text-[#E5E5E5]">|</span>
        <span className="text-[14px] font-medium text-[#111111]">Interview mit {employeeName}</span>
      </header>

      <MessageList messages={messages} />

      <ChatInput onSend={handleSend} disabled={isStreaming} />
    </div>
  )
}
