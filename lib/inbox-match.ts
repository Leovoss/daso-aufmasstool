import {PDFDocument} from 'pdf-lib';
import {pdfId} from './return-fields';
import {compareReturnDocument,returnHasChanges} from './return-review';
import type {MailPackage,Report} from './types';
import type {InboxCheck} from './inbox-types';
export const mailIds=(value:string):string[]=>Array.from(value.match(/<[^<>\s]+>/g)||[]);
export async function inspectInboxPDF(bytes:Uint8Array,reports:Report[]){
 if(bytes.byteLength>2*1024*1024)return{doc:null,reportIds:[] as string[],unknown:false,notice:'Großes PDF: automatischer Feldabgleich ausgelassen; manuell prüfen.'};
 try{const doc=await PDFDocument.load(bytes,{updateMetadata:false}),known=new Map(reports.map(r=>[pdfId(r.id),r.id])),fields=doc.getForm().getFields().map(f=>f.getName()).filter(n=>n.startsWith('DaSo_Version_')),reportIds=fields.flatMap(n=>known.has(n.slice(13))?[known.get(n.slice(13))!]:[]);return{doc,reportIds,unknown:fields.some(n=>!known.has(n.slice(13))),notice:fields.length?'':'Keine sicheren PDF-Prüffelder; sichtbare Angaben manuell prüfen.'};}catch{return{doc:null,reportIds:[] as string[],unknown:false,notice:'PDF nicht automatisch lesbar; manuell prüfen.'};}
}
export function matchInboxPackage(reply:string,references:string,reportIds:string[],unknown:boolean,packages:MailPackage[]){
 const sent=packages.filter(p=>!!p.sentAt),direct=sent.filter(p=>p.messageId&&mailIds(reply).includes(p.messageId)),thread=direct.length?direct:sent.filter(p=>p.messageId&&mailIds(references).includes(p.messageId)),byPDF=reportIds.length?sent.filter(p=>reportIds.every(id=>p.reportIds.includes(id))):[];
 const candidates=thread.length?thread:byPDF;
 if(unknown||candidates.length!==1||reportIds.some(id=>!candidates[0]?.reportIds.includes(id)))return{pack:null,match:'manual' as const,candidates:[...new Set([...thread,...byPDF].map(p=>p.id))]};
 return{pack:candidates[0],match:thread.length?'thread' as const:'pdf-fields' as const,candidates:[candidates[0].id]};
}
export async function inboxChecks(doc:PDFDocument|null,reports:Report[]):Promise<Record<string,InboxCheck>>{
 const checks:Record<string,InboxCheck>={};for(const [index,r]of reports.entries()){if(!doc||index>=50){checks[r.id]={status:'manual',version:r.updatedAt,changed:0};continue;}const result=await compareReturnDocument(doc,r),changed=returnHasChanges(result,r);checks[r.id]={status:result.mode!=='forms'?'manual':changed?'changes':'unchanged',version:r.updatedAt,changed:changed?Object.keys(result.quantities).filter(id=>r.lines.find(l=>l.id===id)?.quantity!==result.quantities[id]).length||1:0};}return checks;
}
