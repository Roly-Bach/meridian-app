'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

const DELAY_MS = 5_000
const TICK_MS = 100

type Props = {
  onAdvance: () => void
}

export function TransitionPrompt({ onAdvance }: Props) {
  const [progress, setProgress] = useState(0)
  const firedRef = useRef(false)
  const onAdvanceRef = useRef(onAdvance)
  onAdvanceRef.current = onAdvance

  useEffect(() => {
    const start = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - start
      setProgress(Math.min(100, (elapsed / DELAY_MS) * 100))
      if (elapsed >= DELAY_MS && !firedRef.current) {
        firedRef.current = true
        clearInterval(interval)
        onAdvanceRef.current()
      }
    }, TICK_MS)
    return () => clearInterval(interval)
  }, [])

  function handleClick() {
    if (firedRef.current) return
    firedRef.current = true
    onAdvance()
  }

  return (
    <div className="flex flex-col items-end gap-1.5 px-6 pb-4">
      <Button
        onClick={handleClick}
        className="bg-[#E040FB] hover:bg-[#AA00FF] text-white border-0"
      >
        Weiter
      </Button>
      <Progress
        value={progress}
        aria-hidden="true"
        className="h-1 w-24 bg-[#E5E5E5] motion-reduce:hidden"
        indicatorClassName="bg-[#E040FB] motion-reduce:transition-none"
      />
    </div>
  )
}
