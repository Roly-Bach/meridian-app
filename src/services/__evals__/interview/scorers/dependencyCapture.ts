import { groupSemanticSteps } from '@/services/interviewSemantic'
import type { StepEntry } from '@/services/interviewSemantic'

/**
 * PROJ-40 (Refokus KI-Potenzial): Abhängigkeits-Erfassung (O6) als eigene Metrik.
 * Abhängigkeiten sind für die KI-Potenzial-Analyse zentral (kann ein Schritt isoliert
 * automatisiert werden, oder ist er verkettet?), wurden bisher aber nur als 1 von 9 Feldern
 * in slotCoverage verwässert. Hier als eigenständiges Signal herausgelöst.
 *
 * Ein (deduplizierter) Schritt zählt als „Abhängigkeit erfasst", wenn er mindestens eine
 * depends_on- oder influences-Kante trägt ODER explizit ein nicht_befund_typ gesetzt wurde
 * (deckungsgleich mit interviewSemantic.isCoverageFieldFilled für 'abhaengigkeiten').
 */
function isDependencyCaptured(step: StepEntry): boolean {
  const dep = step.abhaengigkeiten
  if (dep == null) return false
  return (
    (Array.isArray(dep.depends_on) && dep.depends_on.length > 0) ||
    (Array.isArray(dep.influences) && dep.influences.length > 0) ||
    dep.nicht_befund_typ != null
  )
}

/** Fraction der deduplizierten Schritte mit erfasster Abhängigkeit (Kante oder explizites nicht_befund). */
export function scoreDependencyCapture(stepTracker: StepEntry[]): number {
  if (stepTracker.length === 0) return 0
  const groups = groupSemanticSteps(stepTracker, 0.2)
  let captured = 0
  for (const group of groups) {
    if (group.some(isDependencyCaptured)) captured++
  }
  return groups.length === 0 ? 0 : captured / groups.length
}
