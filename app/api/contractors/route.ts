import {actor} from '@/lib/auth';
import {db} from '@/db/raw';
import {COMPANY_ID,defaultCompany} from '@/lib/company';
import {normalizeFinancialData,weekOf,weekStart} from '@/lib/business';
import {offsetDate} from '@/lib/time-reports';
import {emptyData,type Project,type Report} from '@/lib/types';

// Read-only, week-scoped cross-project view; no positions, files or mailbox data.
export async function GET(request:Request){try{
 await actor(request);const week=new URL(request.url).searchParams.get('week')||'';
 if(!/^\d{4}-W\d{2}$/.test(week)||weekOf(weekStart(week))!==week)throw Error('Bitte eine gültige Kalenderwoche auswählen.');
 const start=weekStart(week),end=offsetDate(start,6);
 const rows=await db().prepare("SELECT id,kind,data FROM records WHERE kind = 'project' OR id = ? OR (kind = 'report' AND json_extract(data, '$.date') <= ? AND COALESCE(json_extract(data, '$.endDate'),json_extract(data, '$.date')) >= ?)").bind(COMPANY_ID,end,start).all<{id:string;kind:string;data:string}>();
 const projects:Project[]=[],reports:Report[]=[];let company=defaultCompany();
 for(const row of rows.results){const value=JSON.parse(row.data);if(row.kind==='project')projects.push(value);else if(row.kind==='report')reports.push(value);else if(row.id===COMPANY_ID)company=value;}
 const data=normalizeFinancialData({...emptyData,projects,reports,company});return Response.json({projects:data.projects,reports:data.reports,company:data.company},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Auswertung konnte nicht geladen werden.'},{status:400});}}
