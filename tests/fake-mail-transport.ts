// Bundled only by the test harness. No network connection or message leaves the tests.
import {DeliveryError} from '../lib/mail-protocol';
import type {Mailbox} from '../lib/mail-settings';
export async function testMailbox(m:Mailbox){if(m.smtp.password!=='SMTP-Test-Secret')throw Error('Simulierte Anmeldung abgelehnt.');return{smtp:true,imap:m.archive};}
export async function deliver(_m:Mailbox,recipients:string[],message:string){if(!recipients.every(r=>r.endsWith('.invalid')))throw Error('Tests akzeptieren ausschließlich ungültige Test-Adressen.');if(message.includes(btoa('simulate_uncertain')))throw new DeliveryError('Simulierte ausbleibende Bestätigung',true);if(message.includes(btoa('simulate_rejection')))throw new DeliveryError('Simulierte Ablehnung',false);return{sentCopy:true,warning:''};}

export async function readInbox(m:Mailbox,cursor:{uidValidity:string;lastUid:number},limit=5){
 const{db}=await import('../db/raw');const row=await db().prepare("SELECT data FROM records WHERE id='test:inbox'").first<{data:string}>(),messages=row?JSON.parse(row.data) as {uid:number;raw:string}[]:[];const found=messages.filter(v=>v.uid>cursor.lastUid).slice(0,limit);return{ok:true,inboxVersion:1,uidValidity:'9876',lastUid:found.at(-1)?.uid||cursor.lastUid,more:messages.some(v=>v.uid>(found.at(-1)?.uid||cursor.lastUid)),messages:found};
}
