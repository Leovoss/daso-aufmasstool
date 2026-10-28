import {PDFDocument,StandardFonts,rgb,type PDFFont} from 'pdf-lib';
import {parseDecimal,qty2} from './business';
import type {Report} from './types';
import {isTimeReport} from './time-reports';
export type PortalRow={reportId:string;lineId:string;number:string;description:string;unit:string;quantity:number};
export type PortalCorrection={reportId:string;lineId:string;quantity:number};
export type PortalSubmission={at:string;name:string;note:string;corrections:PortalCorrection[];fileId:string;checksum:string};
export type PortalLink={id:string;projectId:string;packageId:string;createdAt:string;createdBy:string;expiresAt:string;status:'open'|'submitted'|'applied'|'rejected'|'revoked';reports:{id:string;date:string;label:string}[];rows:PortalRow[];submission?:PortalSubmission;decision?:{at:string;user:string;note:string}};
export const PORTAL_DAYS=60;
const hex=(bytes:ArrayBuffer)=>Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');
export async function sha256(value:string){return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));}
export const newPortalToken=()=>Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
export const portalValidToken=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);
export async function portalId(token:string){return 'portal:'+await sha256(token);}
export function portalRows(reports:Report[]):PortalRow[]{return reports.filter(r=>!isTimeReport(r)).flatMap(r=>r.lines.map(l=>({reportId:r.id,lineId:l.id,number:l.number,description:l.description,unit:l.unit,quantity:l.quantity})));}
export function portalState(link:PortalLink,now=new Date().toISOString()){return link.status==='open'&&link.expiresAt<now?'expired':link.status;}
// Only changed quantities are stored. Every value is checked against the rows that were sent.
export function checkSubmission(link:PortalLink,input:{name?:unknown;note?:unknown;confirmed?:unknown;corrections?:unknown}){
 const name=String(input.name??'').trim().slice(0,120),note=String(input.note??'').trim().slice(0,2000);
 if(!name)throw Error('Bitte Ihren Namen eintragen.');
 if(input.confirmed!==true)throw Error('Bitte bestätigen, dass Sie alle Mengen geprüft haben.');
 const list=Array.isArray(input.corrections)?input.corrections:[];
 if(list.length>link.rows.length)throw Error('Ungültige Korrektur.');
 const known=new Map(link.rows.map(r=>[r.reportId+'|'+r.lineId,r])),seen=new Set<string>(),corrections:PortalCorrection[]=[];
 for(const item of list as Record<string,unknown>[]){
  const key=String(item?.reportId)+'|'+String(item?.lineId),row=known.get(key);
  if(!row||seen.has(key))throw Error('Ungültige Korrektur.');seen.add(key);
  const quantity=typeof item.quantity==='number'?item.quantity:parseDecimal(item.quantity);
  if(!Number.isFinite(quantity)||quantity<0||quantity>1e8||Math.abs(quantity*10000-Math.round(quantity*10000))>=.001)throw Error('Mengen benötigen eine Zahl ab 0 mit höchstens vier Nachkommastellen.');
  if(quantity!==row.quantity)corrections.push({reportId:row.reportId,lineId:row.lineId,quantity:Math.round(quantity*10000)/10000});
 }
 if(corrections.length&&!note)throw Error('Bitte die Korrektur kurz begründen.');
 return{name,note,corrections};
}
export const portalChecksum=(link:Pick<PortalLink,'id'|'rows'>,submission:Pick<PortalSubmission,'at'|'name'|'note'|'corrections'>)=>sha256(JSON.stringify([link.id,submission.at,submission.name,submission.note,submission.corrections]));
const safe=(value:string)=>value.replace(/[^ -~ -ÿ€]/g,'?').replace(/[\r\n\t]+/g,' ');
function wrap(font:PDFFont,text:string,width:number,size:number){const lines:string[]=[];let line='';for(const word of safe(text).split(' ')){const next=line?line+' '+word:word;if(line&&font.widthOfTextAtSize(next,size)>width){lines.push(line);line=word;}else line=next;}lines.push(line);return lines;}
// The proof lists every sent row, so the document stands on its own. It has no form fields.
export async function makePortalProof(link:PortalLink,submission:Omit<PortalSubmission,'fileId'|'checksum'>,checksum:string,meta:{project:string;number:string;customer:string;weeks:string}){
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold),W=595.28,H=841.89,M=40,ink=rgb(.1,.15,.23),muted=rgb(.4,.46,.55),red=rgb(.75,.12,.12),light=rgb(.94,.95,.97);
 let page=doc.addPage([W,H]),y=H-M;
 const text=(value:string,x:number,size=9,font_=font,color=ink)=>page.drawText(safe(value),{x,y,size,font:font_,color});
 const para=(value:string,size=9,font_=font,color=ink)=>{for(const line of wrap(font_,value,W-M*2,size)){if(y<M+30){page=doc.addPage([W,H]);y=H-M;}text(line,M,size,font_,color);y-=size+4;}};
 const changed=new Map(submission.corrections.map(c=>[c.reportId+'|'+c.lineId,c.quantity]));
 text('Kundenbestätigung Aufmaß',M,18,bold);y-=24;
 para('Bauvorhaben: '+meta.project+' ('+meta.number+')');if(meta.customer)para('Auftraggeber: '+meta.customer);para('Zeitraum: '+meta.weeks);
 para('Eingereicht von: '+submission.name+' am '+new Intl.DateTimeFormat('de-DE',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Berlin'}).format(new Date(submission.at)));
 y-=6;para(submission.corrections.length?`${submission.corrections.length} Position${submission.corrections.length===1?'':'en'} korrigiert.`:'Alle Mengen wurden geprüft und bestätigt.',11,bold,submission.corrections.length?red:ink);
 if(submission.note)para('Begründung: '+submission.note);
 para('Die Korrektur wird nach Prüfung durch DaSo Lüftungsbau übernommen. Dieses Dokument ist nicht bearbeitbar.',8,font,muted);y-=8;
 const cols=[M,M+62,M+270,M+310,M+380,M+455],head=()=>{page.drawRectangle({x:M,y:y-5,width:W-M*2,height:17,color:light});['Position','Bezeichnung','EH','Aufmaß','Korrektur','Differenz'].forEach((label,i)=>page.drawText(label,{x:cols[i]+2,y,size:8,font:bold,color:ink}));y-=18;};
 head();
 for(const row of link.rows){
  const lines=wrap(font,row.description,200,8),height=Math.max(1,lines.length)*10+4;
  if(y-height<M+20){page=doc.addPage([W,H]);y=H-M;head();}
  const corrected=changed.get(row.reportId+'|'+row.lineId),color=corrected===undefined?ink:red;
  page.drawText(safe(row.number),{x:cols[0]+2,y,size:8,font:bold,color:ink});lines.forEach((line,i)=>page.drawText(line,{x:cols[1]+2,y:y-i*10,size:8,font,color:ink}));
  page.drawText(safe(row.unit),{x:cols[2]+2,y,size:8,font,color:ink});
  page.drawText(qty2(row.quantity),{x:cols[3]+2,y,size:8,font,color:ink});
  if(corrected!==undefined){page.drawText(qty2(corrected),{x:cols[4]+2,y,size:8,font:bold,color});const diff=corrected-row.quantity;page.drawText((diff>0?'+':'')+qty2(diff),{x:cols[5]+2,y,size:8,font:bold,color});}
  else page.drawText('-',{x:cols[4]+2,y,size:8,font,color:muted});
  y-=height;page.drawLine({start:{x:M,y:y+6},end:{x:W-M,y:y+6},thickness:.4,color:light});
 }
 y-=12;para('Prüfsumme: '+checksum.slice(0,32),7,font,muted);
 const data=JSON.stringify({version:1,link:link.id,submittedAt:submission.at,name:submission.name,note:submission.note,corrections:submission.corrections,checksum});
 await doc.attach(new TextEncoder().encode(data),'aufmass-korrektur.json',{mimeType:'application/json',description:'Maschinenlesbare Korrektur'});
 doc.setTitle('Kundenbestätigung Aufmaß');doc.setSubject(meta.project);
 return doc.save();
}
