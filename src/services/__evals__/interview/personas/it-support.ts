// Persona: IT-Support — wortkarg, kurze Antworten, technisch präzise
export interface Persona {
  name: string
  role: string
  department: string
  description: string
  responses: Record<string, string>
}

export const itSupport: Persona = {
  name: 'Michael Braun',
  role: 'IT-Support-Techniker',
  department: 'IT',
  description: 'Wortkarg, kurze Antworten, braucht Laddering-Proben',
  responses: {
    default: 'IT-Support. Tickets bearbeiten, Hardware reparieren.',
    process_question: 'Ticket kommt rein, ich löse es, schließe es.',
    frequency: 'Viele.',
    duration: 'Kommt drauf an.',
    rule_based: 'Meistens schon.',
    data_sources: 'Jira. Manchmal Remote Desktop.',
    error_rate: 'Wenig.',
    media_breaks: 'Manchmal.',
    bottleneck: 'Genehmigungen. Dauert zu lang.',
    wrap_up: 'Passt.',
    // Laddering-Antworten (nach Probe)
    frequency_probe: 'So 15 bis 20 Tickets pro Tag.',
    duration_probe: 'Einfache Sachen 10 Minuten. Hardware-Tausch eine Stunde.',
    rule_based_probe: 'Ja, wir haben ein Lösungsbuch. Aber manche Probleme sind immer anders.',
    media_breaks_probe: 'Ich wechsle zwischen Jira, Remote Desktop und dem internen Wiki. Drei Mal pro Ticket.',
    bottleneck_probe: 'Software-Freigaben müssen durch den IT-Leiter. Das dauert manchmal drei Tage obwohl es dringend ist.',
  },
}
