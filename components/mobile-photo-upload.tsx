'use client';
import {useRef} from 'react';
import {Camera} from 'lucide-react';
import {Button} from '@/components/ui/button';

export function MobilePhotoUpload({disabled,onFiles}:{disabled:boolean;onFiles:(files:File[])=>void}){
 const input=useRef<HTMLInputElement|null>(null);
 return <span className="mobile-only"><Button type="button" variant="outline" disabled={disabled} onClick={()=>input.current?.click()}><Camera/>Foto aufnehmen</Button><input ref={input} type="file" accept="image/*" capture="environment" hidden disabled={disabled} aria-label="Baustellenfoto aufnehmen" onChange={event=>{const files=Array.from(event.target.files||[]);if(files.length)onFiles(files);event.target.value='';}}/></span>;
}
