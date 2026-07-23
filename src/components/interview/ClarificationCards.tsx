'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { bucketsFor, type Direction } from '@/lib/clarificationBuckets'
import type { MandatoryNumericSlot } from '@/services/interviewSemantic'
import type { ClarificationCard } from '@/services/interviewTypes'

// ─── Fixed options per slot type ─────────────────────────────────────────────
// PROJ-43 (AC2/AC3): frequency/duration/error_rate_percent buckets are no
// longer a single fixed array — clarificationBuckets.ts picks the variant
// based on the direction captured live (card.direction), same source of
// truth the server uses to resolve the chosen label back to a value.
const NUMERIC_SLOT_KEYS: ReadonlySet<string> = new Set(['frequency', 'duration', 'error_rate_percent'])

const SLOT_OPTIONS: Record<string, string[]> = {
  entscheidungslogik: ['Immer gleich', 'Meistens gleich', 'Variiert stark', 'Weiß ich nicht'],
}

const OPEN_ITEM_OPTIONS = ['Ja', 'Nein', 'Manchmal']

// ─── Option Button ────────────────────────────────────────────────────────────

function OptionButton({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className={
        selected
          ? 'border-[#E040FB] text-[#E040FB] bg-[#FDF4FF] hover:bg-[#FDF4FF] hover:text-[#E040FB]'
          : 'border-[#E5E5E5] text-[#111111] hover:border-[#E040FB] hover:text-[#E040FB]'
      }
    >
      {label}
    </Button>
  )
}

// ─── Individual Card renders ──────────────────────────────────────────────────

function SlotCard({
  card,
  answer,
  onAnswer,
}: {
  card: ClarificationCard
  answer: string | string[] | undefined
  onAnswer: (value: string) => void
}) {
  const isNumeric = NUMERIC_SLOT_KEYS.has(card.slot_key)
  const buckets = isNumeric ? bucketsFor(card.slot_key as MandatoryNumericSlot, card.direction as Direction) : []
  const options = isNumeric
    ? [...buckets.map((b) => b.label), 'Weiß ich nicht']
    : (SLOT_OPTIONS[card.slot_key] ?? card.options)
  const selected = typeof answer === 'string' ? answer : undefined
  const [freeText, setFreeText] = useState('')
  const isFreeTextAnswer = isNumeric && selected !== undefined && !options.includes(selected)

  function submitFreeText() {
    const trimmed = freeText.trim()
    if (trimmed) onAnswer(trimmed)
  }

  return (
    <Card className="border border-[#E5E5E5]">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="text-[11px] text-[#6B7280] font-medium uppercase tracking-wide mb-1">{card.step_title}</div>
        <CardTitle className="text-[14px] font-medium text-[#111111]">{card.question}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => (
            <OptionButton
              key={opt}
              label={opt}
              selected={selected === opt}
              onClick={() => onAnswer(opt)}
            />
          ))}
        </div>
        {isNumeric && (
          <div className="mt-2 flex items-center gap-2">
            <Input
              type="text"
              inputMode="decimal"
              placeholder="Eigene Zahl oder Spanne, z.B. 12 oder 10-15"
              value={isFreeTextAnswer && freeText === '' ? (selected ?? '') : freeText}
              onChange={(e) => setFreeText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitFreeText()
              }}
              className={`h-8 text-[13px] ${isFreeTextAnswer ? 'border-[#E040FB]' : ''}`}
            />
            <Button variant="outline" size="sm" onClick={submitFreeText} disabled={!freeText.trim()}>
              Übernehmen
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function OpenItemCard({
  card,
  answer,
  onAnswer,
}: {
  card: ClarificationCard
  answer: string | string[] | undefined
  onAnswer: (value: string) => void
}) {
  const selected = typeof answer === 'string' ? answer : undefined

  return (
    <Card className="border border-[#E5E5E5]">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-[14px] font-medium text-[#111111]">{card.question}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="flex flex-wrap gap-2">
          {OPEN_ITEM_OPTIONS.map((opt) => (
            <OptionButton
              key={opt}
              label={opt}
              selected={selected === opt}
              onClick={() => onAnswer(opt)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function QualitativeCard({
  card,
  answer,
  onAnswer,
}: {
  card: ClarificationCard
  answer: string | string[] | undefined
  onAnswer: (value: string[]) => void
}) {
  const selected = Array.isArray(answer) ? answer : []
  const isWeiß = selected.includes('Weiß ich nicht')

  function toggle(opt: string) {
    if (opt === 'Weiß ich nicht') {
      onAnswer(isWeiß ? [] : ['Weiß ich nicht'])
      return
    }
    if (isWeiß) {
      onAnswer([opt])
      return
    }
    const next = selected.includes(opt)
      ? selected.filter((s) => s !== opt)
      : [...selected, opt]
    onAnswer(next)
  }

  return (
    <Card className="border border-[#E5E5E5]">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="text-[11px] text-[#6B7280] font-medium uppercase tracking-wide mb-1">{card.step_title}</div>
        <CardTitle className="text-[14px] font-medium text-[#111111]">{card.question}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="flex flex-wrap gap-2">
          {card.options.map((opt) => (
            <OptionButton
              key={opt}
              label={opt}
              selected={selected.includes(opt)}
              onClick={() => toggle(opt)}
            />
          ))}
        </div>
        <p className="text-[11px] text-[#6B7280] mt-2">Mehrfachauswahl möglich</p>
      </CardContent>
    </Card>
  )
}

// ─── Public component ─────────────────────────────────────────────────────────

type Props = {
  cards: ClarificationCard[]
  answers: Record<string, string | string[]>
  onAnswer: (cardKey: string, answer: string | string[]) => void
}

export function ClarificationCards({ cards, answers, onAnswer }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {cards.map((card) => {
        const cardKey = `${card.process_step_id}__${card.slot_key}`
        const answer = answers[cardKey]

        if (card.slot_key === 'open_item') {
          return (
            <OpenItemCard
              key={cardKey}
              card={card}
              answer={answer}
              onAnswer={(v) => onAnswer(cardKey, v)}
            />
          )
        }

        if (card.answer_type === 'multi' || card.slot_key === 'qualitative') {
          return (
            <QualitativeCard
              key={cardKey}
              card={card}
              answer={answer}
              onAnswer={(v) => onAnswer(cardKey, v)}
            />
          )
        }

        return (
          <SlotCard
            key={cardKey}
            card={card}
            answer={answer}
            onAnswer={(v) => onAnswer(cardKey, v)}
          />
        )
      })}
    </div>
  )
}
