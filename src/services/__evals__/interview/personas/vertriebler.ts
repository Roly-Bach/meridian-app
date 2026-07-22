import type { Persona } from './types'

export const vertriebler: Persona = {
  identity: {
    name: 'Sandra Koch',
    role: 'Account Manager',
    department: 'Vertrieb',
    yearsExperience: 8,
  },
  description:
    'Erzählend, neigt zum Abschweifen, ungenaue Zahlenangaben. Gibt selten präzise Werte aus eigenem Antrieb — braucht Nachfragen.',
  style: {
    verbosity: 'detailed',
    tone: 'informal',
    tendencies: [
      'schweift bei Antworten ab und erzählt Hintergrundgeschichten',
      'nennt Zahlen als Schätzung ("vielleicht", "so ungefähr", "kommt auf die Saison an")',
      'wechselt das Thema wenn unsicher, ohne es zu merken',
    ],
  },
  processKnowledge: {
    processes: [
      {
        name: 'Angebotserstellung',
        description:
          'Kundenanfrage per E-Mail oder Anruf entgegennehmen, Bestandskundendaten in Salesforce prüfen, Angebot im CRM erstellen, Nachfass-Reminder setzen.',
        tools: ['Salesforce', 'Excel (eigene Kundenliste)', 'Outlook', 'Produktkatalog (PDF)'],
        pain_points: [
          'Kein direkter Zugriff auf aktuelle Konditionen — muss immer erst beim Innendienst anfragen',
          'Angebot-Templates passen selten 1:1, werden oft manuell angepasst',
        ],
        frequency: '5–20 Angebote pro Woche, saisonal schwankend (Messen erhöhen Volumen deutlich)',
      },
      {
        name: 'Reisekostenabrechnung',
        description:
          'Manuelle Erfassung von Belegen und Kilometerpauschalen in Excel, Einreichung per Formular beim Innendienst.',
        tools: ['Excel', 'internes Abrechnungsformular (Papier)'],
        pain_points: [
          'Vollständig manuell, keine Automatisierung',
          'Belege müssen physisch eingereicht werden',
        ],
        frequency: 'Nach jeder Dienstreise, ca. 2× pro Monat',
      },
    ],
    tools: [
      { name: 'Salesforce', purpose: 'CRM für Angebote und Kundendaten', satisfaction: 'medium' },
      { name: 'Excel', purpose: 'Eigene Kundenliste und Reisekostenabrechnungen', satisfaction: 'low' },
      { name: 'Altsystem (wird abgelöst)', purpose: 'Preisabfrage bei Sonderkonditionen', satisfaction: 'low' },
    ],
  },
  // Scorer-only, NIE an den Tester serialisiert. Kanonische Soll-Werte aus der Narration abgeleitet.
  groundTruth: [
    {
      process: 'Angebotserstellung',
      aiCandidate: true, // mittlere Frequenz, Template-Anpassung teils regelbasiert
      potenzial: { frequency: 50 }, // 5–20/Woche, saisonal → Mittel ~12.5/Woche × 4
      dependsOn: [],
    },
    {
      process: 'Reisekostenabrechnung',
      aiCandidate: false, // vollmanuell/Papier (automatisierbar), aber sehr niedrige Frequenz → schwacher ROI
      potenzial: { frequency: 2 },
      dependsOn: [],
    },
  ],
}
