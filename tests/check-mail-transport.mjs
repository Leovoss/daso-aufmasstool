import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {build} from '../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild/lib/main.js';
await mkdir('/tmp/aufmass-tests',{recursive:true});
await build({entryPoints:['lib/mail-transport.ts'],outfile:'/tmp/aufmass-tests/mail-transport.mjs',bundle:true,format:'esm',platform:'node'});
const {deliver,testMailbox,readInbox}=await import('/tmp/aufmass-tests/mail-transport.mjs');
const account={senderEmail:'aufmass@example.invalid',smtp:{password:'smtp-secret'},imap:{password:'imap-secret'},archive:true,sentFolder:'Sent',relay:{url:'https://mail.example.invalid/relay.php',token:'relay-secret'}};
const originalFetch=globalThis.fetch;let calls=0;
try{
 globalThis.fetch=async(url,options)=>{calls++;assert.equal(url,account.relay.url);assert.equal(options.method,'POST');assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Bearer '+account.relay.token);const body=JSON.parse(options.body);assert.equal(body.action,'send');assert.equal(body.requestId,'package-stable-id');assert.deepEqual(body.recipients,['kunde@example.invalid']);assert.equal(body.message,'MIME content');assert.equal(body.account.smtp.password,'smtp-secret');return Response.json({ok:true,accepted:true,sentCopy:true});};
 assert.deepEqual(await deliver(account,['kunde@example.invalid'],'MIME content','package-stable-id'),{sentCopy:true,warning:''});assert.equal(calls,1);
 await assert.rejects(()=>deliver({...account,relay:{url:'',token:''}},[],'MIME'),/noch nicht eingerichtet/);assert.equal(calls,1,'missing bridge never calls the network');
 globalThis.fetch=async(_url,options)=>{assert.equal(JSON.parse(options.body).action,'test');return Response.json({ok:true,smtp:true,imap:true});};assert.deepEqual(await testMailbox(account),{smtp:true,imap:true});
 globalThis.fetch=async()=>Response.json({ok:false,error:'smtp-secret imap-secret relay-secret',uncertain:false},{status:400});await assert.rejects(()=>deliver(account,[],'MIME'),e=>e.uncertain===false&&e.message==='[geschützt] [geschützt] [geschützt]');
 globalThis.fetch=async()=>Response.json({ok:true,accepted:true,sentCopy:false,warning:'imap-secret'});assert.equal((await deliver(account,[],'MIME')).warning,'[geschützt]');
 for(const reply of [()=>{throw Error('network');},()=>new Response('not JSON'),()=>Response.json(null),()=>Response.json({ok:true,accepted:false}),()=>Response.json({ok:false,accepted:true,error:'already accepted'},{status:502})]){globalThis.fetch=async()=>reply();await assert.rejects(()=>deliver(account,[],'MIME'),e=>e.uncertain===true);}
 globalThis.fetch=async()=>{throw Error('network');};await assert.rejects(()=>testMailbox(account),e=>e.uncertain===false);
 const cursor={uidValidity:'42',lastUid:5},batch={ok:true,inboxVersion:1,uidValidity:'42',lastUid:6,more:false,messages:[{uid:6,raw:'TUlNRQ=='}]};
 globalThis.fetch=async(url,options)=>{assert.equal(url,account.relay.url);assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Bearer '+account.relay.token);const body=JSON.parse(options.body);assert.equal(body.action,'inbox');assert.equal(body.folder,'INBOX');assert.equal(body.lastUid,5);assert.equal(body.limit,5);assert(!body.account.smtp,'inbox reads do not transmit SMTP credentials');return Response.json(batch);};assert.deepEqual(await readInbox(account,cursor),batch);
 for(const invalid of [null,{}, {...batch,messages:[{uid:6}]},{...batch,lastUid:4},{...batch,messages:[{uid:6,raw:'x'},{uid:6,raw:'x'}]},{...batch,messages:[{uid:7,raw:'x'}]},{...batch,more:'false'}]){globalThis.fetch=async()=>Response.json(invalid);await assert.rejects(()=>readInbox(account,cursor));}
 globalThis.fetch=async()=>Response.json({ok:false,error:'imap-secret relay-secret'},{status:400});await assert.rejects(()=>readInbox(account,cursor),e=>e.message.includes('[geschützt] [geschützt]')&&!e.message.includes('imap-secret'));
 console.log('PASS: actual HTTPS transport – request IDs, no redirects/retries, missing connection, SMTP/IMAP check, inbox UID validation and capability checks, accepted sends, uncertain replies and secret redaction.');
}finally{globalThis.fetch=originalFetch;}
