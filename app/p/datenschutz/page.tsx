import {LegalPage,Controller,Processor} from '@/components/legal-page';
export const metadata={title:'Datenschutz · DaSo Aufmaß'};
export default function CustomerPrivacy(){
 return <LegalPage title="Datenschutz zur Mengenprüfung" intro="Für Auftraggeber, die Aufmaße über einen persönlichen Link prüfen.">
  <Controller/>
  <h2>2. Wofür wir Ihre Daten verwenden</h2>
  <p>Sie prüfen über den Link die Aufmaßmengen eines Bauvorhabens und können Korrekturen eintragen. Wir verarbeiten Ihre Eingaben, um die Mengen mit Ihnen abzustimmen und Ihre Rückmeldung nachvollziehbar zu dokumentieren.</p>
  <h2>3. Welche Daten verarbeitet werden</h2>
  <ul>
   <li>Ihr eingetragener Name und Ihre Anmerkung</li>
   <li>Die von Ihnen eingetragenen Mengen und der Zeitpunkt der Rückmeldung</li>
   <li>Technische Daten beim Aufruf, zum Beispiel die IP-Adresse und Browserangaben. Sie werden von unserem Hosting-Anbieter zur Auslieferung der Seite und zum Schutz vor Missbrauch verarbeitet.</li>
  </ul>
  <p>Die Seite setzt keine Cookies, nutzt keine Tracking- oder Werbe-Dienste und lädt keine Inhalte von Drittanbietern.</p>
  <h2>4. Rechtsgrundlage</h2>
  <p>Art. 6 Abs. 1 lit. b DSGVO (Durchführung des Vertrags über das Bauvorhaben) und lit. f DSGVO (berechtigtes Interesse an einer ordnungsgemäßen Abrechnung und deren Nachweis).</p>
  <h2>5. Speicherdauer</h2>
  <p>Ihre Rückmeldung wird als Teil der Projektunterlagen aufbewahrt, entsprechend den gesetzlichen Aufbewahrungspflichten (insbesondere § 147 AO und § 257 HGB, in der Regel 6 bis 10 Jahre).</p>
  <h2>6. Empfänger</h2>
  <p>Ihre Angaben sehen nur die zuständigen Planer und Obermonteure von DaSo Lüftungsbau.</p>
  <Processor region="Westeuropa"/>
  <h2>7. Ihre Rechte</h2>
  <p>Sie haben das Recht auf Auskunft, Berichtigung, Löschung und Einschränkung der Verarbeitung sowie auf Widerspruch und Beschwerde bei der zuständigen Datenschutzaufsichtsbehörde. Anfragen richten Sie bitte an info@dasoluft.com.</p>
 </LegalPage>;
}
