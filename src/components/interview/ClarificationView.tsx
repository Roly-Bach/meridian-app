'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ClarificationCards } from './ClarificationCards'
import type { ClarificationCard } from '@/services/interviewAgent'

type Props = {
  token: string
  employeeName: string
  cards: ClarificationCard[]
  initialAnswers: Record<string, string | string[]>
  onCompleted: () => void
}

function isCardAnswered(card: ClarificationCard, answers: Record<string, string | string[]>): boolean {
  const key = `${card.process_step_id}__${card.slot_key}`
  const answer = answers[key]
  if (answer === undefined) return false
  if (Array.isArray(answer)) return answer.length > 0
  return answer.length > 0
}

function storageKey(token: string) {
  return `clarification-answers-${token}`
}

function loadFromStorage(token: string): Record<string, string | string[]> {
  try {
    const raw = localStorage.getItem(storageKey(token))
    return raw ? (JSON.parse(raw) as Record<string, string | string[]>) : {}
  } catch {
    return {}
  }
}

export function ClarificationView({ token, employeeName, cards, initialAnswers, onCompleted }: Props) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>(() => ({
    ...loadFromStorage(token),
    ...initialAnswers,
  }))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allAnswered = cards.every((card) => isCardAnswered(card, answers))

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(token), JSON.stringify(answers))
    } catch {
      // localStorage unavailable — partial answers not persisted, non-fatal
    }
  }, [token, answers])

  function handleAnswer(cardKey: string, answer: string | string[]) {
    setAnswers((prev) => ({ ...prev, [cardKey]: answer }))
  }

  async function handleSubmit() {
    setIsSubmitting(true)
    setError(null)

    const answerPayload = Object.entries(answers).map(([key, answer]) => {
      const [process_step_id, slot_key] = key.split('__')
      return { process_step_id, slot_key, answer }
    })

    try {
      const res = await fetch(`/api/interview/${token}/clarification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answerPayload }),
      })

      if (res.status === 409) {
        localStorage.removeItem(storageKey(token))
        onCompleted()
        return
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        setError(data.error ?? 'Fehler beim Speichern der Antworten.')
        return
      }

      localStorage.removeItem(storageKey(token))
      onCompleted()
    } catch {
      setError('Verbindungsfehler. Bitte versuche es erneut.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-[#FAFAFA]">
      <header className="border-b border-[#E5E5E5] bg-white px-6 py-3 flex items-center gap-3 flex-shrink-0">
        <span className="text-[12px] text-[#E040FB] font-semibold tracking-wide">Meridian</span>
        <span className="text-[#E5E5E5]">|</span>
        <span className="text-[14px] font-medium text-[#111111]">Interview mit {employeeName}</span>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6 max-w-[720px] mx-auto w-full">
        <p className="text-[15px] text-[#111111] font-medium mb-6">
          Noch ein paar kurze Bestätigungen zu dem was wir besprochen haben.
        </p>

        <ClarificationCards cards={cards} answers={answers} onAnswer={handleAnswer} />

        {error && (
          <p className="mt-4 text-[13px] text-[#EF4444]">{error}</p>
        )}

        <div className="mt-6 flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={!allAnswered || isSubmitting}
            className="bg-[#E040FB] hover:bg-[#AA00FF] text-white border-0 disabled:opacity-40"
          >
            {isSubmitting ? 'Wird gespeichert…' : 'Weiter'}
          </Button>
        </div>
      </div>
    </div>
  )
}
