import PostalMime from 'postal-mime';
import {db,bucket,commit} from '@/db/raw';
import {readMailbox} from './mail-settings';
import {readInbox} from './mail-transport';
import {inspectInboxPDF,matchInboxPackage,inboxChecks} from './inbox-match';
import type {InboxItem,InboxState} from './inbox-types';
import type {MailPackage,Report,StoredFile} from './types';
const STATE='inbox:state',LOCK='inbox:lock';
export async function inboxState():Promise<InboxState|null>{const r=await db().prepare('SELECT data FROM records WHERE id = ?').bind(STATE).first<{data:string}>();return r?JSON.parse(r.data):null;}
export async function inboxLease(){const token=crypto.randomUUID(),now=new Date().toISOString(),expires=new Date(Date.now()+10*60000).toISOString();const r=await db().prepare("INSERT INTO records(id,kind,project_id,data,updated_at) VALUES (?,'inbox-lock','system',?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at WHERE records.updated_at < ?").bind(LOCK,token,expires,now).run();if(!r.meta.changes)throw Error('Der Posteingang wird gerade geprüft. Bitte kurz warten.');return async()=>{await db().prepare('DELETE FROM records WHERE id = ? AND data = ?').bind(LOCK,token).run();};}
async function saveState(state:InboxState){await db().prepare("INSERT INTO records VALUES (?,'inbox-state','system',?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at").bind(STATE,JSON.stringify(state),new Date().toISOString()).run();}
async function hash(value:string|Uint8Array){const bytes=typeof value==='string'?new TextEncoder().encode(value):value;const result=await crypto.subtle.digest('SHA-256',bytes as BufferSource);return Array.from(new Uint8Array(result),b=>b.toString(16).padStart(2,'0')).join('');}
export async function runInboxSync(){
 const mailbox=await readMailbox('measurement');if(!mailbox.inbox?.enabled)return{ok:true,enabled:false,message:'Automatisches Lesen ist in den E-Mail-Einstellungen noch nicht aktiviert.'};
 const release=await inboxLease();let state=await inboxState(),imported=0,manual=0,scanned=0;
 try{
  const account=await hash([mailbox.imap.host,mailbox.imap.username,mailbox.inbox.folder].join('|'));state=state?.account===account?state:{id:STATE,account,uidValidity:'',lastUid:0};state.lastRunAt=new Date().toISOString();
  const rows=await db().prepare("SELECT kind,data FROM records WHERE kind IN ('report','package')").all<{kind:string;data:string}>(),reports=rows.results.filter(r=>r.kind==='report').map(r=>JSON.parse(r.data) as Report),packages=rows.results.filter(r=>r.kind==='package').map(r=>JSON.parse(r.data) as MailPackage&{emlKey?:string});
  // Legacy outgoing messages retain their original Message-ID in the exact EML.
  for(const pack of packages.filter(p=>p.sentAt&&!p.messageId&&p.emlKey).slice(-100)){const object=await bucket().get(pack.emlKey!,{range:{offset:0,length:16384}});if(object)pack.messageId=(await object.text()).match(/^Message-ID:\s*(<[^>]+>)/mi)?.[1];}
  for(let batchIndex=0;batchIndex<3;batchIndex++){
   const batch=await readInbox(mailbox,{uidValidity:state.uidValidity,lastUid:state.lastUid});
   for(const message of batch.messages){scanned++;if(message.skipped||!message.raw){state.skipped=(state.skipped||0)+1;continue;}
    const raw=Uint8Array.from(atob(message.raw),c=>c.charCodeAt(0));let email:Awaited<ReturnType<typeof PostalMime.parse>>;
    try{email=await PostalMime.parse(raw,{maxNestingDepth:20,maxRfc822NestingDepth:2,maxHeadersSize:256*1024,maxPartCount:100});}catch{state.skipped=(state.skipped||0)+1;continue;}
    for(const [index,attachment]of email.attachments.entries()){
     if(!/application\/pdf/i.test(attachment.mimeType)&&!attachment.filename?.toLowerCase().endsWith('.pdf'))continue;
     const bytes=typeof attachment.content==='string'?Uint8Array.from(atob(attachment.content),c=>c.charCodeAt(0)):new Uint8Array(attachment.content);if(!bytes.length||bytes.length>8*1024*1024){state.skipped=(state.skipped||0)+1;continue;}
     const inspected=await inspectInboxPDF(bytes,reports),matched=matchInboxPackage(email.inReplyTo||'',email.references||'',inspected.reportIds,inspected.unknown,packages),name=(attachment.filename||'Kundenruecklauf.pdf').replace(/[\r\n\0/\\]/g,'-').slice(0,200);
     if(!matched.pack&&!inspected.reportIds.length&&!inspected.unknown&&!/aufma[ßs]|aufmass|stundenzettel|stundenbericht|mehraufwand|massen/i.test((email.subject||'')+' '+name))continue;
     const digest=await hash(bytes),id='inbound:'+await hash(account+'|'+(email.messageId||batch.uidValidity+':'+message.uid)+'|'+index+'|'+digest),exists=await db().prepare('SELECT id FROM records WHERE id = ?').bind(id).first();if(exists)continue;
     const now=new Date().toISOString(),pack=matched.pack,key='inbox/'+id.replace(':','-')+'.pdf',selected=pack?reports.filter(r=>pack.reportIds.includes(r.id)):[],checks=await inboxChecks(inspected.doc,selected),fileId=pack?crypto.randomUUID():'';
     const item:InboxItem={id,projectId:pack?.projectId||'',packageId:pack?.id||'',fileId,key,name,size:bytes.length,from:email.from?.address?.slice(0,250)||'',subject:(email.subject||'').slice(0,500),messageId:(email.messageId||'').slice(0,500),receivedAt:email.date||now,createdAt:now,updatedAt:now,match:matched.match,candidatePackageIds:matched.candidates,checks,notice:inspected.notice||'Automatischer Vorschlag; manuelle Prüfung und Freigabe erforderlich.'};
     await bucket().put(key,bytes,{httpMetadata:{contentType:'application/pdf'}});
     try{if(pack){const file:StoredFile={id:fileId,projectId:pack.projectId,reportId:'',packageId:pack.id,reportIds:pack.reportIds,kind:'signed',name,mime:'application/pdf',size:bytes.length,key,createdAt:now};await commit(pack.projectId,'Kundenrücklauf automatisch vorgemerkt','Posteingangsautomatik',[{kind:'file',value:file},{kind:'inbound',value:item}],[],item.subject);imported++;}
      else{await db().prepare("INSERT INTO records VALUES (?,'inbound','system',?,?) ON CONFLICT(id) DO NOTHING").bind(id,JSON.stringify(item),now).run();manual++;}}
     catch(e){/* Keep the deterministic PDF key for safe retries after uncertain commits. */throw e;}
    }
   }
   state.uidValidity=batch.uidValidity;state.lastUid=batch.lastUid;state.more=batch.more;state.error='';state.lastSuccessAt=new Date().toISOString();await saveState(state);if(!batch.more)break;
  }
  return{ok:true,enabled:true,imported,manual,scanned,more:!!state.more,skipped:state.skipped||0};
 }catch(e){if(state){state.error=(e instanceof Error?e.message:'Posteingangsprüfung fehlgeschlagen.').slice(0,500);await saveState(state);}throw e;}finally{await release();}
}
