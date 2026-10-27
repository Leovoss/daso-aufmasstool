import {parseDecimal} from './business';
import type {Position} from './types';

export const positionNumberKey=(value:string)=>value.trim().normalize('NFKC').toLocaleLowerCase('de-DE');
type Details=Pick<Position,'number'|'description'|'unit'|'price'|'longText'|'planned'>;
export type PositionForm={number:string;description:string;unit:string;price:string;longText:string;planned:string};

export function manualPositionDetails(input:unknown,positions:Position[]):Details{
 if(!input||typeof input!=='object')throw Error('Bitte die Positionsdetails eintragen.');
 const v=input as Partial<Position>;
 const text=(value:unknown,label:string,max:number,required=false)=>{
  const s=typeof value==='string'?value.trim():'';
  if(required&&!s)throw Error(label+' fehlt.');
  if(s.length>max)throw Error(label+' darf höchstens '+max+' Zeichen enthalten.');
  return s;
 };
 const number=text(v.number,'Positionsnummer',80,true),description=text(v.description,'Bezeichnung',3000,true),unit=text(v.unit,'Einheit',30,true),longText=text(v.longText,'Langtext',12000);
 if(/[\r\n\t]/.test(number)||/[\r\n\t]/.test(unit))throw Error('Positionsnummer und Einheit müssen einzeilig sein.');
 if(positions.some(p=>positionNumberKey(p.number)===positionNumberKey(number)))throw Error('Die Positionsnummer '+number+' ist bereits im Projekt vorhanden. Bitte eine andere Nummer verwenden.');
 if(typeof v.price!=='number'||!Number.isSafeInteger(v.price)||v.price<0||v.price>1e12)throw Error('Bitte einen gültigen EP größer oder gleich 0 eintragen.');
 const planned=v.planned??null;
 if(planned!==null&&(typeof planned!=='number'||!Number.isFinite(planned)||planned<0||planned>1e8||Math.abs(planned*10000-Math.round(planned*10000))>.001))throw Error('Die LV-Menge muss zwischen 0 und 100.000.000 liegen und darf höchstens vier Nachkommastellen haben.');
 return{number,description,unit,price:v.price,longText,planned};
}

export function positionFormDetails(form:PositionForm,positions:Position[]):Details{
 const price=parseDecimal(form.price);
 if(!form.price.trim()||!Number.isFinite(price)||price<0||Math.abs(price*100-Math.round(price*100))>1e-5)throw Error('Bitte einen EP in € mit höchstens zwei Nachkommastellen eintragen.');
 const planned=form.planned.trim()?parseDecimal(form.planned):null;
 return manualPositionDetails({...form,price:Math.round(price*100),planned},positions);
}
