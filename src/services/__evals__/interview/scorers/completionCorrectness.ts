/**
 * Returns true if the interview was properly completed (not abandoned or timed out).
 */
export function scoreCompletionCorrectness(interviewStatus: string): boolean {
  return interviewStatus === 'completed'
}
