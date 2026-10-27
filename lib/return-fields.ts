export const pdfId=(value:string)=>value.replace(/[^a-zA-Z0-9]/g,'');
export const quantityField=(reportId:string,lineId:string)=>`Menge_${pdfId(reportId)}_${pdfId(lineId)}`;
export const timeField=(reportId:string,entryId:string,field:string)=>`Zeit_${pdfId(reportId)}_${pdfId(entryId)}_${field}`;
export const versionField=(reportId:string)=>`DaSo_Version_${pdfId(reportId)}`;
import type {Report} from './types';
// Sending or updating the review status changes updatedAt, but does not change
// the customer document. Match its content, rather than its dispatch timestamp.
export async function reportFingerprint(report:Report){const value=JSON.stringify([report.id,report.kind||'measurement',report.date,report.endDate,report.team,report.author,report.area,report.note,report.lines.map(l=>[l.id,l.number,l.description,l.unit,l.price,l.quantity,l.remark,l.exactMinutes]),report.timeSheet?.entries.map(e=>[e.id,e.date,e.workerId,e.name,e.role,e.start,e.end,e.pauseMinutes,e.task,e.allowanceQuantity,e.travelQuantity,e.overnightQuantity,e.rates])]);const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');}
