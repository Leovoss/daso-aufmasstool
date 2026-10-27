import {env} from 'cloudflare:workers';
import {actor} from '@/lib/auth';
import {runInboxSync} from '@/lib/inbox-sync';
// Called by a scheduler with the shared secret, or by a signed-in user with an app role.
async function allowed(request:Request){
 const secret=(env as unknown as Record<string,string|undefined>).DASO_CRON_SECRET,sent=request.headers.get('authorization')?.replace(/^Bearer /,'')||'';
 if(secret&&sent.length===secret.length&&[...secret].reduce((d,c,i)=>d|(c.charCodeAt(0)^sent.charCodeAt(i)),0)===0)return;
 await actor(request);
}
export async function POST(request:Request){try{if((env as unknown as Record<string,string>).DASO_INBOX_SERVICE_ENABLED!=='1')throw Error('Unbeaufsichtigte Prüfung ist noch nicht eingerichtet.');await allowed(request);return Response.json(await runInboxSync());}catch(e){return Response.json({error:e instanceof Error?e.message:'Prüfung fehlgeschlagen.'},{status:400});}}
