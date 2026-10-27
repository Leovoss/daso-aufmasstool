import {cleanSpeech,spokenAmount} from './speech';
import {editTimeEntry,timeLines,timeWorkers} from './time-reports';
import type {Project,Report,TimeEntry} from './types';

export type SpeechEngine={lang:string;continuous:boolean;interimResults:boolean;onresult:((event:{results:{[key:number]:{[key:number]:{transcript:string}}}})=>void)|null;onerror:((event:{error:string})=>void)|null;onend:(()=>void)|null;start:()=>void;stop:()=>void};
function number(text:string){if(/\b(?:oder|vielleicht|minus)\b|^-/.test(text))return null;if(/\b(?:keine?|ohne|null|nein)\b/i.test(text))return 0;const raw=spokenAmount(text),value=Number(raw.replace(',','.'));return raw&&Number.isSafeInteger(value)&&value>=0?value:null;}
export function spokenClock(input:string):string|null{
 const text=cleanSpeech(input).toLowerCase().replace(/^[\s,:;.]*(?:um|gegen|ab|von|bis)\s+/,'').replace(/\s+(?:morgens|vormittags|mittags|nachmittags|abends)\b/g,'').replace(/(?:[,;:.\s]+(?:und|dann|sowie|mit|die|der))*[,;:.\s]*$/,''),afternoon=/\b(?:nachmittags|abends)\b/i.test(input);if(/\b(?:oder|vielleicht)\b/.test(text))return null;
 let h:number|null=null,m:number|null=0;const numeric=text.match(/^(\d{1,2})\s*[:.,]\s*(\d{1,2})(?:\s*uhr)?[\s.,;]*$/);
 if(numeric){h=Number(numeric[1]);m=Number(numeric[2]);}
 else if(/^halb\s+/.test(text)){h=number(text.replace(/^halb\s+/,''));m=30;if(h!==null)h=(h+23)%24;}
 else if(/^viertel\s+(nach|vor)\s+/.test(text)){const before=/^viertel\s+vor/.test(text);h=number(text.replace(/^viertel\s+(?:nach|vor)\s+/,''));m=before?45:15;if(before&&h!==null)h=(h+23)%24;}
 else if(text.includes('uhr')){const parts=text.split(/\s*uhr\s*/);if(parts.length!==2)return null;h=number(parts[0]);m=parts[1].trim()?number(parts[1].replace(/\bminuten?\b/g,'')):0;}
 else{const tokens=text.replace(/[.,;]$/,'').trim().split(/\s+/);if(tokens.length===2){h=number(tokens[0]);m=number(tokens[1]);}else h=number(text);}
 if(h===null||m===null||h>23||m>59)return null;if(afternoon&&h<12)h+=12;return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');
}
export function parseTimeSpeech(input:string):{patch:Partial<TimeEntry>;recognized:string[];unrecognized:string[];transcript:string}{
 const transcript=cleanSpeech(input),patch:Partial<TimeEntry>={},recognized:string[]=[],unrecognized:string[]=[];
 const taskMatch=/(?:ausgeführte[n]?\s+arbeiten|tätigkeit|arbeitstext|beschreibung)\s*:?\s*|(?:^|[,;.]\s*)arbeiten\s*:?\s*/iu.exec(transcript),commands=taskMatch?transcript.slice(0,taskMatch.index):transcript;
 if(taskMatch){const task=cleanSpeech(transcript.slice(taskMatch.index+taskMatch[0].length));if(task){patch.task=task;recognized.push('Arbeiten');}else unrecognized.push('Arbeiten');}
 const role=/\b(ober\s?monteur|monteur)\b/i.exec(commands);if(role){patch.role=/ober/i.test(role[1])?'foreman':'fitter';recognized.push('Funktion');}
 const expression=/(?<![\p{L}\p{N}])(anfang(?:\s+der\s+arbeiten)?|beginn(?:\s+der\s+arbeiten)?|arbeitsbeginn|start|ende(?:\s+der\s+arbeiten)?|arbeitsende|pause[n]?|anfahrts?[-]?(?:\s*(?:\/|beziehungsweise|bzw\.?|oder|und)\s*übernachtungs?)?(?:\s*pauschale)?|übernachtungs?(?:\s*pauschale)?|pauschale)(?![\p{L}\p{N}])/giu,markers=[...commands.matchAll(expression)];
 const found=new Map<string,(string|number)[]>();
 for(const [index,marker] of markers.entries()){const label=marker[1].toLowerCase(),value=commands.slice(marker.index!+marker[0].length,markers[index+1]?.index??commands.length).trim(),key=/^(anfang|beginn|arbeitsbeginn|start)/.test(label)?'start':/^(ende|arbeitsende)/.test(label)?'end':label.startsWith('pause')?'pauseMinutes':'allowanceQuantity';let parsed:string|number|null;
  if(key==='start'||key==='end')parsed=spokenClock(value);else if(key==='pauseMinutes'&&/\bhalbe?\s+stunde\b/i.test(value))parsed=30;else{parsed=number(value);if(key==='pauseMinutes'&&parsed!==null&&/\bstunden?\b/i.test(value))parsed*=60;}
  if(parsed===null||typeof parsed==='number'&&parsed>1440){unrecognized.push({start:'Anfang',end:'Ende',pauseMinutes:'Pause',allowanceQuantity:'Pauschale'}[key]);continue;}found.set(key,[...(found.get(key)||[]),parsed]);
 }
 for(const [key,values] of found){const label={start:'Anfang',end:'Ende',pauseMinutes:'Pause',allowanceQuantity:'Pauschale'}[key as 'start'];if(new Set(values).size!==1){unrecognized.push(label);continue;}Object.assign(patch,{[key]:values[0]});recognized.push(label);}
 return{patch,recognized:[...new Set(recognized)],unrecognized:[...new Set(unrecognized)],transcript};
}
export function applyTimeSpeech(report:Report,project:Project,target:{workerId:string;date:string},patch:Partial<TimeEntry>):Report|null{
 const entry=report.timeSheet?.entries.find(e=>e.workerId===target.workerId&&e.date===target.date),worker=timeWorkers(report).find(w=>w.id===target.workerId);if(!entry||!worker||!report.timeSheet)return null;
 const updated=editTimeEntry(entry,patch,project,worker),next={...report,timeSheet:{...report.timeSheet,entries:report.timeSheet.entries.map(e=>e.id===entry.id?updated:e)}};return{...next,lines:timeLines(next)};
}
