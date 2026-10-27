import type {CompanyProfile} from './types';
export const COMPANY_ID='daso:company-profile';
export const companyFields=['name','street','postalCode','city','country','phone','email','website','taxNumber','vatId','registerCourt','registerNumber','managingDirector','bankName','iban','bic'] as const;
export const defaultCompany=():CompanyProfile=>({id:COMPANY_ID,name:'DaSo Lüftungsbau',street:'',postalCode:'',city:'',country:'',phone:'',email:'',website:'',taxNumber:'',vatId:'',registerCourt:'',registerNumber:'',managingDirector:'',bankName:'',iban:'',bic:'',token:'initial',updatedAt:''});
export function validateCompany(input:unknown):CompanyProfile{if(!input||typeof input!=='object')throw Error('Firmenangaben fehlen.');const result=defaultCompany();for(const key of companyFields){const raw=(input as CompanyProfile)[key];if(typeof raw!=='string'||raw.length>300||/[\u0000-\u001f]/.test(raw))throw Error('Bitte die Firmenangaben prüfen.');result[key]=raw.trim();}if(!result.name)throw Error('Firmenname fehlt.');if(result.email&&!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(result.email))throw Error('Firmen-E-Mail prüfen.');if(result.website&&!/^https?:\/\//i.test(result.website))result.website='https://'+result.website;return result;}
export function companyAddress(company:CompanyProfile){return[company.street,[company.postalCode,company.city].filter(Boolean).join(' '),company.country].filter(Boolean);}
export function companyColumns(company:CompanyProfile){return[
 [company.name,...companyAddress(company)],
 [company.phone?'Telefon: '+company.phone:'',company.email,company.website].filter(Boolean),
 [company.managingDirector?'Geschäftsführung: '+company.managingDirector:'',company.taxNumber?'Steuernr.: '+company.taxNumber:'',company.vatId?'USt-IdNr.: '+company.vatId:'',[company.registerCourt,company.registerNumber].filter(Boolean).join(' · ')].filter(Boolean),
 [company.bankName,company.iban?'IBAN: '+company.iban:'',company.bic?'BIC: '+company.bic:''].filter(Boolean)
 ].filter(lines=>lines.length);}
export function companySignature(company?:CompanyProfile){if(!company)return'';return companyColumns(company).map(lines=>lines.join('\n')).join('\n\n');}
