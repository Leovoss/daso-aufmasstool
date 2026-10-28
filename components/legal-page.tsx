import type {ReactNode} from 'react';
import '@/app/legal.css';
export function LegalPage({title,intro,children}:{title:string;intro:string;children:ReactNode}){
 return <main className="legal"><article><p className="legal-eyebrow">DaSo · Rechtliches</p><h1>{title}</h1><p className="legal-intro">{intro}</p>{children}</article></main>;
}
export const Controller=()=><><h2>1. Verantwortlicher</h2><p>DaSo Lüftungsbau GmbH<br/>Am Kohlenweg 1, 56307 Dürrholz<br/>Telefon: +49 2684 9770031<br/>E-Mail: info@dasoluft.com</p></>;
export const Processor=({region}:{region:string})=><p>Die Anwendung läuft bei Cloudflare, Inc. (Server-Anwendung, Datenbank und Dateispeicher in der Region {region}). Cloudflare handelt als Auftragsverarbeiter auf Grundlage des <a href="https://www.cloudflare.com/cloudflare-customer-dpa/" target="_blank" rel="noreferrer">Customer Data Processing Addendum</a>. Dabei können Daten auch in Drittländern verarbeitet werden, abgesichert durch die dort genannten Garantien.</p>;
