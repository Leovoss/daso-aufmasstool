'use client';
import {useEffect,useMemo,useState} from 'react';
import {dateLabel,parseDecimal,qty2} from '@/lib/business';
import type {PortalRow} from '@/lib/portal';
import '../portal.css';
type View={project:{name:string;number:string;customer:string};weeks:string[];status:'open'|'submitted'|'applied'|'rejected'|'revoked'|'expired';expiresAt:string;reports:{id:string;date:string;label:string}[];rows:PortalRow[];submission?:{at:string;name:string;note:string;corrections:{reportId:string;lineId:string;quantity:number}[]}};
const key=(r:{reportId:string;lineId:string})=>r.reportId+'|'+r.lineId;
const signed=(value:number)=>(value>0?'+':value<0?'-':'')+qty2(Math.abs(value));
export default function Portal(){
 const [token,setToken]=useState(''),[view,setView]=useState<View|null>(null),[error,setError]=useState(''),[input,setInput]=useState<Record<string,string>>({}),[name,setName]=useState(''),[note,setNote]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[done,setDone]=useState<number|null>(null);
 useEffect(()=>{const t=location.pathname.split('/')[2]||'';setToken(t);fetch('/api/portal?t='+encodeURIComponent(t)).then(async r=>{const j=await r.json() as View&{error?:string};if(!r.ok)throw Error(j.error);setView(j);}).catch(e=>setError(e.message||'Der Link konnte nicht geladen werden.'));},[]);
 const parsed=useMemo(()=>{const map:Record<string,number|null>={};for(const row of view?.rows||[]){const raw=input[key(row)];map[key(row)]=raw===undefined||raw.trim()===''?row.quantity:(()=>{const n=parseDecimal(raw);return Number.isFinite(n)&&n>=0&&n<=1e8?n:null;})();}return map;},[input,view]);
 const changes=(view?.rows||[]).filter(r=>parsed[key(r)]!==null&&parsed[key(r)]!==r.quantity),invalid=(view?.rows||[]).some(r=>parsed[key(r)]===null);
 async function submit(){
  setBusy(true);setError('');
  try{const r=await fetch('/api/portal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:token,name,note,confirmed,corrections:changes.map(c=>({reportId:c.reportId,lineId:c.lineId,quantity:parsed[key(c)]}))})}),j=await r.json() as {error?:string;corrections:number};if(!r.ok)throw Error(j.error);setDone(j.corrections);}
  catch(e){setError(e instanceof Error?e.message:'Senden fehlgeschlagen.');}finally{setBusy(false);}
 }
 if(!view)return <main className="portal"><section className="portal-card">{error?<p role="alert" className="portal-error">{error}</p>:<p>Wird geladen ...</p>}</section></main>;
 const finished=done!==null||view.status!=='open',count=done??view.submission?.corrections.length??0;
 return <main className="portal">
  <header><img src="/daso-logo.png" alt="DaSo Lüftungsbau" width={110}/></header>
  <section className="portal-card">
   <h1>Aufmaß prüfen</h1>
   <p className="portal-meta"><strong>{view.project.name}</strong> · {view.project.number}{view.project.customer?' · '+view.project.customer:''}<br/>{view.weeks.join(', ')}</p>
   {view.status==='expired'&&<p role="alert" className="portal-error">Dieser Link ist abgelaufen. Bitte wenden Sie sich an DaSo Lüftungsbau.</p>}
   {view.status==='revoked'&&<p role="alert" className="portal-error">Dieser Link wurde durch einen neueren ersetzt.</p>}
   {finished&&view.status!=='expired'&&view.status!=='revoked'&&<div className="portal-done" role="status"><strong>Vielen Dank, Ihre Rückmeldung ist bei uns eingegangen.</strong>
    <p>{count>0?`${count} Position(en) wurden korrigiert und werden von uns geprüft.`:'Alle Mengen wurden von Ihnen bestätigt.'}</p>
    <a className="portal-button" href={'/api/portal?pdf=1&t='+encodeURIComponent(token)}>Bestätigung als PDF herunterladen</a></div>}
   {!finished&&<>
    <p>Bitte prüfen Sie die Mengen. Wenn eine Menge nicht stimmt, tragen Sie rechts die richtige Menge ein. Geänderte Zeilen werden rot markiert und mit der Differenz angezeigt.</p>
    {view.reports.map(report=>{const rows=view.rows.filter(r=>r.reportId===report.id);return <div key={report.id} className="portal-report">
     <h2>Aufmaß {report.label}</h2>
     <div className="portal-table" role="table">
      <div className="portal-head" role="row"><span>Position</span><span>Bezeichnung</span><span className="num">Aufmaß</span><span className="num">Ihre Menge</span></div>
      {rows.map(row=>{const value=parsed[key(row)],changed=value!==null&&value!==row.quantity;return <div key={key(row)} role="row" className={'portal-row'+(changed?' changed':'')}>
       <strong>{row.number}</strong><span>{row.description}</span>
       <span className="num" data-label="Aufmaß">{changed?<s>{qty2(row.quantity)}</s>:qty2(row.quantity)} {row.unit}</span>
       <span className="num" data-label="Ihre Menge"><input aria-label={'Menge Position '+row.number} inputMode="decimal" value={input[key(row)]??qty2(row.quantity)} onFocus={e=>e.target.select()} aria-invalid={value===null} onChange={e=>setInput(x=>({...x,[key(row)]:e.target.value}))}/>
        {changed&&<span className="portal-diff">Korrektur: {qty2(value!)} {row.unit} ({signed(value!-row.quantity)})</span>}
        {value===null&&<span className="portal-diff">Ungültige Menge</span>}</span>
      </div>;})}
     </div></div>;})}
    <label className="portal-field">Ihr Name *<input value={name} maxLength={120} autoComplete="name" onChange={e=>setName(e.target.value)}/></label>
    <label className="portal-field">Anmerkung{changes.length?' (Begründung der Korrektur) *':' (optional)'}<textarea value={note} maxLength={2000} rows={3} onChange={e=>setNote(e.target.value)}/></label>
    <label className="portal-check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> Ich habe alle Mengen geprüft{changes.length?` und ${changes.length} Korrektur(en) eingetragen`:''}.</label>
    {error&&<p role="alert" className="portal-error">{error}</p>}
    <button className="portal-button" disabled={busy||invalid||!name.trim()||!confirmed||(changes.length>0&&!note.trim())} onClick={submit}>{busy?'Wird gesendet ...':changes.length?'Korrektur absenden':'Mengen bestätigen'}</button>
    <p className="portal-meta">Gültig bis {dateLabel(view.expiresAt)}. Die Rückmeldung kann nur einmal abgegeben werden.</p>
   </>}
  </section>
 </main>;
}
