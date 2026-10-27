import {randomId} from './ids';
import {asciiFileName,contentDisposition} from './file-names';
import type {StoredFile} from './types';
function base64(bytes:Uint8Array){let text='';for(let n=0;n<bytes.length;n+=8192)text+=String.fromCharCode(...bytes.subarray(n,n+8192));return btoa(text);}
const encode=(s:string)=>base64(new TextEncoder().encode(s));
const folded=(s:string)=>(s.match(/.{1,76}/g)||[]).join('\r\n');
export async function makeEML(to:string,cc:string,subject:string,body:string,pdf:Uint8Array,filename:string,originals:StoredFile[],options?:{senderEmail:string;senderName:string;resolve:(file:StoredFile)=>Promise<Uint8Array>}){
 const safe=(s:string)=>s.replace(/[\r\n]/g,' '),encodedWords=(s:string)=>(Array.from(safe(s)).join('').match(/.{1,18}/gu)||['']).map(v=>'=?UTF-8?B?'+encode(v)+'?=').join('\r\n ');
 const boundary='DaSo_'+randomId().replaceAll('-',''),attachment=(name:string,mime:string,data:Uint8Array)=>[`--${boundary}`,`Content-Type: ${/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(mime)?mime:'application/octet-stream'}; name="${asciiFileName(name)}"`,`Content-Disposition: ${contentDisposition(name)}`,'Content-Transfer-Encoding: base64','',folded(base64(data))].join('\r\n');
 const parts=[...(options?[`From: ${encodedWords(options.senderName)} <${safe(options.senderEmail)}>`,`Date: ${new Date().toUTCString()}`,`Message-ID: <${randomId()}@${options.senderEmail.split('@')[1]}>`]:['X-Unsent: 1']),`To: ${safe(to).replaceAll(';',',')}`,...(cc?[`Cc: ${safe(cc).replaceAll(';',',')}`]:[]),`Subject: ${encodedWords(subject)}`,'MIME-Version: 1.0',`Content-Type: multipart/mixed; boundary="${boundary}"`,'',`--${boundary}`,'Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',folded(encode(body)),attachment(filename,'application/pdf',pdf)];
 for(const file of originals){let bytes:Uint8Array;if(options)bytes=await options.resolve(file);else{const r=await fetch('/api/files?id='+encodeURIComponent(file.id));if(!r.ok)throw Error('Originalanlage fehlt: '+file.name);bytes=new Uint8Array(await r.arrayBuffer());}parts.push(attachment(file.name,file.mime,bytes));}parts.push(`--${boundary}--`,'');return parts.join('\r\n');
}
