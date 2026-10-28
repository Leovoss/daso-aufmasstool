import {identity} from '@/lib/auth';
export async function GET(request:Request){try{const user=await identity(request);return Response.json({role:user.role,name:user.name},{headers:{'Cache-Control':'no-store'}});}catch(e){return Response.json({error:e instanceof Error?e.message:'Bitte anmelden.'},{status:400});}}
