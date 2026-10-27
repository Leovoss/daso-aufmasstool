'use client';
import {Check} from 'lucide-react';
import {matchPositions} from '@/lib/business';
import type {Position} from '@/lib/types';

export function PositionMatches({positions,query,selected,disabled,onSelect}:{positions:Position[];query:string;selected:string;disabled:boolean;onSelect:(id:string)=>void}){
 const matches=matchPositions(positions,query);
 return <div className="position-matches"><div className="position-match-heading"><strong>Passende LV-Positionen</strong><small role="status">{matches.length===40?'Bis zu 40':matches.length} Treffer{query.trim()?' zur Eingabe':' · Teilwort eingeben'}</small></div>{matches.length?<ul aria-label="Passende LV-Positionen" className="position-match-list">{matches.map(p=><li key={p.id}><button type="button" disabled={disabled} aria-pressed={selected===p.id} className={'position-match'+(selected===p.id?' selected':'')} onClick={()=>onSelect(p.id)}><span className="position-match-number">{p.number}</span><span className="position-match-description">{p.description}{p.isSupplement&&<small className="supplement-label">Nachtrag</small>}</span><span className="position-match-unit">{p.unit}</span>{selected===p.id&&<Check size={16} aria-hidden="true"/>}</button></li>)}</ul>:<p className="people-hint">Keine Treffer. Teilwort verkürzen oder LV-Nummer eingeben.</p>}<small className="people-hint">Treffer erscheinen beim Tippen. Position anklicken, Menge eingeben und übernehmen.</small></div>;
}
