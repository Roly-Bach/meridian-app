'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send } from 'lucide-react'
import { useVoiceInput } from '@/hooks/useVoiceInput'
import { MicButton } from './MicButton'

type Props = {
  onSend: (message: string) => void
  disabled: boolean
  voiceToken?: string
  onVoiceCommitted?: (text: string) => void
  isStreamingAgent?: boolean
}

export function ChatInput({
  onSend,
  disabled,
  voiceToken,
  onVoiceCommitted,
  isStreamingAgent = false,
}: Props) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const voiceEnabled =
    typeof window !== 'undefined' &&
    !!navigator.mediaDevices &&
    !!voiceToken &&
    !!onVoiceCommitted

  const { state: voiceState, partialText, start, stop } = useVoiceInput({
    token: voiceToken ?? '',
    onCommitted: onVoiceCommitted ?? (() => undefined),
    disabled: !voiceEnabled || isStreamingAgent || disabled,
  })

  const voiceActive = voiceState !== 'idle' && voiceState !== 'error'

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

  function handleMicClick() {
    if (voiceState === 'listening') {
      stop()
    } else {
      void start()
    }
  }

  return (
    <div className="border-t border-[#E5E5E5] bg-white px-6 py-4">
      <div className="flex gap-3 items-end max-w-[760px] mx-auto">
        {voiceEnabled && (
          <MicButton
            state={voiceState}
            onClick={handleMicClick}
            disabled={isStreamingAgent || disabled}
          />
        )}
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            voiceActive
              ? 'Sprachaufnahme läuft…'
              : 'Ihre Antwort… (Enter zum Senden, Shift+Enter für Zeilenumbruch)'
          }
          disabled={disabled || voiceActive}
          rows={1}
          className="resize-none rounded-[6px] border-[#E5E5E5] text-[14px] min-h-[40px] max-h-[120px] flex-1"
        />
        <Button
          onClick={handleSend}
          disabled={disabled || !value.trim() || voiceActive}
          className="bg-[#E040FB] hover:bg-[#AA00FF] text-white rounded-[6px] h-10 w-10 p-0 flex-shrink-0 disabled:opacity-40"
          aria-label="Nachricht senden"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      {partialText && (
        <p className="text-[12px] text-[#999] italic max-w-[760px] mx-auto px-0 mt-1">
          {partialText}
        </p>
      )}
    </div>
  )
}
