import {env} from 'cloudflare:workers';
type Row=Record<string,string|null>;
export type PlanProject={id:string;name:string;address:string;email:string;orderNumber:string;number:string;customer:string;foreman:string;contacts:{name:string;role:string;email:string;phone:string}[]};
// Read-only view of the Montageplanung database. Nothing here writes to it.
export async function readPlan(){
 const plan=(env as unknown as {PLAN_DB?:D1Database}).PLAN_DB;
 if(!plan)return{projects:[] as PlanProject[],employees:[] as {name:string;role:string}[],contractors:[] as {name:string}[]};
 const [projects,contacts,resources]=await plan.batch<Row>([
  plan.prepare('SELECT p.id,p.name,p.address,p.project_email AS email,p.order_number AS orderNumber,p.project_number AS number,p.customer_id AS customerId,c.name AS customer,r.name AS foreman FROM projects p LEFT JOIN customers c ON c.id = p.customer_id LEFT JOIN resources r ON r.id = p.foreman_id WHERE p.archived_at IS NULL ORDER BY p.sort_order, p.name'),
  plan.prepare('SELECT customer_id AS customerId,name,role,email,phone,mobile FROM contacts ORDER BY name'),
  plan.prepare('SELECT name,kind,role FROM resources WHERE archived_at IS NULL ORDER BY sort_order, name'),
 ]);
 return{
  employees:resources.results.filter(r=>r.kind==='employee').map(r=>({name:r.name||'',role:r.role||''})),
  contractors:resources.results.filter(r=>r.kind==='contractor').map(r=>({name:r.name||''})),
  projects:projects.results.map(p=>({id:p.id||'',name:p.name||'',address:p.address||'',email:p.email||'',orderNumber:p.orderNumber||'',number:p.number||'',customer:p.customer||'',foreman:p.foreman||'',contacts:contacts.results.filter(c=>c.customerId===p.customerId).map(c=>({name:c.name||'',role:c.role||'',email:c.email||'',phone:c.phone||c.mobile||''}))})) as PlanProject[],
 };
}
