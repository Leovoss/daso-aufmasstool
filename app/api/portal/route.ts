import {bucket,db} from '@/db/raw';
import {weekLabel,weekOf} from '@/lib/business';
import {checkSubmission,makePortalProof,portalChecksum,portalId,portalState,portalValidToken,type PortalLink} from '@/lib/portal';
import type {Project,StoredFile} from '@/lib/types';
const headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers});
const notFound=()=>reply({error:'Dieser Link ist ungültig.'},404);
async function load(token:unknown){
 if(!portalValidToken(token))return null;
 const row=await db().prepare("SELECT data FROM records WHERE id = ? AND kind = 'portal'").bind(await portalId(token)).first<{data:string}>();
 return row?JSON.parse(row.data) as PortalLink:null;
}
const weeksOf=(link:PortalLink)=>[...new Set(link.reports.map(r=>weekLabel(weekOf(r.date))))];
async function projectOf(link:PortalLink){const row=await db().prepare("SELECT data FROM records WHERE id = ? AND kind = 'project'").bind(link.projectId).first<{data:string}>();return row?JSON.parse(row.data) as Project:null;}
// Public endpoint: the unguessable link is the only credential, and only the quantities that were sent leave the server.
export async function GET(request:Request){try{
 const url=new URL(request.url),link=await load(url.searchParams.get('t'));if(!link)return notFound();
 if(url.searchParams.get('pdf')==='1'){
  const file=link.submission?await db().prepare("SELECT data FROM records WHERE id = ? AND kind = 'file'").bind(link.submission.fileId).first<{data:string}>():null;
  const object=file?await bucket().get((JSON.parse(file.data) as StoredFile).key):null;if(!object)return notFound();
  return new Response(object.body,{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="Kundenbestaetigung.pdf"'}});
 }
 const project=await projectOf(link);if(!project)return notFound();
 return reply({project:{name:project.name,number:project.number,customer:project.customer},weeks:weeksOf(link),status:portalState(link),expiresAt:link.expiresAt,reports:link.reports,rows:link.rows,submission:link.submission?{at:link.submission.at,name:link.submission.name,note:link.submission.note,corrections:link.submission.corrections}:undefined});
}catch{return reply({error:'Der Link konnte nicht geladen werden.'},400);}}
export async function POST(request:Request){try{
 if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Anfrage abgelehnt.'},403);
 const raw=await request.text();if(raw.length>200_000)return reply({error:'Die Eingabe ist zu groß.'},413);
 const body=JSON.parse(raw) as {t?:string;name?:string;note?:string;confirmed?:boolean;corrections?:unknown},link=await load(body.t);if(!link)return notFound();
 if(portalState(link)!=='open')return reply({error:portalState(link)==='expired'?'Dieser Link ist abgelaufen. Bitte wenden Sie sich an DaSo Lüftungsbau.':'Zu diesem Link wurde bereits eine Rückmeldung abgegeben.'},409);
 const project=await projectOf(link);if(!project)return notFound();
 const input=checkSubmission(link,body),submission={at:new Date().toISOString(),...input},checksum=await portalChecksum(link,submission);
 const weeks=weeksOf(link).join(', ');
 const bytes=await makePortalProof(link,submission,checksum,{project:project.name,number:project.number,customer:project.customer,weeks});
 const fileId=crypto.randomUUID(),key=link.projectId+'/portal/'+link.id.slice(7,39)+'.pdf';
 await bucket().put(key,bytes,{httpMetadata:{contentType:'application/pdf'}});
 const file:StoredFile={id:fileId,projectId:link.projectId,reportId:'',kind:'signed',name:'Kundenbestaetigung_'+project.number.replace(/[^\w.-]+/g,'_')+'.pdf',mime:'application/pdf',size:bytes.byteLength,key,createdAt:submission.at,packageId:link.packageId,reportIds:link.reports.map(r=>r.id)};
 const next:PortalLink={...link,status:'submitted',submission:{...submission,fileId,checksum}};
 const open="(SELECT json_extract(data,'$.status') FROM records WHERE id = ?) = 'open'";
 const [stored,claimed]=await db().batch([
  db().prepare(`INSERT INTO records (id,kind,project_id,data,updated_at) SELECT ?,?,?,?,? WHERE ${open}`).bind(fileId,'file',link.projectId,JSON.stringify(file),submission.at,link.id),
  db().prepare(`UPDATE records SET data = ?, updated_at = ? WHERE id = ? AND kind = 'portal' AND json_extract(data,'$.status') = 'open'`).bind(JSON.stringify(next),submission.at,link.id),
 ]);
 if(!stored.meta.changes||!claimed.meta.changes){await bucket().delete(key);return reply({error:'Zu diesem Link wurde bereits eine Rückmeldung abgegeben.'},409);}
 return reply({ok:true,corrections:submission.corrections.length});
}catch(e){return reply({error:e instanceof Error&&/^(Bitte|Mengen|Ungültige)/.test(e.message)?e.message:'Die Rückmeldung konnte nicht gespeichert werden.'},400);}}
