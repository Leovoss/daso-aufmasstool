import type {Data,Project,Closure,CompanyProfile} from './types';
import {defaultCompany} from './company';
import {aggregateTotals,dailyRevenue,requiresCumulative,weekLabel,weekOf,type DailyRevenueRow,type RevenueCell} from './business';
import {closureIsCurrent,dispatchSummary,mergeRows,effectiveWeekRows} from './weeks';
import {timePricingComplete} from './time-reports';

// Compare approved revenue with the first preserved report state. Reading a
// return or changing review status alone never creates a revenue difference.
// The annotations become part of the immutable closure document snapshot.
export function invoiceRevenueDays(data:Data,project:Project,week:string){
 const reports=data.reports.filter(r=>r.projectId===project.id&&weekOf(r.date)===week&&r.state==='ready');
 const originals=new Map<string,Data['reports'][number]>();
 for(const revision of [...(data.reportRevisions||[])].filter(r=>r.projectId===project.id).sort((a,b)=>a.at.localeCompare(b.at)||a.before.updatedAt.localeCompare(b.before.updatedAt)||a.id.localeCompare(b.id))){
  if(!originals.has(revision.reportId)&&revision.before?.id===revision.reportId&&revision.before.projectId===project.id&&revision.before.state==='ready')originals.set(revision.reportId,revision.before);
 }
 const current=dailyRevenue(reports,project.factor);
 if(!originals.size)return current;
 const deleted=[...originals.values()].filter(r=>weekOf(r.date)===week&&!data.reports.some(current=>current.id===r.id));
 const previous=dailyRevenue([...reports.map(r=>originals.get(r.id)||r),...deleted],project.factor),key=(d:{date:string;endDate:string})=>d.date+'|'+d.endDate;
 const beforeDays=new Map(previous.map(d=>[key(d),d]));
 const amount=(cell?:RevenueCell)=>!cell?.count?0:cell.amount;
 const changed=(now?:RevenueCell,before?:RevenueCell)=>amount(now)!==null&&amount(before)!==null&&amount(now)!==amount(before);
 function annotate(now:DailyRevenueRow[],before:DailyRevenueRow[]){
  const old=new Map(before.map(r=>[r.id,r]));
  const result=now.map(row=>{const prior=old.get(row.id);old.delete(row.id);const changedRevenue={measurement:changed(row.values.measurement,prior?.values.measurement),extra:changed(row.values.extra,prior?.values.extra),timesheet:changed(row.values.timesheet,prior?.values.timesheet),total:changed(row.total,prior?.total)};return Object.values(changedRevenue).some(Boolean)?{...row,changedRevenue}:row;});
  // Keep a removed person/day visible at 0, otherwise their reduced revenue
  // would disappear from the correction overview altogether.
  for(const row of old.values())if([row.total,...Object.values(row.values)].some(c=>c.amount!==null&&c.amount!==0)){
   const zero:RevenueCell={amount:0,complete:true,count:0},values={measurement:{...zero},extra:{...zero},timesheet:{...zero}};
   result.push({...row,label:row.label+' (entfallen)',values,total:{...zero},accounting:undefined,changedRevenue:{measurement:changed(zero,row.values.measurement),extra:changed(zero,row.values.extra),timesheet:changed(zero,row.values.timesheet),total:changed(zero,row.total)}});
  }
  return result;
 }
 const result=current.map(day=>{const before=beforeDays.get(key(day));beforeDays.delete(key(day));return{...day,teams:annotate(day.teams,before?.teams||[]),employees:annotate(day.employees,before?.employees||[])};});
 for(const day of beforeDays.values()){
  const teams=annotate([],day.teams),employees=annotate([],day.employees);
  if(teams.length||employees.length)result.push({...day,teams,employees,summary:{values:{measurement:{amount:0,complete:true,count:0},extra:{amount:0,complete:true,count:0},timesheet:{amount:0,complete:true,count:0}},total:{amount:0,complete:true,count:0},accounting:undefined}});
 }
 return result.sort((a,b)=>b.date.localeCompare(a.date)||b.endDate.localeCompare(a.endDate));
}
export function invoiceBasis(data:Data,project:Project,week:string){
 if(!closureIsCurrent(data,week))throw Error('Bitte alle Berichte fertigstellen, Mengen prüfen und den Wochenabschluss erstellen beziehungsweise aktualisieren.');
 const reports=data.reports.filter(r=>r.projectId===project.id&&weekOf(r.date)===week&&r.state==='ready');if(!reports.every(timePricingComplete))throw Error('Stunden oder Projektsätze sind noch unvollständig.');
 const summary=dispatchSummary(data,project,week),rows=requiresCumulative(project)?mergeRows([summary.previous,summary.current]):effectiveWeekRows(data,project,week),current=aggregateTotals(summary.current,project.factor),previous=aggregateTotals(summary.previous,project.factor),days=invoiceRevenueDays(data,project,week),assigned=days.reduce((sum,d)=>sum+d.teams.reduce((n,t)=>n+(t.total.amount||0),0),0);
 return{week,title:weekLabel(week),rows,summary,current,previous,days,unassigned:current.employee-assigned,notice:undefined as string|undefined};
}
export type InvoiceBasis=ReturnType<typeof invoiceBasis>;
export function savedInvoiceDocument(closure:Closure,project:Project,company:CompanyProfile=defaultCompany()){
 if(closure.documentSnapshot)return closure.documentSnapshot;
 // Older closures contain fixed weekly quantities, but no historical daily or
 // cumulative snapshot. Export only those known rows and identify the limit.
 const rows=closure.rows,value=aggregateTotals(rows,project.factor),basis:InvoiceBasis={week:closure.week,title:weekLabel(closure.week),rows,summary:{cumulative:false,title:weekLabel(closure.week),current:rows,previous:[],interim:false,currentWeeks:[closure.week]},current:value,previous:{customer:0,employee:0},days:[],unassigned:0,notice:'Altabschluss: Export der gespeicherten Wochenpositionen. Vorperioden und interne Tagesumsätze wurden für diesen Abschluss nicht als fester Stand gespeichert. Firmen- und Projektangaben entsprechen dem aktuellen Stand.'};return{basis,project:{...project,requiresCumulative:false},company};
}
export function invoiceRows(basis:InvoiceBasis){const current=new Map(basis.summary.current.map(r=>[r.key,r])),previous=new Map(basis.summary.previous.map(r=>[r.key,r]));return basis.rows.map(r=>({...r,previousQuantity:previous.get(r.key)?.quantity||0,currentQuantity:current.get(r.key)?.quantity||0,currentValue:current.get(r.key)?.customerValue||0}));}
export function invoiceDailyRows(basis:InvoiceBasis){return basis.days.flatMap(day=>[...day.teams.map(r=>({...r,date:day.date,endDate:day.endDate,type:'Team / Besetzung'})),...day.employees.map(r=>({...r,date:day.date,endDate:day.endDate,type:'Mitarbeiter DaSo'}))]);}
export const invoiceCostNote='Kosten und Gewinn / Verlust gelten für Nachunternehmer-Teams. Eigene Mitarbeiter werden ohne interne Kosten geführt. Fehlende oder unvollständig gespeicherte Kosten bleiben offen und werden nicht als 0 gewertet. Gewinn / Verlust = Umsatz nach Mitarbeiterfaktor abzüglich Nachunternehmerkosten.';
