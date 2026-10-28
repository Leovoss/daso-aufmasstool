import {db} from '@/db/raw';
import {reportDateRange,dateLabel} from '@/lib/business';
import {isTimeReport} from '@/lib/time-reports';
import {newPortalToken,portalId,portalRows,PORTAL_DAYS,type PortalLink} from '@/lib/portal';
import type {MailPackage,Report} from '@/lib/types';
// Returns the new link record plus the one-time token, and the old record when it has to be revoked.
export async function buildPortal(pack:Pick<MailPackage,'id'|'projectId'|'portalId'>,reports:Report[],user:string){
 const rows=portalRows(reports);if(!rows.length)return null;
 const token=newPortalToken(),now=new Date(),expires=new Date(now.getTime()+PORTAL_DAYS*86400000);
 const link:PortalLink={id:await portalId(token),projectId:pack.projectId,packageId:pack.id,createdAt:now.toISOString(),createdBy:user,expiresAt:expires.toISOString(),status:'open',reports:reports.filter(r=>!isTimeReport(r)).map(r=>({id:r.id,date:r.date,label:reportDateRange(r)})),rows};
 const old=pack.portalId?await db().prepare("SELECT data FROM records WHERE id = ? AND kind = 'portal'").bind(pack.portalId).first<{data:string}>():null;
 const previous=old?JSON.parse(old.data) as PortalLink:null;
 return{token,link,revoked:previous&&previous.status==='open'?{...previous,status:'revoked' as const}:null,until:dateLabel(link.expiresAt)};
}
export const portalUrl=(origin:string,token:string)=>`${origin}/p/${token}`;
export const portalMailText=(origin:string,token:string,until:string)=>`\n\nMengen online prüfen und korrigieren:\n${portalUrl(origin,token)}\n(Link gültig bis ${until}. Eine Anmeldung ist nicht nötig.)`;
