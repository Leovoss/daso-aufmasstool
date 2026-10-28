'use client';
import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {dateLabel,qty2} from '@/lib/business';
import type {PortalLink} from '@/lib/portal';
import type {MailPackage} from '@/lib/types';
type Props={pack:MailPackage;portals:PortalLink[];busy:boolean;perform:(action:string,payload?:Record<string,unknown>)=>Promise<unknown>;refresh:()=>Promise<void>};
const labels:Record<PortalLink['status'],string>={open:'Offen',submitted:'Rückmeldung eingegangen',applied:'Übernommen',rejected:'Abgelehnt',revoked:'Ersetzt',};
const signed=(value:number)=>(value>0?'+':value<0?'-':'')+qty2(Math.abs(value));
export function CustomerLink(props:Props){
 const [open,setOpen]=useState(false),links=props.portals.filter(p=>p.packageId===props.pack.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),waiting=links.filter(l=>l.status==='submitted').length;
 return <div className="package-return-action">
  <Button variant="outline" size="sm" disabled={props.busy||!props.pack.sentAt} onClick={()=>setOpen(true)}>Kundenlink{waiting?` (${waiting} neu)`:''}</Button>
  {props.pack.sentAt&&<small>{waiting?'Kundenkorrektur wartet auf Freigabe':links.some(l=>l.status==='open')?'Link offen':links.some(l=>l.status==='applied')?'Kundenkorrektur übernommen':'Kein Link'}</small>}
  {open&&<LinkDialog {...props} links={links} onClose={()=>setOpen(false)}/>}
 </div>;
}
function LinkDialog({pack,links,busy,perform,refresh,onClose}:Props&{links:PortalLink[];onClose:()=>void}){
 const [url,setUrl]=useState(''),[until,setUntil]=useState(''),[error,setError]=useState(''),[copied,setCopied]=useState(false),[notes,setNotes]=useState<Record<string,string>>({});
 async function create(){setError('');setCopied(false);try{const result=await perform('createPortalLink',{id:pack.id}) as {url?:string;until?:string}|undefined;if(!result?.url)throw Error('Link wurde nicht erstellt.');setUrl(result.url);setUntil(result.until||'');await refresh();}catch(e){setError(e instanceof Error?e.message:'Link konnte nicht erstellt werden.');}}
 async function decide(link:PortalLink,decision:'apply'|'reject'){setError('');try{const result=await perform('decidePortal',{id:link.id,decision,note:notes[link.id]||''});if(!result)throw Error('Entscheidung nicht gespeichert. Bitte die Meldung im Versand beachten.');await refresh();}catch(e){setError(e instanceof Error?e.message:'Entscheidung fehlgeschlagen.');}}
 return <Dialog open onOpenChange={v=>!v&&!busy&&onClose()}><DialogContent className="large-dialog"><DialogHeader><DialogTitle>Kundenlink zum Versand</DialogTitle><DialogDescription>{pack.to} · Der Kunde prüft die Mengen online und gibt Korrekturen ein. Die Übernahme erfolgt erst nach Ihrer Freigabe.</DialogDescription></DialogHeader>
  <div className="dialog-scroll stack">
   <div className="actions"><Button disabled={busy} onClick={()=>void create()}>{links.length?'Neuen Link erzeugen':'Link erzeugen'}</Button><small>Ein neuer Link ersetzt den bisher offenen Link.</small></div>
   {url&&<div className="info-note"><strong>Neuer Link (nur jetzt sichtbar, gültig bis {until}):</strong><br/><code style={{overflowWrap:'anywhere'}}>{url}</code><div className="actions"><Button size="sm" variant="outline" onClick={async()=>{try{await navigator.clipboard.writeText(url);setCopied(true);}catch{setError('Kopieren nicht möglich. Bitte den Link markieren und manuell kopieren.');}}}>{copied?'Kopiert':'Link kopieren'}</Button></div></div>}
   {error&&<p role="alert" className="error">{error}</p>}
   {!links.length&&<p>Zu diesem Versand gibt es noch keinen Kundenlink. Beim Senden aus dem Tool wird automatisch einer in die E-Mail eingefügt.</p>}
   {links.map(link=>{const changes=link.submission?.corrections||[],changed=new Map(changes.map(c=>[c.reportId+'|'+c.lineId,c.quantity])),rows=link.rows;
    return <article className="crew-group" key={link.id}>
     <div className="section-title"><div><h3>{labels[link.status]} · erstellt {dateLabel(link.createdAt)} · gültig bis {dateLabel(link.expiresAt)}</h3>
      {link.submission&&<p>{link.submission.name} · {new Date(link.submission.at).toLocaleString('de-DE')} · {changes.length?`${changes.length} Position(en) korrigiert`:'Mengen bestätigt'}{link.submission.note?' · '+link.submission.note:''}</p>}
      {link.decision&&<p>Entscheidung {link.decision.user} · {dateLabel(link.decision.at)}{link.decision.note?' · '+link.decision.note:''}</p>}</div>
      {link.submission&&<a className="text-link" href={'/api/files?id='+encodeURIComponent(link.submission.fileId)+'&inline=1'} target="_blank" rel="noreferrer">Bestätigungs-PDF</a>}</div>
     {link.submission&&<table className="portal-compare"><thead><tr><th>Position</th><th>Bezeichnung</th><th>Aufmaß</th><th>Kundenmenge</th><th>Differenz</th></tr></thead><tbody>
      {rows.map(row=>{const next=changed.get(row.reportId+'|'+row.lineId);return <tr key={row.reportId+row.lineId} style={next!==undefined?{background:'#fff4f4',color:'#a82a1d',fontWeight:700}:undefined}><td>{row.number}</td><td>{row.description}</td><td>{qty2(row.quantity)} {row.unit}</td><td>{next===undefined?'-':qty2(next)+' '+row.unit}</td><td>{next===undefined?'':signed(next-row.quantity)}</td></tr>;})}
     </tbody></table>}
     {link.status==='submitted'&&<div className="reopen-row"><Input aria-label="Notiz zur Entscheidung" placeholder="Notiz (bei Ablehnung Pflicht)" value={notes[link.id]||''} onChange={e=>setNotes(x=>({...x,[link.id]:e.target.value}))}/><Button disabled={busy} onClick={()=>void decide(link,'apply')}>{changes.length?'Korrektur übernehmen':'Mengen bestätigen'}</Button><Button variant="outline" disabled={busy||!(notes[link.id]||'').trim()} onClick={()=>void decide(link,'reject')}>Ablehnen</Button></div>}
    </article>;})}
  </div></DialogContent></Dialog>;
}
