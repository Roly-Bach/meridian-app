'use client'

import { useEffect, useRef } from 'react'
import { MessageBubble } from './MessageBubble'

export type Message = {
  id: string
  role: 'user' | 'agent'
  content: string
  isStreaming?: boolean
}

export function MessageList({ messages }: { messages: Message[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const isPinnedToBottomRef = useRef(true)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const handleScroll = () => {
      const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
      isPinnedToBottomRef.current = distFromBottom < 120
    }
    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (isPinnedToBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

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
      <div ref={bottomRef} />
    </div>
  )
}
