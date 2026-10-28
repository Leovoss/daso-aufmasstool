import {LegalPage,Controller,Processor} from '@/components/legal-page';
export const metadata={title:'Datenschutzhinweis · DaSo Aufmaß'};
export default function Datenschutz(){
 return <LegalPage title="Datenschutzhinweis" intro="Zum Aufmaß-Tool für Planer und Obermonteure von DaSo Lüftungsbau.">
  <Controller/>
  <h2>2. Zweck der Datenverarbeitung</h2>
  <p>Die Anwendung dient der Erfassung von Aufmaßen und Stundenzetteln, der Abstimmung der Mengen mit Auftraggebern, der Wochenabrechnung und der Vorbereitung von Rechnungen. Sie wird nur von freigeschalteten Planern und Obermonteuren genutzt und ist nicht öffentlich zugänglich. Eine Ausnahme ist die Kundenseite, auf der Auftraggeber über einen persönlichen Link Mengen prüfen. Dafür gilt ein eigener Hinweis.</p>
  <h2>3. Verarbeitete Datenkategorien</h2>
  <ul>
   <li>Mitarbeitende und Nachunternehmer: Name, Kürzel, Einsatztage und je Projekt die Besetzung der Aufmaße</li>
   <li>Stundenzettel: Arbeitsbeginn, Ende, Pausen, Anfahrt und Übernachtung; bei Nachunternehmern zusätzlich Stundensätze</li>
   <li>Ansprechpartner der Auftraggeber: Name, Funktion, E-Mail-Adresse, Telefonnummer</li>
   <li>Aufmaßmengen, Preise sowie Rechnungs- und Zahlungsangaben je Projekt</li>
   <li>Hochgeladene Anlagen, zum Beispiel Fotos und PDF-Dokumente</li>
   <li>Änderungsprotokoll: Name oder E-Mail-Adresse der handelnden Person, Zeitpunkt und Art der Änderung</li>
   <li>Anmeldedaten: dienstliche E-Mail-Adresse und Rolle (aus der Montageplanung)</li>
  </ul>
  <h2>4. Zugriffsrechte</h2>
  <ul>
   <li><strong>Planer:</strong> voller Zugriff, einschließlich Einstellungen sowie Archivieren und Löschen von Projekten.</li>
   <li><strong>Obermonteur:</strong> Aufmaße, Versand und Abrechnung. Keine Einstellungen und keine Projektverwaltung.</li>
   <li><strong>Monteur:</strong> kein Zugriff auf diese Anwendung.</li>
  </ul>
  <h2>5. Rechtsgrundlage</h2>
  <p>Für Daten von Beschäftigten: Art. 6 Abs. 1 lit. b DSGVO in Verbindung mit § 26 BDSG. Für Ansprechpartner von Auftraggebern und Nachunternehmern: Art. 6 Abs. 1 lit. b DSGVO (Vertragsdurchführung) und lit. f DSGVO (berechtigtes Interesse an einer ordnungsgemäßen Abrechnung).</p>
  <h2>6. Speicherdauer</h2>
  <p>Abrechnungsrelevante Unterlagen werden entsprechend den gesetzlichen Aufbewahrungspflichten gespeichert (insbesondere § 147 AO und § 257 HGB, in der Regel 6 bis 10 Jahre). Als gelöscht markierte Aufmaße bleiben mit Begründung gesichert. Archivierte Projekte können von Planern endgültig gelöscht werden, sofern keine Aufbewahrungspflicht entgegensteht.</p>
  <h2>7. Technische Verarbeitung und Auftragsverarbeiter</h2>
  <Processor region="Westeuropa"/>
  <p>Die Anmeldung erfolgt über Cloudflare Access. Dabei wird ein Anmeldecookie gesetzt. Die Anwendung verwendet keine Tracking- oder Werbe-Dienste und lädt keine Schriftarten von Drittanbietern. Lesend greift sie auf die Datenbank der Montageplanung zu, um Rollen, Projekte, Mitarbeitende und Ansprechpartner zu übernehmen. Dorthin wird nichts zurückgeschrieben. Ein automatischer E-Mail-Versand aus der Anwendung ist derzeit nicht eingerichtet.</p>
  <h2>8. Rechte der betroffenen Personen</h2>
  <p>Jede betroffene Person hat das Recht auf Auskunft, Berichtigung, Löschung und Einschränkung der Verarbeitung sowie auf Widerspruch und Beschwerde bei der zuständigen Datenschutzaufsichtsbehörde. Anfragen richten sich an info@dasoluft.com.</p>
 </LegalPage>;
}
