'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send } from 'lucide-react'

type Props = {
  onSend: (message: string) => void
  disabled: boolean
}

export function ChatInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleSend() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
    textareaRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="border-t border-[#E5E5E5] bg-white px-6 py-4">
      <div className="flex gap-3 items-end max-w-[760px] mx-auto">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ihre Antwort… (Enter zum Senden, Shift+Enter für Zeilenumbruch)"
          disabled={disabled}
          rows={1}
          className="resize-none rounded-[6px] border-[#E5E5E5] text-[14px] min-h-[40px] max-h-[120px] flex-1"
        />
        <Button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          className="bg-[#E040FB] hover:bg-[#AA00FF] text-white rounded-[6px] h-10 w-10 p-0 flex-shrink-0 disabled:opacity-40"
          aria-label="Nachricht senden"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
