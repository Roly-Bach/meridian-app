'use client'

import { useEffect, useRef } from 'react'
import { MessageBubble } from './MessageBubble'

export type Message = {
  id: string
  role: 'user' | 'agent'
  content: string
  isStreaming?: boolean
}

export function MessageList({ messages, footer }: { messages: Message[]; footer?: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    if (distFromBottom < 120) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, footer])

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-6 py-6">
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          role={msg.role}
          content={msg.content}
          isStreaming={msg.isStreaming}
        />
      ))}
      {footer}
      <div ref={bottomRef} />
    </div>
  )
}
