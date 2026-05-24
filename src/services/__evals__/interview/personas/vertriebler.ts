// Persona: Vertriebler — erzählend, abschweifend, wenig Zahlen
export interface Persona {
  name: string
  role: string
  department: string
  description: string
  responses: Record<string, string>
}

export const vertriebler: Persona = {
  name: 'Sandra Koch',
  role: 'Account Manager',
  department: 'Vertrieb',
  description: 'Erzählend, neigt zum Abschweifen, ungenaue Zahlenangaben',
  responses: {
    default: 'Hi, ich bin Sandra, ich mache Vertrieb hier schon seit 8 Jahren. Hauptsächlich Bestandskundenpflege und Angebotserstellung.',
    process_question: 'Also wenn ein Kunde anfragen kommt, dann — warten Sie, das ist eigentlich super interessant wie das läuft. Ich bekomme eine Mail oder manchmal einen Anruf, dann schaue ich mir an was der Kunde schon bei uns hat, dann erstelle ich ein Angebot in unserem CRM, und dann folge ich nach. Manchmal dauert das ewig bis Kunden sich melden.',
    frequency: "Angebote? Oh, das variiert sehr. Manchmal 5 in der Woche, manchmal 20. Kommt auf die Saison an. Letzten Monat war's viel wegen der Messe.",
    duration: 'Ja, ein Standard-Angebot... vielleicht eine Stunde? Aber komplexe Projekte nehmen auch mal einen halben Tag.',
    rule_based: 'Hmm, eigentlich schon, es gibt Templates. Aber dann weiche ich oft ab weil jeder Kunde anders ist, wissen Sie.',
    data_sources: 'CRM, Salesforce bei uns. Und Excel natürlich, hab ich meine eigene Kundenliste drin. Und den Katalog hab ich als PDF.',
    error_rate: 'Fehler? Also manchmal vergesse ich eine Nachfassung, das gibt der Chef manchmal Rückmeldung drüber. Aber richtige Fehler... selten.',
    media_breaks: 'Ich wechsle schon zwischen Salesforce, Excel und Outlook hin und her. Und manchmal schau ich noch in das alte System rein.',
    bottleneck: 'Das Ärgste ist die Angebotserstellung. Ich muss immer erst die Preise beim Innendienst erfragen, weil ich keinen direkten Zugriff auf die aktuellen Konditionen hab.',
    wrap_up: 'Ja, das passt so. Ach stimmt, die Reisekostenabrechnung hab ich vergessen zu erwähnen, die ist auch recht mühsam.',
  },
}
