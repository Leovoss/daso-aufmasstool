import {env} from 'cloudflare:workers';
import {actor} from '@/lib/auth';
type Row=Record<string,string|null>;
// Read-only view of the Montageplanung database. Nothing here writes to it.
export async function GET(request:Request){try{
 await actor(request);
 const plan=(env as unknown as {PLAN_DB?:D1Database}).PLAN_DB;if(!plan)return Response.json({projects:[]},{headers:{'Cache-Control':'no-store'}});
 const [projects,contacts]=await plan.batch<Row>([
  plan.prepare('SELECT p.id,p.name,p.address,p.project_email AS email,p.order_number AS orderNumber,p.project_number AS number,p.customer_id AS customerId,c.name AS customer,r.name AS foreman FROM projects p LEFT JOIN customers c ON c.id = p.customer_id LEFT JOIN resources r ON r.id = p.foreman_id WHERE p.archived_at IS NULL ORDER BY p.sort_order, p.name'),
  plan.prepare('SELECT customer_id AS customerId,name,role,email,phone,mobile FROM contacts ORDER BY name'),
 ]);
 return Response.json({projects:projects.results.map(p=>({id:p.id,name:p.name,address:p.address||'',email:p.email||'',orderNumber:p.orderNumber||'',number:p.number||'',customer:p.customer||'',foreman:p.foreman||'',contacts:contacts.results.filter(c=>c.customerId===p.customerId).map(c=>({name:c.name||'',role:c.role||'',email:c.email||'',phone:c.phone||c.mobile||''}))}))},{headers:{'Cache-Control':'no-store'}});
}catch(e){return Response.json({error:e instanceof Error?e.message:'Montageplanung nicht erreichbar.'},{status:400});}}
