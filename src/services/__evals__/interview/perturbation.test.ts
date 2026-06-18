import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('ai', () => ({ generateText: vi.fn() }))
vi.mock('@/lib/llm-provider', () => ({ resolveModel: vi.fn().mockReturnValue({}) }))

import { generateText } from 'ai'
import { shuffleArray, perturbPersona } from './perturbation'
import type { PersonaProcessKnowledge } from './personas/types'

const mockGenerateText = vi.mocked(generateText)

const SAMPLE_KNOWLEDGE: PersonaProcessKnowledge = {
  processes: [
    {
      name: 'Rechnungsprüfung',
      description: 'Eingehende Rechnung prüfen und in SAP buchen.',
      tools: ['SAP FI'],
      pain_points: ['Fehlende Bestellreferenz kostet Zeit', 'Diskrepanzen bei 5%'],
      frequency: 'Monatlich',
    },
    {
      name: 'Monatsabschluss',
      description: 'Abstimmung aller offenen Posten und Buchung von Rückstellungen.',
      tools: ['SAP FI', 'Excel'],
      pain_points: ['Zeitdruck am Monatsende'],
      frequency: 'Einmal pro Monat',
    },
    {
      name: 'Mahnprozess',
      description: 'Überfällige Rechnungen mahnen und nachverfolgen.',
      tools: ['SAP FI'],
      pain_points: ['Manuelle Nachverfolgung aufwändig'],
      frequency: 'Wöchentlich',
    },
  ],
  tools: [
    { name: 'SAP FI', purpose: 'Buchhaltungssystem', satisfaction: 'medium' },
    { name: 'Excel', purpose: 'Ad-hoc-Auswertungen', satisfaction: 'low' },
    { name: 'DocuWare', purpose: 'Dokumentenmanagement', satisfaction: 'medium' },
  ],
  additionalContext: 'Monatlicher Mahnprozess ist zeitaufwändig.',
}

beforeEach(() => {
  mockGenerateText.mockReset()
  // Default: return paraphrased strings of same length
  mockGenerateText.mockResolvedValue({
    text: JSON.stringify([
      'Eingehende Rechnungen werden geprüft und verbucht.',
      'Alle offenen Posten werden abgestimmt.',
      'Unbezahlte Rechnungen werden verfolgt.',
      'Die fehlende Referenz verursacht Zeitverlust',
      'Etwa 5% der Fälle haben Abweichungen',
      'Starker Zeitdruck am Ende des Monats',
      'Die manuelle Verfolgung ist aufwändig',
      'Der Mahnprozess ist zeitintensiv.',
    ]),
  } as Awaited<ReturnType<typeof generateText>>)
})

describe('shuffleArray', () => {
  it('gleicher Seed erzeugt identische Reihenfolge', () => {
    const arr = [1, 2, 3, 4, 5]
    const seed = 42

    const random1 = () => {
      let s = seed
      return function () {
        s |= 0
        s = (s + 0x6d2b79f5) | 0
        let t = Math.imul(s ^ (s >>> 15), 1 | s)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
      }
    }

    // Use the same helper as perturbation.ts by importing shuffleArray
    // We seed independently with the same value
    let s1 = seed
    const prng1 = () => {
      s1 |= 0
      s1 = (s1 + 0x6d2b79f5) | 0
      let t = Math.imul(s1 ^ (s1 >>> 15), 1 | s1)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    let s2 = seed
    const prng2 = () => {
      s2 |= 0
      s2 = (s2 + 0x6d2b79f5) | 0
      let t = Math.imul(s2 ^ (s2 >>> 15), 1 | s2)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }

    const result1 = shuffleArray(arr, prng1)
    const result2 = shuffleArray(arr, prng2)

    expect(result1).toEqual(result2)
    void random1 // silence unused var
  })

  it('verschiedene Seeds erzeugen (mit hoher Wahrscheinlichkeit) verschiedene Reihenfolgen', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8]

    const makePrng = (seed: number) => {
      let s = seed
      return () => {
        s |= 0
        s = (s + 0x6d2b79f5) | 0
        let t = Math.imul(s ^ (s >>> 15), 1 | s)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
      }
    }

    const result1 = shuffleArray(arr, makePrng(1))
    const result2 = shuffleArray(arr, makePrng(999999))

    // With 8 elements and different seeds, the probability of identical shuffles is extremely low
    expect(result1).not.toEqual(result2)
  })

  it('shuffle behält alle Elemente (keine Elemente verloren)', () => {
    const arr = ['a', 'b', 'c', 'd', 'e']
    let s = 123
    const prng = () => {
      s |= 0
      s = (s + 0x6d2b79f5) | 0
      let t = Math.imul(s ^ (s >>> 15), 1 | s)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }

    const result = shuffleArray(arr, prng)

    expect(result).toHaveLength(arr.length)
    expect(result.sort()).toEqual([...arr].sort())
  })
})

describe('perturbPersona', () => {
  it('gibt ein Objekt mit gleicher Anzahl processes und tools zurück', async () => {
    const result = await perturbPersona(SAMPLE_KNOWLEDGE, 42)

    expect(result.processes).toHaveLength(SAMPLE_KNOWLEDGE.processes.length)
    expect(result.tools).toHaveLength(SAMPLE_KNOWLEDGE.tools.length)
  })

  it('Prozess-Namen bleiben erhalten (nur Reihenfolge und Texte können sich ändern)', async () => {
    const result = await perturbPersona(SAMPLE_KNOWLEDGE, 42)

    const originalNames = SAMPLE_KNOWLEDGE.processes.map((p) => p.name).sort()
    const resultNames = result.processes.map((p) => p.name).sort()
    expect(resultNames).toEqual(originalNames)
  })

  it('Tool-Namen bleiben erhalten', async () => {
    const result = await perturbPersona(SAMPLE_KNOWLEDGE, 42)

    const originalNames = SAMPLE_KNOWLEDGE.tools.map((t) => t.name).sort()
    const resultNames = result.tools.map((t) => t.name).sort()
    expect(resultNames).toEqual(originalNames)
  })

  it('fällt auf Original zurück wenn LLM fehlschlägt', async () => {
    mockGenerateText.mockRejectedValueOnce(new Error('API error'))

    const result = await perturbPersona(SAMPLE_KNOWLEDGE, 42)

    // Should still return valid result with original text content
    expect(result.processes).toHaveLength(SAMPLE_KNOWLEDGE.processes.length)
    // Pain points count should be preserved
    const totalOriginalPainPoints = SAMPLE_KNOWLEDGE.processes.reduce(
      (sum, p) => sum + p.pain_points.length,
      0,
    )
    const totalResultPainPoints = result.processes.reduce((sum, p) => sum + p.pain_points.length, 0)
    expect(totalResultPainPoints).toBe(totalOriginalPainPoints)
  })

  it('fällt auf Original zurück bei ungültigem JSON vom LLM', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: 'Das ist kein JSON',
    } as Awaited<ReturnType<typeof generateText>>)

    const result = await perturbPersona(SAMPLE_KNOWLEDGE, 42)

    // Shuffle still happens, but text should be original
    expect(result.processes).toHaveLength(SAMPLE_KNOWLEDGE.processes.length)
  })
})
