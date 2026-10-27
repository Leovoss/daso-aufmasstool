import {randomId} from './ids';
import {isTimeReport,timeLines} from './time-reports';
import {lineAdjustment} from './line-adjustments';
import type {Report} from './types';

export type DraftInputs={search:string;selected:string;amount:string;remark:string;priceAdjustment?:number;timeDay?:string};
export type BrowserDraft={key:string;projectId:string;report:Report;inputs:DraftInputs;files:File[];missingFiles?:string[];updatedAt:string};
type StoredDraft=Omit<BrowserDraft,'files'>&{fileIds:string[];fileNames:string[]};
const prefix='daso-report-draft-v1:',fileIds=new WeakMap<File,string>(),writtenFiles=new Set<string>();
let database:Promise<IDBDatabase>|undefined;
function openDB(){if(database)return database;const pending=new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('daso-report-drafts',1);request.onupgradeneeded=()=>{request.result.createObjectStore('drafts',{keyPath:'key'});request.result.createObjectStore('files');};request.onsuccess=()=>{request.result.onversionchange=()=>{request.result.close();database=undefined;};resolve(request.result);};request.onerror=()=>reject(Error('Entwurfsspeicher konnte nicht geöffnet werden.'));});database=pending;void pending.catch(()=>{if(database===pending)database=undefined;});return pending;}
function completed(tx:IDBTransaction){return new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(Error('Entwurf konnte auf diesem Gerät nicht gesichert werden.'));tx.onabort=()=>reject(Error('Entwurfssicherung wurde abgebrochen.'));});}
function requestValue<T>(request:IDBRequest<T>){return new Promise<T>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
function stored(draft:BrowserDraft):StoredDraft{return{...draft,files:undefined,fileIds:draft.files.map(file=>{let id=fileIds.get(file);if(!id){id=randomId();fileIds.set(file,id);}return id;}),fileNames:draft.files.map(file=>file.name)} as unknown as StoredDraft;}
export function backupDraftText(draft:BrowserDraft){localStorage.setItem(prefix+draft.key,JSON.stringify(stored(draft)));}
export async function writeBrowserDraft(draft:BrowserDraft){
 const value=stored(draft);let textSaved=false;try{backupDraftText(draft);textSaved=true;}catch{}
 try{const db=await openDB(),tx=db.transaction(['drafts','files'],'readwrite'),done=completed(tx),newIds:string[]=[];const prior=tx.objectStore('drafts').get(value.key);prior.onsuccess=()=>{for(const id of (prior.result as StoredDraft|undefined)?.fileIds||[])if(!value.fileIds.includes(id)){tx.objectStore('files').delete(id);writtenFiles.delete(id);}};tx.objectStore('drafts').put(value);draft.files.forEach((file,index)=>{const id=value.fileIds[index],files=tx.objectStore('files'),existing=files.getKey(id);existing.onsuccess=()=>{if(existing.result===undefined){files.put(file,id);newIds.push(id);}};});await done;newIds.forEach(id=>writtenFiles.add(id));}
 catch(error){if(!textSaved||draft.files.length)throw error;}
}
export async function readBrowserDrafts(projectId:string):Promise<BrowserDraft[]>{
 const values=new Map<string,StoredDraft>();try{for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(!key?.startsWith(prefix))continue;try{const value=JSON.parse(localStorage.getItem(key)||'null') as StoredDraft;if(value?.projectId===projectId&&value.report&&value.key)values.set(value.key,value);}catch{}}}catch{}
 let db:IDBDatabase|undefined;try{db=await openDB();const saved=await requestValue(db.transaction('drafts').objectStore('drafts').getAll()) as StoredDraft[];for(const value of saved)if(value.projectId===projectId&&(!values.has(value.key)||values.get(value.key)!.updatedAt<value.updatedAt))values.set(value.key,value);}catch{}
 const drafts:BrowserDraft[]=[];for(const value of values.values()){const files:File[]=[],missingFiles:string[]=[];if(db)for(const id of value.fileIds||[]){const file=await requestValue(db.transaction('files').objectStore('files').get(id)).catch(()=>null) as File|null;if(file){files.push(file);fileIds.set(file,id);writtenFiles.add(id);}else missingFiles.push(value.fileNames?.[value.fileIds.indexOf(id)]||'Anlage');}if(!db)missingFiles.push(...(value.fileNames||[]));drafts.push({...value,missingFiles,inputs:value.inputs||{search:'',selected:'',amount:'',remark:''},files});}
 return drafts.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
}
export async function removeBrowserDraft(key:string){try{localStorage.removeItem(prefix+key);}catch{}const db=await openDB(),tx=db.transaction(['drafts','files'],'readwrite'),done=completed(tx),store=tx.objectStore('drafts'),request=store.get(key);request.onsuccess=()=>{const value=request.result as StoredDraft|undefined;for(const id of value?.fileIds||[]){tx.objectStore('files').delete(id);writtenFiles.delete(id);}store.delete(key);};await done;}
// A response to an automatic save must not overwrite typing that happened while it was in flight.
export function mergeSavedReport(current:Report,submitted:Report,saved:Report,forcePreserve=false):Report{
 if(!forcePreserve&&JSON.stringify(current)===JSON.stringify(submitted))return saved;
 const lines=current.lines.map(line=>{const index=submitted.lines.findIndex(l=>l.id===line.id),canonical=saved.lines[index];return index>=0&&canonical&&canonical.positionId===line.positionId?lineAdjustment({...canonical,quantity:line.quantity},line.remark,line.priceAdjustment):line;});
 const timeSheet=current.timeSheet?{...current.timeSheet,factor:saved.timeSheet?.factor??current.timeSheet.factor,entries:current.timeSheet.entries.map(entry=>{const original=submitted.timeSheet?.entries.find(e=>e.id===entry.id),canonical=saved.timeSheet?.entries.find(e=>e.workerId===original?.workerId&&e.date===original?.date);return canonical?{...entry,id:canonical.id,name:canonical.name,code:canonical.code,...(entry.role===canonical.role?{rates:canonical.rates}:{})}:entry;})}:undefined;
 const merged={...current,...(saved.parentReportId?{parentReportId:saved.parentReportId}:{}),id:saved.id,createdAt:saved.createdAt,updatedAt:saved.updatedAt,lines,...(timeSheet?{timeSheet}:{}),employeeMembers:current.employeeMembers?.map(member=>{const canonical=saved.employeeMembers?.find(m=>m.employeeId===member.employeeId);return canonical||member;})};if(isTimeReport(merged))merged.lines=timeLines(merged);return merged;
}
