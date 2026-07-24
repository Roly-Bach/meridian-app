import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { TransitionPrompt } from './TransitionPrompt'

describe('TransitionPrompt', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('AC1: does not fire onAdvance before the 5s delay elapses', () => {
    const onAdvance = vi.fn()
    render(<TransitionPrompt onAdvance={onAdvance} />)

    act(() => {
      vi.advanceTimersByTime(4900)
    })

    expect(onAdvance).not.toHaveBeenCalled()
  })

  it('AC1: fires onAdvance automatically once the 5s delay elapses', () => {
    const onAdvance = vi.fn()
    render(<TransitionPrompt onAdvance={onAdvance} />)

    act(() => {
      vi.advanceTimersByTime(5100)
    })

    expect(onAdvance).toHaveBeenCalledTimes(1)
  })

  it('AC1: a click fires onAdvance immediately, before the delay elapses', () => {
    const onAdvance = vi.fn()
    render(<TransitionPrompt onAdvance={onAdvance} />)

    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }))

    expect(onAdvance).toHaveBeenCalledTimes(1)
  })

  it('Edge case: double-click only fires onAdvance once', () => {
    const onAdvance = vi.fn()
    render(<TransitionPrompt onAdvance={onAdvance} />)

    const button = screen.getByRole('button', { name: 'Weiter' })
    fireEvent.click(button)
    fireEvent.click(button)

    expect(onAdvance).toHaveBeenCalledTimes(1)
  })

  it('Edge case: click followed by the delay elapsing still only fires once', () => {
    const onAdvance = vi.fn()
    render(<TransitionPrompt onAdvance={onAdvance} />)

    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }))
    act(() => {
      vi.advanceTimersByTime(5100)
    })

    expect(onAdvance).toHaveBeenCalledTimes(1)
  })
})
