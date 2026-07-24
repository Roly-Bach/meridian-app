'use client'

import { useEffect, useState, type ReactNode } from 'react'

export function FadeIn({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      setVisible(true)
      return
    }
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div
      className={`transition-opacity duration-300 motion-reduce:transition-none motion-reduce:duration-0 ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      {children}
    </div>
  )
}
