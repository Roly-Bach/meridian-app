import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatInput } from './ChatInput'
import type { UseVoiceInputReturn } from '@/hooks/useVoiceInput'

// Mock useVoiceInput so we can control the returned state
vi.mock('@/hooks/useVoiceInput', () => ({
  useVoiceInput: vi.fn(),
}))

// Mock navigator.mediaDevices so voiceEnabled evaluates to true
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: { getUserMedia: vi.fn() },
  configurable: true,
})

import { useVoiceInput } from '@/hooks/useVoiceInput'

const mockedUseVoiceInput = vi.mocked(useVoiceInput)

function makeVoiceReturn(state: UseVoiceInputReturn['state']): UseVoiceInputReturn {
  return {
    state,
    partialText: '',
    start: vi.fn(),
    stop: vi.fn(),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ChatInput — voice active disables textarea and send button', () => {
  it('disables textarea and send button when voice is connecting', () => {
    mockedUseVoiceInput.mockReturnValue(makeVoiceReturn('connecting'))

    render(
      <ChatInput
        onSend={vi.fn()}
        disabled={false}
        voiceToken="test-token"
        onVoiceCommitted={vi.fn()}
      />
    )

    const textarea = screen.getByRole('textbox')
    expect(textarea).toBeDisabled()

    const sendButton = screen.getByRole('button', { name: /nachricht senden/i })
    expect(sendButton).toBeDisabled()
  })

  it('disables textarea and send button when voice is listening', () => {
    mockedUseVoiceInput.mockReturnValue(makeVoiceReturn('listening'))

    render(
      <ChatInput
        onSend={vi.fn()}
        disabled={false}
        voiceToken="test-token"
        onVoiceCommitted={vi.fn()}
      />
    )

    const textarea = screen.getByRole('textbox')
    expect(textarea).toBeDisabled()

    const sendButton = screen.getByRole('button', { name: /nachricht senden/i })
    expect(sendButton).toBeDisabled()
  })

  it('does not disable textarea and send button when voice is idle', () => {
    mockedUseVoiceInput.mockReturnValue(makeVoiceReturn('idle'))

    render(
      <ChatInput
        onSend={vi.fn()}
        disabled={false}
        voiceToken="test-token"
        onVoiceCommitted={vi.fn()}
      />
    )

    const textarea = screen.getByRole('textbox')
    expect(textarea).not.toBeDisabled()
  })
})
