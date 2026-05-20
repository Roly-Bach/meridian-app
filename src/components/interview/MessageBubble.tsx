type Props = {
  role: 'user' | 'agent'
  content: string
  isStreaming?: boolean
}

export function MessageBubble({ role, content, isStreaming }: Props) {
  const isUser = role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[75%] px-4 py-3 rounded-[6px] text-[14px] leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-[#E040FB] text-white'
            : 'bg-white border border-[#E5E5E5] text-[#111111]'
        }`}
      >
        {content}
        {isStreaming && (
          <span className="inline-block w-1.5 h-4 ml-0.5 align-middle bg-current opacity-60 animate-pulse rounded-sm" />
        )}
      </div>
    </div>
  )
}
