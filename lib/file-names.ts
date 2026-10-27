import type {Project,Report} from './types';
import {reportDateRange} from './business';
import {reportCrews,crewWorkers} from './report-crews';
import {isTimeReport,reportLabel} from './time-reports';

type Extension='pdf'|'xlsx'|'csv'|'eml';
type NamedProject=Pick<Project,'name'|'number'>;
function fileName(stem:string,extension:Extension){
 const safe=stem.normalize('NFC').replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g,'-').replace(/\s+/g,' ').replace(/^[. ]+|[. ]+$/g,'').slice(0,190).trim();
 return `${safe||'DaSo-Aufmaß'}.${extension}`;
}
const projectName=(project:NamedProject)=>project.name.trim()||project.number.trim()||'Bauvorhaben';
export function reportFileName(project:NamedProject,report:Report,extension:Extension='pdf'){
 const crews=reportCrews(report).filter(crew=>!isTimeReport(report)||!report.timeSheet?.entries.length||report.timeSheet.entries.some(entry=>crewWorkers(crew).some(worker=>worker.id===entry.workerId)));
 const codes=[...new Set(crews.flatMap(crew=>crew.team.split(/\s*[+/]\s*/)).map(code=>code.trim()).filter(Boolean))].join('-');
 const dates=reportDateRange(report).replace(/ – /g,'-'),kind=isTimeReport(report)?reportLabel(report):'';
 return fileName([dates,projectName(project),codes,kind].filter(Boolean).join(' '),extension);
}
export function overviewFileName(project:NamedProject,period:string,extension:Extension='pdf'){
 return fileName(`${period} DaSo-Aufmaß ${projectName(project)}`,extension);
}
export function weeklyFileName(project:NamedProject,weeks:string[],extension:Extension='pdf'){
 const label=[...new Set(weeks)].sort().map(week=>{const [year,number]=week.split('-W');return `KW ${number}-${year}`;}).join(' + ');
 return overviewFileName(project,label||'Wochenübersicht',extension);
}
export function invoiceFileName(project:NamedProject,week:string,extension:Extension='pdf'){
 const [year,number]=week.split('-W');
 return fileName(`KW ${number}-${year} ${projectName(project)} Rechnungsübersicht`,extension);
}
export function withFileExtension(name:string,extension:Extension){return fileName(name.replace(/\.(pdf|xlsx|csv|eml)$/i,''),extension);}
// Keep spaces in the ASCII fallback and provide the exact Unicode filename
// through RFC 5987 / RFC 2231 for browser downloads and mail attachments.
export function asciiFileName(name:string){return name.replace(/ß/g,'ss').replace(/ẞ/g,'SS').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7e]|["\\]/g,'_');}
export function contentDisposition(name:string,inline=false){const safe=name.replace(/[\r\n\u0000]/g,'');return `${inline?'inline':'attachment'}; filename="${asciiFileName(safe)}"; filename*=UTF-8''${encodeURIComponent(safe)}`;}

export function contractorTimeFileName(company:string,week:string,site:string){const [year,number]=week.split('-W');return fileName(`KW ${number}-${year} DaSo-Stundenzettel ${company} ${site}`,'pdf');}
