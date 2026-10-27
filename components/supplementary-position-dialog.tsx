'use client';
import {useId,useRef,useState,type FormEvent} from 'react';
import {Check,Loader2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter} from '@/components/ui/dialog';
import {positionFormDetails,type PositionForm} from '@/lib/manual-positions';
import type {Position,Project} from '@/lib/types';

type Details=ReturnType<typeof positionFormDetails>;
export function SupplementaryPositionDialog({project,positions,busy,serverError,onClose,onSave}:{project:Project;positions:Position[];busy:boolean;serverError:string;onClose:()=>void;onSave:(details:Details)=>Promise<unknown>}){
 const [form,setForm]=useState<PositionForm>({number:'',description:'',unit:'',price:'',planned:'',longText:''}),[error,setError]=useState(''),[saving,setSaving]=useState(false),[submitted,setSubmitted]=useState(false),pending=useRef(false),id=useId(),blocked=busy||saving;
 const update=(key:keyof PositionForm,value:string)=>{setForm(prev=>({...prev,[key]:value}));setError('');setSubmitted(false);};
 async function submit(event:FormEvent){
  event.preventDefault();if(blocked||pending.current)return;setError('');
  let details:Details;try{details=positionFormDetails(form,positions);}catch(e){setError(e instanceof Error?e.message:'Bitte die Positionsdetails prüfen.');return;}
  pending.current=true;setSaving(true);setSubmitted(true);try{await onSave(details);}catch(e){setError(e instanceof Error?e.message:'Nachtragsposition konnte nicht gespeichert werden.');}finally{pending.current=false;setSaving(false);}
 }
 return <Dialog open onOpenChange={open=>!open&&!blocked&&onClose()}><DialogContent className="large-dialog supplementary-position-dialog" showCloseButton={!blocked}><DialogHeader><DialogTitle>Nachtragsposition hinzufügen</DialogTitle><DialogDescription>{project.name} · Die Position wird im Projekt-LV gespeichert und steht für weitere Aufmaße bereit.</DialogDescription></DialogHeader><form id={id} onSubmit={submit} className="dialog-scroll"><div className="form-grid">
  <label className="field"><span>Positionsnummer *</span><Input required disabled={blocked} maxLength={80} value={form.number} onChange={e=>update('number',e.target.value)} placeholder="z. B. N1.01"/></label>
  <label className="field"><span>Einheit *</span><Input required disabled={blocked} maxLength={30} value={form.unit} onChange={e=>update('unit',e.target.value)} placeholder="z. B. m, m², St oder h"/></label>
  <label className="field wide"><span>Bezeichnung / Kurztext *</span><Textarea required disabled={blocked} maxLength={3000} rows={3} value={form.description} onChange={e=>update('description',e.target.value)} placeholder="Leistung oder Artikel beschreiben"/></label>
  <label className="field"><span>Einheitspreis (EP) in € *</span><Input required disabled={blocked} inputMode="decimal" value={form.price} onChange={e=>update('price',e.target.value)} placeholder="z. B. 12,50"/><small>Netto, höchstens zwei Nachkommastellen.</small></label>
  <label className="field"><span>LV-Menge (optional)</span><Input disabled={blocked} inputMode="decimal" value={form.planned} onChange={e=>update('planned',e.target.value)} placeholder="z. B. 100"/><small>Die montierte Menge wird im Aufmaß erfasst.</small></label>
  <label className="field wide"><span>Langtext / Positionsdetails (optional)</span><Textarea disabled={blocked} maxLength={12000} rows={4} value={form.longText} onChange={e=>update('longText',e.target.value)} placeholder="Ausführung, Abmessungen und weitere Details"/></label>
 </div>{(error||submitted&&serverError)&&<div className="message error" role="alert">{error||serverError}</div>}</form><DialogFooter><Button type="button" variant="outline" disabled={blocked} onClick={onClose}>Abbrechen</Button><Button type="submit" form={id} disabled={blocked}>{blocked?<Loader2 className="spin"/>:<Check/>}Nachtragsposition speichern</Button></DialogFooter></DialogContent></Dialog>;
}
