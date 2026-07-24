'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

type Props = {
  onAdvance: () => void
}

export function TransitionPrompt({ onAdvance }: Props) {
  const [fired, setFired] = useState(false)
  const firedRef = useRef(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    buttonRef.current?.focus()
  }, [])

  function handleClick() {
    if (firedRef.current) return
    firedRef.current = true
    setFired(true)
    onAdvance()
  }

  return (
    <div className="border-t border-[#E5E5E5] bg-white px-6 py-4">
      <div className="flex justify-end max-w-[760px] mx-auto">
        <span role="status" aria-live="polite" className="sr-only">
          Das Gespräch ist an dieser Stelle abgeschlossen. Klicke auf &quot;Weiter&quot;, um fortzufahren.
        </span>
        <Button
          ref={buttonRef}
          onClick={handleClick}
          disabled={fired}
          className="bg-[#E040FB] hover:bg-[#AA00FF] text-white border-0 disabled:opacity-40"
        >
          Weiter
        </Button>
      </div>
    </div>
  )
}
