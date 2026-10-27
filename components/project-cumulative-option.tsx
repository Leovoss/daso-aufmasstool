'use client';
import {Checkbox} from '@/components/ui/checkbox';

export function ProjectCumulativeOption({checked,disabled,onChange}:{checked:boolean;disabled:boolean;onChange:(checked:boolean)=>void}){
 return <label className="check-row wide"><Checkbox aria-label="Kumulierte Aufstellung erforderlich" checked={checked} disabled={disabled} onCheckedChange={value=>onChange(value===true)}/><span>Kumulierte Aufstellung erforderlich<small>Mit Haken: Wochen-, Monats- und Gesamtaufstellungen. Ohne Haken: Einzelaufmaße mit Anlagen, ohne Kumulierung im Versand.</small></span></label>;
}
