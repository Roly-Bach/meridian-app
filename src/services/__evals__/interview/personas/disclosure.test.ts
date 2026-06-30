import { describe, it, expect } from 'vitest'
import { disclosureRules } from './disclosure'
import { PERSONA_MAP } from './loadPersona'

describe('disclosureRules (PROJ-40 C)', () => {
  it('both modes withhold concrete numbers until asked', () => {
    for (const mode of ['withhold_numbers_only', 'withhold_tools_and_numbers'] as const) {
      const rules = disclosureRules(mode).join('\n')
      expect(rules).toMatch(/OFFENLEGUNG ZAHLEN/)
      expect(rules).toMatch(/NUR, wenn der Interviewer direkt danach fragt/)
    }
  })

  it('withhold_tools_and_numbers also withholds tool/system names', () => {
    const rules = disclosureRules('withhold_tools_and_numbers').join('\n')
    expect(rules).toMatch(/Auch konkrete Tool-\/Systemnamen nennst du NUR auf direkte Nachfrage/)
  })

  it('withhold_numbers_only lets tools be named naturally', () => {
    const rules = disclosureRules('withhold_numbers_only').join('\n')
    expect(rules).toMatch(/Tool-\/Systemnamen darfst du beim Beschreiben des Ablaufs natürlich nennen/)
  })
})

describe('persona ground truth (PROJ-40 C / §7)', () => {
  it('every persona has a ground-truth entry per process, names matching processKnowledge', async () => {
    for (const load of Object.values(PERSONA_MAP)) {
      const persona = await load()
      const processNames = persona.processKnowledge.processes.map(p => p.name).sort()
      const gtNames = (persona.groundTruth ?? []).map(g => g.process).sort()
      expect(gtNames).toEqual(processNames)
    }
  })

  it('ground truth is NOT serialized into processKnowledge (anti-leak invariant)', async () => {
    for (const load of Object.values(PERSONA_MAP)) {
      const persona = await load()
      // The tester system prompt does JSON.stringify(persona.processKnowledge); canonical
      // ground-truth values must never appear there, only on persona.groundTruth.
      const serialized = JSON.stringify(persona.processKnowledge)
      expect(serialized).not.toMatch(/aiCandidate/)
      expect(serialized).not.toMatch(/groundTruth/)
    }
  })

  it('persona personality tendencies no longer carry disclosure-discipline rules', async () => {
    for (const load of Object.values(PERSONA_MAP)) {
      const persona = await load()
      const tendencies = persona.style.tendencies.join('\n')
      // Disclosure discipline is now the disclosureMode factor, not a per-persona tendency.
      expect(tendencies).not.toMatch(/nur auf direkte Nachfrage/i)
    }
  })
})
