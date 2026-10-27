import {assignEmployeeCodes,TRIAL_EMPLOYEE_ID,findEmployee} from './employees';
import type {ProjectEmployee,Project,EmployeeDirectory} from './types';

export const EMPLOYEE_DIRECTORY_ID='daso:employee-directory';
const nameKey=(e:ProjectEmployee)=>[e.firstName,e.lastName].map(s=>s.trim().normalize('NFKC').toLocaleLowerCase('de-DE').replace(/\s+/g,' ')).join('|');

// The same full name entered once in several projects becomes one choice.
// Equal names already entered twice in one project retain distinct identities.
export function mergeProjectEmployees(projects:Pick<Project,'id'|'employees'|'updatedAt'>[]):ProjectEmployee[]{
 const ambiguous=new Set<string>(),byId=new Map<string,ProjectEmployee>();
 for(const p of projects){const seen=new Set<string>();for(const e of p.employees||[]){const key=nameKey(e);if(seen.has(key))ambiguous.add(key);seen.add(key);}}
 for(const p of [...projects].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.id.localeCompare(b.id)))for(const e of p.employees||[]){
  if(!e.id||e.id===TRIAL_EMPLOYEE_ID||!e.firstName.trim()||!e.lastName.trim())continue;
  if(!byId.has(e.id))byId.set(e.id,{...e,firstName:e.firstName.trim(),lastName:e.lastName.trim(),...(e.legacyIds?.length?{legacyIds:[...e.legacyIds]}:{})});
 }
 const employees:ProjectEmployee[]=[],byName=new Map<string,ProjectEmployee>();
 for(const e of byId.values()){
  const prior=findEmployee(employees,e.id)||(!ambiguous.has(nameKey(e))?byName.get(nameKey(e)):undefined);
  if(prior){prior.legacyIds=[...new Set([...(prior.legacyIds||[]),e.id,...(e.legacyIds||[])])].filter(id=>id!==prior.id);}
  else{employees.push(e);byName.set(nameKey(e),e);}
 }
 return assignEmployeeCodes(employees,employees);
}

export function addDirectoryEmployees(current:ProjectEmployee[],added:ProjectEmployee[]):ProjectEmployee[]{
 const additions=added.filter(e=>!findEmployee(current,e.id));
 return mergeProjectEmployees([{id:'directory',employees:current,updatedAt:'1'},{id:'new',employees:additions,updatedAt:'0'}]);
}

export async function employeeDirectory(projects:Project[],stored?:EmployeeDirectory):Promise<EmployeeDirectory>{
 if(stored)return stored;
 const employees=mergeProjectEmployees(projects),hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(employees)));
 return{id:EMPLOYEE_DIRECTORY_ID,employees,token:'legacy-'+Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join(''),updatedAt:''};
}
