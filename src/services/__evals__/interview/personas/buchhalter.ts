import type { Persona } from './types'

export const buchhalter: Persona = {
  identity: {
    name: 'Andreas Meier',
    role: 'Buchhalter',
    department: 'Finanzbuchhaltung',
    yearsExperience: 12,
  },
  description: 'Detailliert, strukturiert, zahlenlastig. Antwortet vollständig und kennt genaue Zahlen.',
  style: {
    verbosity: 'detailed',
    tone: 'formal',
    tendencies: [
      'nennt konkrete Zahlen (Mengen, Prozentwerte, Zeitangaben)',
      'strukturiert Antworten in klaren Schritten',
      'erwähnt Ausnahmefälle und Regelgrenzen proaktiv',
    ],
  },
  processKnowledge: {
    processes: [
      {
        name: 'Rechnungsprüfung',
        description:
          'Eingehende Rechnung per E-Mail empfangen, Lieferant / Betrag / Leistungszeitraum prüfen, in SAP FI buchen, in DocuWare ablegen. Bei Beträgen über 5.000 EUR ist eine Zweit-Freigabe erforderlich.',
        tools: ['SAP FI', 'DocuWare', 'E-Mail-Client'],
        pain_points: [
          'Rechnungen ohne Bestellreferenz: manuell in drei Systemen nach Auftraggeber suchen — kostet ca. 1 Stunde pro Woche',
          'Diskrepanzen bei ca. 5 von 100 Rechnungen: fehlende Kostenstelle, falscher MwSt-Satz oder Betragsdifferenz',
        ],
        frequency: '80–100 Rechnungen pro Monat',
      },
      {
        name: 'Monatsabschluss',
        description:
          'Abstimmung aller offenen Posten, Buchung von Rückstellungen, Übergabe an Controlling.',
        tools: ['SAP FI', 'Excel'],
        pain_points: [
          'Zeitdruck am Monatsende — 2–3 Tage intensive Arbeit',
          'Ausnahmen müssen manuell in Excel nachgepflegt werden',
        ],
        frequency: 'Einmal pro Monat, dauert 2–3 Tage',
      },
    ],
    tools: [
      { name: 'SAP FI', purpose: 'Buchhaltungssystem für Buchungen und Reporting', satisfaction: 'medium' },
      { name: 'DocuWare', purpose: 'Dokumentenmanagement für Rechnungsablage', satisfaction: 'medium' },
      { name: 'Excel', purpose: 'Ausnahmen und Ad-hoc-Auswertungen', satisfaction: 'low' },
    ],
    additionalContext:
      'Monatlicher Mahnprozess ist ebenfalls vorhanden und zeitaufwändig, wurde im Interview aber noch nicht aktiv angesprochen.',
  },
}
