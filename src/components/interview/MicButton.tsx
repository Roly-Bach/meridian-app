import { Button } from '@/components/ui/button'
import { Mic, MicOff, Loader2 } from 'lucide-react'
import type { VoiceInputState } from '@/hooks/useVoiceInput'

type Props = {
  state: VoiceInputState
  onClick: () => void
  disabled: boolean
}

export function MicButton({ state, onClick, disabled }: Props) {
  const isListening = state === 'listening'
  const isConnecting = state === 'connecting'
  const isError = state === 'error'

  const ariaLabel = isListening
    ? 'Sprachaufnahme stoppen'
    : 'Sprachaufnahme starten'

  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled || isConnecting}
      aria-label={ariaLabel}
      className={[
        'h-10 w-10 p-0 flex-shrink-0 rounded-[6px] flex items-center justify-center',
        isListening
          ? 'bg-[#E040FB] hover:bg-[#AA00FF] text-white animate-pulse border-0'
          : isError
          ? 'bg-white border border-[#E5E5E5] text-[#BBBBBB] opacity-60'
          : isConnecting
          ? 'bg-white border border-[#E5E5E5] opacity-60 cursor-not-allowed'
          : 'bg-white border border-[#E5E5E5] text-[#555555] hover:bg-[#F5F5F5]',
      ].join(' ')}
    >
      {isConnecting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isError ? (
        <MicOff className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </Button>
  )
}
