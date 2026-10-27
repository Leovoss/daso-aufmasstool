export type InboxCheck={status:'changes'|'unchanged'|'manual';version:string;changed:number};
export type InboxItem={id:string;projectId:string;packageId:string;fileId:string;key:string;name:string;size:number;from:string;subject:string;messageId:string;receivedAt:string;createdAt:string;updatedAt:string;match:'thread'|'pdf-fields'|'manual';candidatePackageIds:string[];checks:Record<string,InboxCheck>;notice:string};
export type InboxState={id:string;account:string;uidValidity:string;lastUid:number;lastRunAt?:string;lastSuccessAt?:string;error?:string;skipped?:number;more?:boolean};
