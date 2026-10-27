import type {Project,ProjectContact} from './types';

export const MAX_PROJECT_CONTACTS=50;
const validEmail=(value:string)=>/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);

export function projectContacts(project:Pick<Project,'contacts'|'contactPersons'>):ProjectContact[]{
 if(Array.isArray(project.contactPersons))return project.contactPersons;
 const original=project.contacts||'';
 if(!original.trim())return [];
 const rows=original.trim().split(/\r?\n/).filter(line=>line.trim()),parts=rows.map(line=>line.split('·').map(value=>value.trim()));
 if(parts.length<=MAX_PROJECT_CONTACTS&&parts.every(fields=>fields.length===4&&(!fields[3]||validEmail(fields[3]))))return parts.map(([name,role,phone,email],index)=>({id:'legacy-contact-'+(index+1),name,role,phone,email}));
 // Unstructured older notes stay intact until the user edits or removes them.
 return [{id:'legacy-contact-notes',name:'',role:'',phone:'',email:'',legacyText:original}];
}

export function contactText(contacts:ProjectContact[]):string{return contacts.map(contact=>{const fields=[contact.name,contact.role,contact.phone,contact.email];return[fields.some(Boolean)?fields.join(' · '):'',contact.legacyText||''].filter(Boolean).join('\n');}).join('\n');}

export function validateProjectContacts(value:unknown):ProjectContact[]|undefined{
 if(value===undefined)return undefined;
 if(!Array.isArray(value)||value.length>MAX_PROJECT_CONTACTS)throw Error(`Bitte höchstens ${MAX_PROJECT_CONTACTS} weitere Ansprechpartner hinterlegen.`);
 const ids=new Set<string>();
 const field=(raw:unknown,max:number,label:string,multiline=false)=>{if(raw===undefined)return '';if(typeof raw!=='string'||raw.length>max||!multiline&&/[\r\n]/.test(raw))throw Error(`Bitte ${label} beim Ansprechpartner prüfen (höchstens ${max} Zeichen).`);return multiline?raw:raw.trim();};
 return value.map(raw=>{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Ungültiger Ansprechpartner.');
  const row=raw as Record<string,unknown>,id=field(row.id,100,'die Kennung');
  if(!id||!/^[a-zA-Z0-9_-]+$/.test(id)||ids.has(id))throw Error('Ein Ansprechpartner wurde doppelt oder ohne gültige Kennung eingetragen.');ids.add(id);
  const name=field(row.name,160,'den Namen'),role=field(row.role,160,'die Funktion'),phone=field(row.phone,100,'die Telefonnummer'),email=field(row.email,320,'die E-Mail-Adresse'),legacyText=field(row.legacyText,5000,'die bisherigen Angaben',true);
  if(email&&!validEmail(email))throw Error('Bitte eine gültige E-Mail-Adresse beim Ansprechpartner eintragen.');
  return{id,name,role,phone,email,...(legacyText?{legacyText}:{})};
 }).filter(contact=>contact.name||contact.role||contact.phone||contact.email||contact.legacyText?.trim());
}
