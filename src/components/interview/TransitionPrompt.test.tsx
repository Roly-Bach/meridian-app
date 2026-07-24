import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TransitionPrompt } from './TransitionPrompt'

describe('TransitionPrompt', () => {
  it('AC1: does not fire onAdvance before any click', () => {
    const onAdvance = vi.fn()
    render(<TransitionPrompt onAdvance={onAdvance} />)

    expect(onAdvance).not.toHaveBeenCalled()
  })

  it('AC1: a click fires onAdvance immediately', () => {
    const onAdvance = vi.fn()
    render(<TransitionPrompt onAdvance={onAdvance} />)

    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }))

    expect(onAdvance).toHaveBeenCalledTimes(1)
  })

  it('Edge case: button is visually disabled after the first click', () => {
    const onAdvance = vi.fn()
    render(<TransitionPrompt onAdvance={onAdvance} />)

    const button = screen.getByRole('button', { name: 'Weiter' })
    fireEvent.click(button)

    expect(button).toBeDisabled()
  })

  it('Edge case: double-click only fires onAdvance once', () => {
    const onAdvance = vi.fn()
    render(<TransitionPrompt onAdvance={onAdvance} />)

    const button = screen.getByRole('button', { name: 'Weiter' })
    fireEvent.click(button)
    fireEvent.click(button)

    expect(onAdvance).toHaveBeenCalledTimes(1)
  })
})
