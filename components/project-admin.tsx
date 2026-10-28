'use client';
import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {money} from '@/lib/business';
import type {Project} from '@/lib/types';
type Impact={reports:number;packages:number;sentPackages:number;closures:number;invoices:{week:string;number:string;amount:number|null}[];payments:number;paidAmount:number;files:number};
type Props={project:Project;busy:boolean;perform:(action:string,payload?:Record<string,unknown>)=>Promise<unknown>};
// Archiving hides a project but keeps everything. Deleting is a second step on archived projects; the server
// reports what it would remove and asks for the project number when invoices, payments or sent packages exist.
export function ProjectAdmin({project,busy,perform}:Props){
 const [check,setCheck]=useState<{impact:Impact;sensitive:boolean}|null>(null),[typed,setTyped]=useState(''),[error,setError]=useState('');
 async function inspect(){
  setError('');
  try{const r=await fetch('/api/data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'projectImpact',projectId:project.id})}),j=await r.json() as {impact?:Impact;sensitive?:boolean;error?:string};if(!r.ok||!j.impact)throw Error(j.error||'Prüfung fehlgeschlagen.');setCheck({impact:j.impact,sensitive:!!j.sensitive});}
  catch(e){setError(e instanceof Error?e.message:'Prüfung fehlgeschlagen.');}
 }
 const impact=check?.impact;
 return <div className="project-admin">
  <div className="actions">
   {!project.archivedAt&&<Button variant="outline" disabled={busy} onClick={()=>void perform('archiveProject',{archived:true})}>Archivieren</Button>}
   {project.archivedAt&&<Button variant="outline" disabled={busy} onClick={()=>void perform('archiveProject',{archived:false})}>Wiederherstellen</Button>}
   {project.archivedAt&&!check&&<Button variant="ghost" disabled={busy} onClick={()=>void inspect()}>Löschen</Button>}
  </div>
  {error&&<p role="alert" className="error">{error}</p>}
  {impact&&check&&<div className={'message '+(check.sensitive?'error':'info-note')} role="alert">
   <strong>{check.sensitive?'Achtung: Dieses Projekt enthält Rechnungs- oder Versanddaten.':'Dieses Projekt wird gelöscht.'}</strong>
   <p>Entfernt werden: {impact.reports} Aufmaße, {impact.packages} Versandpakete ({impact.sentPackages} davon versandt), {impact.files} Dateien, {impact.closures} abgeschlossene Wochen.</p>
   {impact.invoices.length>0&&<p>Rechnungen betroffen: {impact.invoices.map(i=>`${i.number||'ohne Nummer'} (${i.week}${i.amount!==null?', '+money(i.amount):''})`).join('; ')}.</p>}
   {impact.payments>0&&<p>Zahlungen betroffen: {impact.payments} im Gesamtwert von {money(impact.paidAmount)}.</p>}
   {check.sensitive&&<><p>Das lässt sich nicht rückgängig machen. Zur Bestätigung bitte die Projektnummer <strong>{project.number}</strong> eintragen.</p><Input aria-label="Projektnummer zur Bestätigung" value={typed} onChange={e=>setTyped(e.target.value)} placeholder={project.number}/></>}
   <div className="actions">
    <Button variant="outline" disabled={busy||(check.sensitive&&typed.trim()!==project.number)} onClick={()=>void perform('deleteProject',{confirmNumber:typed.trim()})}>Endgültig löschen</Button>
    <Button variant="ghost" onClick={()=>{setCheck(null);setTyped('');}}>Abbrechen</Button>
   </div>
  </div>}
 </div>;
}
