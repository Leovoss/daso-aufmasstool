'use client';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter} from '@/components/ui/dialog';
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@/components/ui/table';
import {approvedLVDescriptionChanges} from '@/lib/approved-lv-descriptions';
import type {Position,Project} from '@/lib/types';

export function LVDescriptionCorrections({project,positions,busy,error,onClose,onApply}:{project:Project;positions:Position[];busy:boolean;error:string;onClose:()=>void;onApply:(changes:ReturnType<typeof approvedLVDescriptionChanges>)=>Promise<void>}){
 const changes=approvedLVDescriptionChanges(project.id,positions);
 return <Dialog open onOpenChange={open=>!open&&!busy&&onClose()}><DialogContent className="large-dialog"><DialogHeader><DialogTitle>LV-Bezeichnungen vervollständigen</DialogTitle><DialogDescription>{project.name} · {changes.length} eindeutig geprüfte Kurztexte. Unklare Verweise bleiben bestehen.</DialogDescription></DialogHeader><div className="dialog-scroll"><div className="info-note">Die vollständige Artikelbezeichnung ersetzt „wie vor, jedoch“. Positionsnummern, Maße, Preise, Mengen und gespeicherte Aufmaße bleiben erhalten.</div><Table className="mobile-records" aria-label="Geprüfte Änderungen der LV-Bezeichnungen"><TableHeader><TableRow><TableHead>Position</TableHead><TableHead>Bisher</TableHead><TableHead>Neue Bezeichnung</TableHead></TableRow></TableHeader><TableBody>{changes.map(change=><TableRow key={change.id}><TableCell data-label="Position" className="position-number">{change.number}</TableCell><TableCell data-label="Bisher">{change.before}</TableCell><TableCell data-label="Neue Bezeichnung"><strong>{change.after}</strong></TableCell></TableRow>)}</TableBody></Table></div>{error&&<div className="message error">{error}</div>}<DialogFooter><Button variant="outline" disabled={busy} onClick={onClose}>Schließen</Button><Button disabled={busy||!changes.length} onClick={()=>onApply(changes)}>{changes.length} Bezeichnungen übernehmen</Button></DialogFooter></DialogContent></Dialog>;
}
