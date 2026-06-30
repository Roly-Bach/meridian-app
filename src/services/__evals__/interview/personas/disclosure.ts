import type { DisclosureMode } from './types'

/**
 * Tester-Offenlegungs-Disziplin als kontrollierter Faktor (PROJ-40 Kriterium C), von der
 * Persona-Persönlichkeit ENTKOPPELT. Einheitlich über alle Personas — bringt die schwach-engineerten
 * Personas (vertriebler/it-support, die unaufgefordert Tools/Zahlen preisgaben, 91 %/100 % Turn-1)
 * auf einen kontrollierten Floor. In eigenem Modul (nicht runner.ts), damit Tests es importieren
 * können, ohne runner.ts' main() beim Laden auszulösen.
 */
export function disclosureRules(mode: DisclosureMode): string[] {
  const numbers =
    'OFFENLEGUNG ZAHLEN: Konkrete Zahlen (Mengen, Häufigkeiten, Zeitangaben, Dauern, Prozentwerte) nennst du NUR, wenn der Interviewer direkt danach fragt. Beschreibst du einen Ablauf von dir aus, bleibst du qualitativ ("regelmäßig", "manchmal", "dauert eine Weile") OHNE genaue Werte.'
  if (mode === 'withhold_tools_and_numbers') {
    return [
      numbers,
      'OFFENLEGUNG SYSTEME: Auch konkrete Tool-/Systemnamen nennst du NUR auf direkte Nachfrage. Beschreibst du den Ablauf von dir aus, sprichst du von "dem System" / "dem Tool" / "einem Dokumentenablage-System" ohne Produktnamen.',
    ]
  }
  // withhold_numbers_only (Default, realistisch)
  return [
    numbers,
    'OFFENLEGUNG SYSTEME: Tool-/Systemnamen darfst du beim Beschreiben des Ablaufs natürlich nennen.',
  ]
}
