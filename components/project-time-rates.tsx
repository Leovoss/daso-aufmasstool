'use client';
import {Input} from '@/components/ui/input';
import {projectTimeRates,roleLabel} from '@/lib/time-reports';
import {parseDecimal} from '@/lib/business';
import type {Project,RoleRates,TimeRates} from '@/lib/types';

export function ProjectTimeRates({project,disabled,onChange}:{project:Project;disabled:boolean;onChange:(rates:TimeRates)=>void}){
 const rates=projectTimeRates(project);
 const fields:[keyof RoleRates,string][]=[['billingHourly','Projektstundenverrechnungssatz'],['allowanceBilling','Anfahrts-/Übernachtungspauschale · Abrechnung']];
 return <section className="time-rates wide"><div className="section-title"><div><h3>Stundenberichte · Projektsätze & Pauschalen</h3><p>Umsatz = Arbeitsstunden × Projektstundenverrechnungssatz der Funktion × Mitarbeiterfaktor. Beispiel: 8 Std × 60 € × 0,9 = 432 €. Für eigene Mitarbeiter werden keine internen Kosten berechnet.</p></div></div><div className="table-scroll"><table className="rates-table"><thead><tr><th>Satz in €</th><th>Monteur</th><th>Obermonteur</th></tr></thead><tbody>{fields.map(([key,label])=><tr key={key}><th>{label}</th>{(['fitter','foreman'] as const).map(role=><td key={role} data-label={roleLabel(role)}><Input disabled={disabled} type="number" min="0" step="0.01" aria-label={`${label} ${roleLabel(role)}`} value={rates[role][key]==null?'':rates[role][key]!/100} placeholder="Noch nicht hinterlegt" onChange={e=>{const value=e.target.value===''?null:Math.round(parseDecimal(e.target.value)*100);onChange({...rates,[role]:{...rates[role],[key]:value}});}}/></td>)}</tr>)}</tbody></table></div><p className="people-hint">Die Stundensätze gelten für Aufwände und Stundenberichte im Projekt, getrennt nach Monteur und Obermonteur. Entwürfe verwenden beim Bearbeiten die aktuellen Projektsätze; fertiggestellte Berichte behalten ihre gespeicherten Beträge. Bei Nachunternehmern bleiben die im Team hinterlegten Kosten erhalten. Die Pauschale wird je Mitarbeiter und Tag mit ihrer Anzahl erfasst.</p></section>;
}
