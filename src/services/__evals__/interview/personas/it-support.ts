import type { Persona } from './types'

export const itSupport: Persona = {
  identity: {
    name: 'Michael Braun',
    role: 'IT-Support-Techniker',
    department: 'IT',
    yearsExperience: 5,
  },
  // Persönlichkeit (wortkarg); Offenlegungs-Disziplin ist entkoppelt → disclosureMode (PROJ-40 C).
  description:
    'Wortkarg, kurze Antworten. Laddering ist notwendig.',
  style: {
    verbosity: 'concise',
    tone: 'informal',
    tendencies: [
      'antwortet in Halbsätzen oder Ein-Wort-Antworten, kein Fließtext',
      'weicht aus mit "Kommt drauf an" wenn unsicher, ohne weitere Erklärung',
    ],
  },
  processKnowledge: {
    processes: [
      {
        name: 'Ticket-Bearbeitung',
        description:
          'Ticket aus Jira annehmen, Problem per Remote Desktop oder vor Ort diagnostizieren, Lösung im Wiki nachschlagen oder selbst erarbeiten, Problem beheben, Ticket mit Dokumentation schließen.',
        tools: ['Jira', 'Remote Desktop', 'internes Wiki (Lösungsbuch)'],
        pain_points: [
          'Software-Freigaben müssen durch den IT-Leiter — dauert bis zu 3 Tage obwohl oft dringend',
          'Manche Probleme weichen vom Lösungsbuch ab und erfordern eigene Recherche',
        ],
        frequency: '15–20 Tickets pro Tag',
      },
      {
        name: 'Hardware-Tausch',
        description:
          'Defektes Gerät beim Nutzer einsammeln, Ersatzgerät aus dem Lager holen, konfigurieren (Imaging-Tool), Daten übertragen, Nutzer einweisen.',
        tools: ['Asset-Management-System', 'Imaging-Tool'],
        pain_points: [
          'Lagerverwaltung ungenau — Teile sind im System als vorhanden markiert, aber physisch nicht auffindbar',
        ],
        frequency: '3–5 Hardware-Tausch-Vorgänge pro Woche',
      },
    ],
    tools: [
      { name: 'Jira', purpose: 'Ticketsystem für alle eingehenden Support-Anfragen', satisfaction: 'high' },
      { name: 'Remote Desktop', purpose: 'Fernzugriff auf Nutzer-Rechner für Software-Probleme', satisfaction: 'medium' },
      { name: 'Wiki / Lösungsbuch', purpose: 'Dokumentierte Lösungswege für häufige Probleme', satisfaction: 'medium' },
    ],
    additionalContext:
      'Wechselt beim Bearbeiten eines Tickets im Schnitt ca. 3× zwischen Jira, Remote Desktop und Wiki.',
  },
  // Scorer-only, NIE an den Tester serialisiert. Kanonische Soll-Werte aus der Narration abgeleitet.
  groundTruth: [
    {
      process: 'Ticket-Bearbeitung',
      aiCandidate: true, // sehr hohe Frequenz, Wiki-Lookup teils regelbasiert, 3× Tool-Wechsel = Medienbrüche
      potenzial: { frequency: 350, media_breaks: 3 }, // 15–20/Tag × ~20 Arbeitstage
      dependsOn: [],
    },
    {
      process: 'Hardware-Tausch',
      aiCandidate: false, // niedrigere Frequenz, physisch
      potenzial: { frequency: 16 }, // 3–5/Woche × 4
      dependsOn: [],
    },
  ],
}
