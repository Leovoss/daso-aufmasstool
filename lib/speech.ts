export function cleanSpeech(value:string){return value.trim().replace(/[.!?,;:…]+\s*$/u,'').trim();}
const units=['null','eins','zwei','drei','vier','fuenf','sechs','sieben','acht','neun'];
const words:Record<string,number>={ein:1,eine:1,einen:1,einmal:1,zwo:2,zehn:10,elf:11,zwoelf:12,dreizehn:13,vierzehn:14,fuenfzehn:15,sechzehn:16,siebzehn:17,achtzehn:18,neunzehn:19,zwanzig:20,dreissig:30,vierzig:40,fuenfzig:50,sechzig:60,siebzig:70,achtzig:80,neunzig:90,hundert:100};units.forEach((s,i)=>words[s]=i);for(const [ten,n]of Object.entries({...words}).filter(([,n])=>n>=20&&n<100))for(let i=1;i<10;i++)words[(i===1?'ein':units[i])+'und'+ten]=n+i;
function numberWord(word:string):number|undefined{if(words[word]!==undefined)return words[word];for(const [part,factor] of [['tausend',1000],['hundert',100]] as const){const index=word.indexOf(part);if(index>=0){const left=word.slice(0,index),right=word.slice(index+part.length).replace(/^und/,'');const a=left?numberWord(left):1,b=right?numberWord(right):0;if(a!==undefined&&b!==undefined)return a*factor+b;}}}
export function spokenAmount(input:string){
 const s=cleanSpeech(input).toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss'),parts=s.split(/\s+(?:komma|punkt)\s+/),negative=/\bminus\b|^-/.test(s);
 const numeric=parts[0].match(/\d+(?:[.,]\d+)*/);
 let whole:string;if(numeric){let value=numeric[0];if(value.includes(','))value=value.replaceAll('.','');else if(/^\d{1,3}(?:\.\d{3})+$/.test(value))value=value.replaceAll('.','');else value=value.replace('.',',');whole=value;}
 else{const values=parts[0].split(' ').map(numberWord).filter((n):n is number=>n!==undefined);if(!values.length)return '';whole=String(values.reduce((a,v)=>v===100?(a||1)*100:a+v,0));}
 if(parts[1]){const digits=parts[1].split(' ').map(w=>/^\d+$/.test(w)?w:numberWord(w)).filter(n=>n!==undefined);if(digits.length)whole=whole.split(',')[0]+','+digits.join('');}
 return(negative?'-':'')+whole;
}
