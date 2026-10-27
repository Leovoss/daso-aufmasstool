'use client';
import {useRef,useState} from 'react';
import {RotateCcw,RotateCw,Loader2,Check} from 'lucide-react';
import {Button} from './ui/button';
import {Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle} from './ui/dialog';
import {orientableAttachment,prepareAttachment,type OrientationReview} from '@/lib/attachment-upload';

export function useAttachmentOrientation(){
 const [status,setStatus]=useState<{name:string;text:string;review?:OrientationReview}|null>(null),[rotation,setRotation]=useState(0);
 const active=useRef<AbortController|null>(null),pending=useRef<{resolve:(angle:number)=>void;reject:(error:Error)=>void}|null>(null);
 function cancel(){active.current?.abort();pending.current?.reject(Error('Ausrichten abgebrochen. Die Anlage wurde nicht hochgeladen.'));pending.current=null;setStatus(null);}
 async function prepare(file:File){
  if(!orientableAttachment(file))return{file,normalized:false};
  const controller=new AbortController();active.current=controller;setStatus({name:file.name,text:'Anlage wird ausgerichtet …'});
  try{return await prepareAttachment(file,{signal:controller.signal,progress:text=>setStatus({name:file.name,text}),review:page=>new Promise<number>((resolve,reject)=>{pending.current={resolve,reject};setRotation(0);setStatus({name:file.name,text:'Textrichtung bitte bestätigen.',review:page});})});}
  finally{if(active.current===controller){active.current=null;pending.current=null;setStatus(null);}}
 }
 const dialog=<Dialog open={!!status} onOpenChange={open=>{if(!open)cancel();}}><DialogContent className="large-dialog orientation-dialog"><DialogHeader><DialogTitle>Anlage ausrichten</DialogTitle><DialogDescription>{status?.name}</DialogDescription></DialogHeader><div className="dialog-scroll stack">{status?.review?<><p>Seite {status.review.page} von {status.review.pages}: Die Textrichtung ist nicht eindeutig. Drehe die Seite so, dass der Text normal lesbar ist.</p><div className="orientation-preview"><img src={status.review.preview} alt="Seitenvorschau zur Prüfung der Textrichtung" style={{transform:`rotate(${rotation}deg)`}}/></div><div className="actions"><Button variant="outline" onClick={()=>setRotation(value=>(value+270)%360)}><RotateCcw/>90° links</Button><Button variant="outline" onClick={()=>setRotation(value=>(value+90)%360)}><RotateCw/>90° rechts</Button></div></>:<p className="actions" role="status"><Loader2 className="spin"/>{status?.text}</p>}</div><DialogFooter><Button variant="outline" onClick={cancel}>Abbrechen</Button>{status?.review&&<Button onClick={()=>{const next=pending.current;pending.current=null;setStatus(value=>value?{name:value.name,text:'Ausrichtung wird übernommen …'}:null);next?.resolve(rotation);}}><Check/>Text ist richtig herum</Button>}</DialogFooter></DialogContent></Dialog>;
 return{prepare,dialog};
}
