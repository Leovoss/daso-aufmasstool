'use client';
import {useState} from 'react';
import {Button} from '@/components/ui/button';
import type {Project} from '@/lib/types';
type Props={project:Project;deletable:boolean;busy:boolean;perform:(action:string,payload?:Record<string,unknown>)=>Promise<unknown>};
// Archiving hides a project but keeps everything. Deleting is a second step on archived projects without Aufmaße.
export function ProjectAdmin({project,deletable,busy,perform}:Props){
 const [confirm,setConfirm]=useState(false);
 return <div className="actions project-admin">
  {!project.archivedAt&&<Button variant="outline" disabled={busy} onClick={()=>void perform('archiveProject',{archived:true})}>Archivieren</Button>}
  {project.archivedAt&&<Button variant="outline" disabled={busy} onClick={()=>void perform('archiveProject',{archived:false})}>Wiederherstellen</Button>}
  {project.archivedAt&&deletable&&(confirm
   ?<><Button variant="outline" disabled={busy} onClick={()=>void perform('deleteProject')}>Endgültig löschen</Button><Button variant="ghost" onClick={()=>setConfirm(false)}>Abbrechen</Button></>
   :<Button variant="ghost" disabled={busy} onClick={()=>setConfirm(true)}>Löschen</Button>)}
 </div>;
}
