import {actor} from '@/lib/auth';
import {readPlan} from '@/lib/plan';
export async function GET(request:Request){try{
 await actor(request);
 return Response.json(await readPlan(),{headers:{'Cache-Control':'no-store'}});
}catch(e){return Response.json({error:e instanceof Error?e.message:'Montageplanung nicht erreichbar.'},{status:400});}}
