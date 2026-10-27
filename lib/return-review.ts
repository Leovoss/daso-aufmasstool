import {PDFDocument} from 'pdf-lib';
import type {Report} from './types';
import {parseDecimal,qty2} from './business';
import {isTimeReport} from './time-reports';
import {quantityField,timeField,versionField,reportFingerprint} from './return-fields';
export type ReturnComparison={mode:'forms'|'manual';message:string;quantities:Record<string,number>;timeValues:Record<string,{start:string;end:string;pauseMinutes:number;allowanceQuantity:number}>};
// PDF form values are proposals. Never infer "unchanged" from a scanned page
// or an absent field. The operator must inspect every row before applying.
export async function compareReturn(bytes:ArrayBuffer|Uint8Array,report:Report):Promise<ReturnComparison>{
 const result:ReturnComparison={mode:'manual',message:'Keine vollständig lesbaren Prüffelder gefunden. Bitte den Rücklauf daneben öffnen und alle Angaben manuell prüfen. Handschriftliche Änderungen in Scans werden nicht automatisch erkannt.',quantities:{},timeValues:{}};
 try{const doc=await PDFDocument.load(bytes,{updateMetadata:false});return await compareReturnDocument(doc,report);
 }catch{return{...result,quantities:{},timeValues:{}};}
}
export async function compareReturnDocument(doc:PDFDocument,report:Report):Promise<ReturnComparison>{
 const result:ReturnComparison={mode:'manual',message:'Nicht vollständig automatisch lesbar. Sichtbare Eintragungen und Mengen manuell prüfen; Handschrift wird nicht sicher erkannt.',quantities:{},timeValues:{}};
 try{const form=doc.getForm();let version='';try{version=form.getTextField(versionField(report.id)).getText()||'';}catch{}if(version!==await reportFingerprint(report)){result.message=version?'Der Rücklauf gehört zu einem früheren Bearbeitungsstand. Bitte alle Mengen manuell abgleichen.':result.message;return result;}
  if(isTimeReport(report)){for(const e of report.timeSheet?.entries||[]){const read=(field:string)=>form.getTextField(timeField(report.id,e.id,field)).getText()||'',start=read('Anfang'),end=read('Ende'),pauseMinutes=parseDecimal(read('Pause')),allowanceQuantity=parseDecimal(read('Pauschale'));if(!/^\d{2}:\d{2}$/.test(start)||!/^\d{2}:\d{2}$/.test(end)||!Number.isInteger(pauseMinutes)||!Number.isInteger(allowanceQuantity)||pauseMinutes<0||allowanceQuantity<0)throw Error('Ungültige Angaben');result.timeValues[e.id]={start,end,pauseMinutes,allowanceQuantity};}}
  else for(const line of report.lines){const raw=form.getTextField(quantityField(report.id,line.id)).getText();if(!raw?.trim())throw Error('Menge fehlt');const quantity=parseDecimal(raw);if(!Number.isFinite(quantity)||quantity<0||quantity>1e8)throw Error('Ungültige Menge');result.quantities[line.id]=quantity===parseDecimal(qty2(line.quantity))?line.quantity:quantity;}
  result.mode='forms';result.message='PDF-Prüffelder gelesen. Vorschläge und sichtbare Eintragungen im Rücklauf vollständig prüfen; handschriftliche Überlagerungen werden nicht automatisch erkannt.';return result;
 }catch{return{...result,quantities:{},timeValues:{}};}
}

export async function comparePackageReturn(bytes:ArrayBuffer|Uint8Array,reports:Report[]):Promise<Record<string,ReturnComparison>>{
 let doc:PDFDocument|null=null;try{doc=await PDFDocument.load(bytes,{updateMetadata:false});}catch{}
 const values:Record<string,ReturnComparison>={};for(const report of reports)values[report.id]=doc?await compareReturnDocument(doc,report):{mode:'manual',message:'PDF nicht automatisch lesbar. Bitte manuell prüfen.',quantities:{},timeValues:{}};return values;
}
export function returnHasChanges(result:ReturnComparison|undefined,report:Report){if(result?.mode!=='forms')return false;if(isTimeReport(report))return(report.timeSheet?.entries||[]).some(e=>{const v=result.timeValues[e.id];return !v||v.start!==e.start||v.end!==e.end||v.pauseMinutes!==e.pauseMinutes||v.allowanceQuantity!==(e.allowanceQuantity??e.travelQuantity+e.overnightQuantity);});return report.lines.some(l=>result.quantities[l.id]!==l.quantity);}
