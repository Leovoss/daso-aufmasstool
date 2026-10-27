import assert from 'node:assert/strict';
import {as,accessBindings} from './access.mjs';

export async function checkApprovedLVDescriptions({Miniflare,script,sql,headers,project}){
 const approved=await import('/tmp/aufmass-tests/modules/approved-lv-descriptions.js'),projectId=approved.LV_DESCRIPTION_PROJECT_ID,changes=approved.APPROVED_LV_DESCRIPTIONS;
 assert.equal(changes.length,43);assert.equal(new Set(changes.map(c=>c.id)).size,43);
 const mf=new Miniflare({modules:true,script,bindings:{DASO_OWNER_EMAIL:'test-user@example.invalid',...accessBindings},d1Databases:['DB'],r2Buckets:['BUCKET'],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat']});
 try{
  const db=await mf.getD1Database('DB');for(const statement of sql.split('--> statement-breakpoint'))await db.prepare(statement.trim()).run();
  const now='2026-10-16T13:00:00Z',positions=changes.map(c=>({id:c.id,projectId,number:c.number,description:c.before,price:1234,unit:'m',planned:123.456,longText:'Unveränderter Langtext'}));
  positions.push({id:'uncertain',projectId,number:'1.04.010.10',description:'wie vor jedoch: NW 80 l: 0,5m',price:8900,unit:'Stck',planned:2,longText:''},{id:'already-full',projectId,number:'1.03.040.148',description:'Enddeckel: NW 80',price:100,unit:'Stck',planned:6,longText:''});
  const oldReport={id:'old-report',projectId,date:'2026-10-15',endDate:'2026-10-15',team:'T1',lines:[{id:'old-line',positionId:positions[0].id,number:positions[0].number,description:positions[0].description,price:1234,employeePrice:1111,employeeFactor:.9,quantity:3,unit:'m',remark:''}],state:'ready'};
  const records=[{kind:'project',value:{...project,id:projectId,name:'Uniq Towers',updatedAt:now}},{kind:'project',value:{...project,id:'other-project',name:'Anderes Projekt',updatedAt:now}},...positions.map(value=>({kind:'position',value})),{kind:'report',value:oldReport},{kind:'closure',value:{id:'old-closure',projectId,rows:[],employeeValue:0,customerValue:0}},{kind:'payment',value:{id:'old-payment',projectId,amount:100}}];
  for(const id of [projectId,'other-project'])await db.prepare('INSERT INTO project_revisions VALUES (?,0,?)').bind(id,'initial-'+id).run();
  for(const record of records)await db.prepare('INSERT INTO records VALUES (?,?,?,?,?)').bind(record.value.id,record.kind,record.value.projectId||record.value.id,JSON.stringify(record.value),now).run();
  const original=await db.prepare('SELECT id,data FROM records ORDER BY id').all(),read=async()=>{const response=await mf.dispatchFetch('http://test/api/data?project='+projectId,{headers});assert.equal(response.status,200);return response.json();};
  const post=async(value,expected=200,requestHeaders=headers)=>{const response=await mf.dispatchFetch('http://test/api/data',{method:'POST',headers:requestHeaders,body:JSON.stringify({action:'completeLVDescriptions',projectId,changes,...value})});const body=await response.json();assert.equal(response.status,expected,JSON.stringify(body));return body;};
  assert.equal(approved.approvedLVDescriptionChanges(projectId,positions).length,43);assert.equal(approved.approvedLVDescriptionChanges('other-project',positions).length,0);
  const imported=positions.map(p=>({...p,id:'new-import-'+p.id}));assert.equal(approved.approvedLVDescriptionChanges(projectId,imported).length,0,'a later LV import must not receive an old correction by position number alone');
  await post({changes:changes.map((c,i)=>i?c:{...c,after:'Manipulierter Text'})},400);await post({projectId:'other-project'},400);await post({},400,{'Content-Type':'application/json',...await as('outsider@example.invalid')});
  const stale=[...positions];stale[0]={...stale[0],description:'Bereits manuell geändert'};assert.equal(approved.approvedLVDescriptionChanges(projectId,stale).length,42);await db.prepare('UPDATE records SET data = ? WHERE id = ?').bind(JSON.stringify(stale[0]),stale[0].id).run();await post({},400);await db.prepare('UPDATE records SET data = ? WHERE id = ?').bind(JSON.stringify(positions[0]),positions[0].id).run();
  assert.deepEqual((await db.prepare('SELECT id,data FROM records ORDER BY id').all()).results,original.results,'rejected and stale requests are atomic');
  await post({});const data=await read();assert.equal(data.positions.length,positions.length);
  for(const before of positions){const after=data.positions.find(p=>p.id===before.id),change=changes.find(c=>c.id===before.id);assert.deepEqual(after,{...before,description:change?.after||before.description});}
  assert.equal(data.positions.find(p=>p.number==='1.03.020.20').description,'Wickelfalzrohr NW 100');assert.equal(data.positions.find(p=>p.number==='1.03.030.20').description,'Flexibles Aluminiumrohr NW 150');assert.equal(data.positions.find(p=>p.number==='1.03.040.53').description,'Wickelfalz-Bogen mit Dichtungen NW 315');assert.equal(data.positions.find(p=>p.id==='uncertain').description,positions.find(p=>p.id==='uncertain').description);
  for(const record of original.results)if(!positions.some(p=>p.id===record.id))assert.equal((await db.prepare('SELECT data FROM records WHERE id = ?').bind(record.id).first()).data,record.data,'reports, closures, payments and project records keep their exact stored bytes');
  const history=await db.prepare("SELECT data FROM records WHERE kind = 'lvtextrevision'").all();assert.equal(history.results.length,1);assert.deepEqual(JSON.parse(history.results[0].data).changes,changes);assert(data.audit.some(entry=>entry.action==='completeLVDescriptions'&&entry.detail.includes('43')));await post({},400);assert.equal(approved.approvedLVDescriptionChanges(projectId,data.positions).length,0);
  console.log('PASS: 43 reviewed Uniq LV descriptions, exact project/ID/old-text guards, rejected/stale writes, unchanged dimensions/prices/units/quantities/history, immutable report bytes and retained original-text revision');
 }finally{await mf.dispose();}
}
