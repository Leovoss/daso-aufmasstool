import type {CompanyProfile,Project,Report} from './types';
import {crewReports,dailyRevenue,weekOf,weekStart} from './business';
import {isTimeReport,offsetDate,projectPricedReport,reportDays,workMinutes} from './time-reports';

export type ContractorData={projects:Project[];reports:Report[];company?:CompanyProfile};
export type ContractorValues={revenue:number|null;cost:number|null;profit:number|null;complete:boolean};
export type ContractorWorkerHours={id:string;name:string;days:Record<string,number>;unassigned:number;total:number;missing:boolean};
export type UnassignedHours={name:string;date:string;endDate:string;hours:number};
export type ContractorTeam={id:string;code:string;project:Project;names:string[];values:ContractorValues;workers:ContractorWorkerHours[];unassigned:UnassignedHours[];drafts:number;reportCount:number};
export type ContractorCompany={id:string;name:string;teams:ContractorTeam[];values:ContractorValues;hours:number;missingHours:boolean;unassignedHours:number;drafts:number};
export type ContractorWeek={week:string;dates:string[];companies:ContractorCompany[];values:ContractorValues;drafts:number};

const normalize=(s:string)=>s.normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('de-DE');
const compare=(a:string,b:string)=>a.localeCompare(b,'de',{numeric:true});
export function addContractorValues(rows:ContractorValues[]):ContractorValues{
 const revenue=rows.some(r=>r.revenue!==null)?rows.reduce((s,r)=>s+(r.revenue||0),0):null;
 const cost=rows.length&&rows.every(r=>r.cost!==null)?rows.reduce((s,r)=>s+r.cost!,0):null;
 const complete=rows.every(r=>r.complete);return{revenue,cost,complete,profit:cost===null||revenue===null||!complete?null:revenue-cost};
}

// A weekly timesheet always belongs to exactly one selected construction site.
// Recompute every total and flag from that subset, even in the all-sites view.
export function contractorForProject(company:ContractorCompany,projectId:string):ContractorCompany|null{
 const teams=company.teams.filter(t=>t.project.id===projectId);if(!teams.length)return null;
 const workers=teams.flatMap(t=>t.workers);
 return{...company,teams,values:addContractorValues(teams.map(t=>t.values)),hours:workers.reduce((s,w)=>s+w.total,0),unassignedHours:workers.reduce((s,w)=>s+w.unassigned,0),missingHours:teams.some(t=>!t.workers.length||t.workers.some(w=>w.missing)),drafts:teams.reduce((s,t)=>s+t.drafts,0)};
}

// Use recorded crews, names and rates. T1 on two sites is two different teams.
// Linked extra hours are part of the parent's entered total working hours.
export function contractorWeek(data:ContractorData,week:string,projectId?:string,includeDrafts=false):ContractorWeek{
 const dates=Array.from({length:7},(_,i)=>offsetDate(weekStart(week),i));
 const projects=new Map(data.projects.map(p=>[p.id,p]));
 const groups=new Map<string,{companyId:string;companyName:string;code:string;project:Project;reports:Report[]}>();
 for(const raw of data.reports){const project=projects.get(raw.projectId);if(!project||projectId&&project.id!==projectId||!includeDrafts&&raw.state!=='ready')continue;
  const report=projectPricedReport(raw,project);
  for(const day of reportDays(report)){if(weekOf(day.date)!==week)continue;
   for(const slice of crewReports(day,project.factor)){const work=slice.teamWork;if(!work)continue;
    const companyName=work.company.trim().replace(/\s+/g,' ')||'Firma nicht hinterlegt';
    const companyId=normalize(work.company)||`unassigned:${project.id}:${work.code}`;
    const key=JSON.stringify([project.id,companyId,work.code]);
    const group=groups.get(key)||{companyId,companyName,code:work.code,project,reports:[]};group.reports.push(slice);groups.set(key,group);
   }
  }
 }
 const companies=new Map<string,ContractorCompany>();
 for(const [id,group]of groups){
  // Sum the displayed day/type amounts to keep the same cents as the daily overview.
  const daily=dailyRevenue(group.reports,group.project.factor).flatMap(d=>d.teams);
  const values=addContractorValues(daily.map(d=>({revenue:d.total.amount,cost:d.accounting?.cost??null,profit:d.accounting?.profit??null,complete:d.total.complete})));
  if(group.reports.some(r=>r.parentReportId&&!group.reports.some(parent=>parent.id===r.parentReportId))){values.cost=null;values.profit=null;values.complete=false;}
  const workers=new Map<string,ContractorWorkerHours>(),unassigned:UnassignedHours[]=[],names=new Set<string>();
  const worker=(name:string,index:number)=>{const label=name.trim()||`Mitarbeiter ${index+1} · Name fehlt`,key=index+':'+normalize(label),old=workers.get(key)||{id:key,name:label,days:{},unassigned:0,total:0,missing:!name.trim()};workers.set(key,old);names.add(label);return old;};
  for(const report of group.reports){const work=report.teamWork!;
   work.workers.forEach(w=>{if(w.name.trim())names.add(w.name.trim());});
   if(report.parentReportId)continue;
   if(isTimeReport(report)){
    for(const entry of report.timeSheet?.entries||[]){const index=work.workers.findIndex((w,i)=>entry.workerId===`sub:${work.code}:${i}`),person=worker(entry.name,index>=0?index:work.workers.findIndex(w=>normalize(w.name)===normalize(entry.name))),minutes=workMinutes(entry);if(minutes===null){person.missing=true;continue;}const hours=minutes/60;person.days[entry.date]=(person.days[entry.date]||0)+hours;person.total+=hours;}
   }else{
    work.workers.forEach((w,i)=>{const person=worker(w.name,i);if(w.hours===null||!Number.isFinite(w.hours)||w.hours<0){person.missing=true;return;}
     if(report.date===(report.endDate||report.date)){person.days[report.date]=(person.days[report.date]||0)+w.hours;person.total+=w.hours;return;}
     const allocation=w.dailyHours,entries=Object.entries(allocation||{}),valid=entries.length>0&&entries.every(([date,h])=>dates.includes(date)&&date>=report.date&&date<=report.endDate&&Number.isFinite(h)&&h>=0&&h<=24)&&Math.abs(entries.reduce((s,[,h])=>s+h,0)-w.hours)<.000001;
     if(valid)for(const [date,hours]of entries)person.days[date]=(person.days[date]||0)+hours;
     else{person.missing=true;person.unassigned+=w.hours;if(w.hours>0)unassigned.push({name:person.name,date:report.date,endDate:report.endDate,hours:w.hours});}
     person.total+=w.hours;
    });
   }
  }
  const drafts=new Set(group.reports.filter(r=>r.state==='draft').map(r=>r.id)).size;
  const team:ContractorTeam={id,code:group.code,project:group.project,names:[...names],values,workers:[...workers.values()].sort((a,b)=>compare(a.name,b.name)),unassigned,drafts,reportCount:new Set(group.reports.map(r=>r.id)).size};
  const company=companies.get(group.companyId)||{id:group.companyId,name:group.companyName,teams:[],values:addContractorValues([]),hours:0,missingHours:false,unassignedHours:0,drafts:0};company.teams.push(team);companies.set(company.id,company);
 }
 for(const company of companies.values()){
  company.teams.sort((a,b)=>compare(a.project.name,b.project.name)||compare(a.code,b.code));company.values=addContractorValues(company.teams.map(t=>t.values));company.hours=company.teams.flatMap(t=>t.workers).reduce((s,w)=>s+w.total,0);company.unassignedHours=company.teams.flatMap(t=>t.workers).reduce((s,w)=>s+w.unassigned,0);company.missingHours=company.teams.some(t=>t.workers.some(w=>w.missing)||!t.workers.length);company.drafts=company.teams.reduce((s,t)=>s+t.drafts,0);
 }
 const result=[...companies.values()].sort((a,b)=>compare(a.name,b.name));return{week,dates,companies:result,values:addContractorValues(result.map(c=>c.values)),drafts:result.reduce((s,c)=>s+c.drafts,0)};
}
