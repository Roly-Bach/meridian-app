// Persona: Buchhalter — detailliert, strukturiert, zahlenlastig
export interface Persona {
  name: string
  role: string
  department: string
  description: string
  responses: Record<string, string>
}

export const buchhalter: Persona = {
  name: 'Andreas Meier',
  role: 'Buchhalter',
  department: 'Finanzbuchhaltung',
  description: 'Detailliert, antwortet vollständig, kennt genaue Zahlen',
  responses: {
    default: 'Ich bin Andreas Meier, Buchhalter in der Finanzbuchhaltung. Ich kümmere mich hauptsächlich um Debitoren, Kreditoren und den Monatsabschluss.',
    process_question: 'Ein typischer Prozess ist die Rechnungsprüfung. Ich bekomme per Mail eine Rechnung, öffne sie, prüfe ob Lieferant, Betrag und Leistungszeitraum stimmen, buche sie dann in SAP, und lege sie ab.',
    frequency: 'Das mache ich etwa 80 bis 100 Mal im Monat, je nach Lieferantenstruktur.',
    duration: 'Eine Rechnung brauche ich im Normalfall 10 bis 15 Minuten. Wenn Rückfragen nötig sind, kann das auf 30 Minuten anschwellen.',
    rule_based: 'Ja, das läuft immer gleich ab. Wir haben eine feste Prüfmatrix und bei Beträgen über 5000 Euro brauchen wir eine Zweit-Freigabe.',
    data_sources: 'Ich arbeite mit SAP FI, unserem Dokumentenmanagementsystem DocuWare, und manchmal Excel für Ausnahmen.',
    error_rate: 'Ich schätze mal so 5 von 100 Rechnungen haben irgendwelche Diskrepanzen — fehlende Kostenstelle, falscher MwSt-Satz, oder der Betrag stimmt nicht mit dem Auftrag überein.',
    media_breaks: 'Ja, ich wechsle zwischen SAP, DocuWare und dem Mail-Client hin und her. Das sind ungefähr 4 bis 5 Wechsel pro Rechnung.',
    bottleneck: 'Das Nervigste ist wenn Rechnungen ohne Bestellreferenz kommen. Dann muss ich manuell in drei Systemen suchen, wer bestellt hat und ob ein Auftrag vorliegt. Das kostet mich leicht eine Stunde pro Woche.',
    wrap_up: 'Das stimmt so, was Sie zusammengefasst haben. Ach ja, wir haben auch einen manuellen Mahnprozess der noch sehr zeitaufwändig ist, den haben wir noch nicht erwähnt.',
  },
}
