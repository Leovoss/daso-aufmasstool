import {actor} from '@/lib/auth';
import {readPlan,readPlanDay} from '@/lib/plan';
export async function GET(request:Request){try{
 await actor(request);
 const q=new URL(request.url).searchParams,project=q.get('project'),day=q.get('day');
 if(project&&day)return Response.json(await readPlanDay(project,day),{headers:{'Cache-Control':'no-store'}});
 return Response.json(await readPlan(),{headers:{'Cache-Control':'no-store'}});
}catch(e){return Response.json({error:e instanceof Error?e.message:'Montageplanung nicht erreichbar.'},{status:400});}}
