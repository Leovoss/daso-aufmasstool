'use client';
import {randomId} from '@/lib/ids';
import {useState} from 'react';
import {Plus,Trash2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {MAX_PROJECT_CONTACTS,projectContacts} from '@/lib/project-contacts';
import type {Project,ProjectContact} from '@/lib/types';

export function ProjectContactsEditor({contacts,disabled,onChange}:{contacts:ProjectContact[];disabled:boolean;onChange:(contacts:ProjectContact[])=>void}){
 const [focus,setFocus]=useState('');
 function edit(id:string,key:'name'|'role'|'phone'|'email',value:string){onChange(contacts.map(contact=>contact.id===id?{...contact,[key]:value}:contact));}
 return <section className="project-contacts-editor wide" aria-labelledby="additional-contacts-heading"><div className="section-title"><h3 id="additional-contacts-heading">Weitere Ansprechpartner</h3><Button type="button" variant="outline" disabled={disabled||contacts.length>=MAX_PROJECT_CONTACTS} aria-label="Ansprechpartner hinzufügen" onClick={()=>{const id=randomId();setFocus(id);onChange([...contacts,{id,name:'',role:'',phone:'',email:''}]);}}><Plus/>Hinzufügen</Button></div>{!contacts.length&&<p className="people-hint">Noch keine weiteren Ansprechpartner hinterlegt.</p>}<div className="project-contact-list">{contacts.map((contact,index)=><fieldset key={contact.id} className="project-contact-card" disabled={disabled}><legend>Ansprechpartner {index+1}</legend><Button type="button" className="contact-remove" variant="ghost" size="icon" disabled={disabled} aria-label={'Ansprechpartner entfernen: '+(contact.name||index+1)} onClick={()=>onChange(contacts.filter(row=>row.id!==contact.id))}><Trash2/></Button>{contact.legacyText&&<details className="legacy-contact-note"><summary>Bisherige Kontaktangaben</summary><p>{contact.legacyText}</p></details>}<div className="form-grid"><label className="field"><span>Name</span><Input autoFocus={focus===contact.id} maxLength={160} autoComplete="off" value={contact.name} onChange={event=>edit(contact.id,'name',event.target.value)} placeholder="Vor- und Nachname"/></label><label className="field"><span>Funktion</span><Input maxLength={160} autoComplete="off" value={contact.role} onChange={event=>edit(contact.id,'role',event.target.value)} placeholder="z. B. Bauleitung"/></label><label className="field"><span>Telefon</span><Input type="tel" maxLength={100} autoComplete="off" value={contact.phone} onChange={event=>edit(contact.id,'phone',event.target.value)} placeholder="Telefon- oder Mobilnummer"/></label><label className="field"><span>E-Mail</span><Input type="email" maxLength={320} autoComplete="off" value={contact.email} onChange={event=>edit(contact.id,'email',event.target.value)} placeholder="name@firma.de"/></label></div></fieldset>)}</div></section>;
}

export function ProjectContactsSummary({project}:{project:Project}){
 const contacts=projectContacts(project);
 return <div className="project-contacts-summary"><span>Weitere Ansprechpartner</span>{contacts.length?<ul>{contacts.map((contact,index)=><li key={contact.id}>{(contact.name||!contact.legacyText)&&<strong>{contact.name||'Ansprechpartner '+(index+1)}</strong>}{contact.role&&<p>{contact.role}</p>}{contact.phone&&<a href={'tel:'+contact.phone.replace(/[^\d+]/g,'')}>{contact.phone}</a>}{contact.email&&<a href={'mailto:'+encodeURIComponent(contact.email)}>{contact.email}</a>}{contact.legacyText&&<p className="legacy-contact-text">{contact.legacyText}</p>}</li>)}</ul>:<strong>—</strong>}</div>;
}
