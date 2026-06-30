/**
 * Token-Overlap-Utility für deterministisches Evidence-Grounding (PROJ-40 Audit).
 *
 * Im LLM-Kontext ist zeichengenaues Zitat-Matching der falsche Test: LLMs paraphrasieren.
 * Statt eines 10-Zeichen-Prefix-Vergleichs (alte hallucinationRate, brüchig) wird die
 * Token-Containment gemessen: welcher Anteil der Inhaltswörter des Zitats taucht im Transkript
 * auf. Robust gegen Paraphrase und umschließende Zeichen, weiterhin deterministisch (kein LLM).
 */
/** Kleinschreibung + Diakritika entfernen (ä→a, ü→u, …). ß bleibt erhalten. */
function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// Stoppwörter im normalisierten Form halten — sonst scheitert der Vergleich bei Umlaut-Wörtern:
// 'für' wird beim Tokenisieren zu 'fur' normalisiert und matchte nie gegen ein unnormalisiertes
// 'für' im Set (Reviewer-Befund PROJ-40 Chunk 3).
const STOPWORDS = new Set([
  'und', 'oder', 'aber', 'wenn', 'dann', 'wie', 'was', 'wer', 'wo',
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einer', 'einem',
  'mit', 'von', 'für', 'auf', 'bei', 'aus', 'nach', 'vor', 'zur', 'zum',
  'ist', 'sind', 'war', 'sein', 'wird', 'werden', 'wurde', 'wurden',
  'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'mich', 'dich',
  'sich', 'mein', 'dein', 'unser', 'auch', 'nicht', 'noch', 'nur',
  'schon', 'also', 'dass', 'weil', 'damit', 'denn', 'bis', 'im', 'in',
].map(normalize))

/** Inhaltswort-Tokens: ≥3 Zeichen, ohne deutsche Stoppwörter. Umlaute werden zu ASCII normalisiert
 * (ä→a, ü→u); da Quote und Transcript identisch transformiert werden, bleibt der Recall korrekt. */
export function tokenizeContent(s: string): Set<string> {
  const cleaned = normalize(s).replace(/[^a-z0-9äöüß\s]/gi, ' ')
  return new Set(cleaned.split(/\s+/).filter(t => t.length >= 3 && !STOPWORDS.has(t)))
}

/**
 * Anteil der Inhaltswort-Tokens aus `quote`, die in `text` vorkommen (Recall/Containment).
 * 1 = alle Tokens des Zitats im Text gefunden, 0 = keines. Leeres Zitat → 1 (nichts zu prüfen).
 */
export function tokenContainment(quote: string, text: string): number {
  const q = tokenizeContent(quote)
  if (q.size === 0) return 1
  const t = tokenizeContent(text)
  let hit = 0
  for (const tok of q) if (t.has(tok)) hit++
  return hit / q.size
}
