import {env} from 'cloudflare:workers';
type Row=Record<string,string|null>;
export type PlanDay={employees:string[];contractors:{name:string;count:number}[]};
export type PlanProject={id:string;name:string;address:string;email:string;orderNumber:string;number:string;customer:string;foreman:string;contacts:{name:string;role:string;email:string;phone:string}[]};
// Read-only view of the Montageplanung database. Nothing here writes to it.
export async function readPlan(){
 const plan=(env as unknown as {PLAN_DB?:D1Database}).PLAN_DB;
 if(!plan)return{projects:[] as PlanProject[],employees:[] as {name:string;role:string}[],contractors:[] as {name:string}[],assigned:[] as {projectId:string;name:string;max:number}[]};
 const [projects,contacts,resources,assigned]=await plan.batch<Row>([
  plan.prepare('SELECT p.id,p.name,p.address,p.project_email AS email,p.order_number AS orderNumber,p.project_number AS number,p.customer_id AS customerId,c.name AS customer,r.name AS foreman FROM projects p LEFT JOIN customers c ON c.id = p.customer_id LEFT JOIN resources r ON r.id = p.foreman_id WHERE p.archived_at IS NULL ORDER BY p.sort_order, p.name'),
  plan.prepare('SELECT customer_id AS customerId,name,role,email,phone,mobile FROM contacts ORDER BY name'),
  plan.prepare('SELECT name,kind,role FROM resources WHERE archived_at IS NULL ORDER BY sort_order, name'),
  plan.prepare("SELECT a.project_id AS projectId,r.name AS name,MAX(a.count) AS max FROM assignments a JOIN resources r ON r.id = a.resource_id WHERE r.kind = 'contractor' AND r.archived_at IS NULL AND a.assignment_type = 'project' AND a.project_id IS NOT NULL GROUP BY a.project_id,r.id"),
 ]);
 return{
  assigned:assigned.results.map(a=>({projectId:String(a.projectId||''),name:String(a.name||''),max:Number(a.max)||1})),
  employees:resources.results.filter(r=>r.kind==='employee').map(r=>({name:r.name||'',role:r.role||''})),
  contractors:resources.results.filter(r=>r.kind==='contractor').map(r=>({name:r.name||''})),
  projects:projects.results.map(p=>({id:p.id||'',name:p.name||'',address:p.address||'',email:p.email||'',orderNumber:p.orderNumber||'',number:p.number||'',customer:p.customer||'',foreman:p.foreman||'',contacts:contacts.results.filter(c=>c.customerId===p.customerId).map(c=>({name:c.name||'',role:c.role||'',email:c.email||'',phone:c.phone||c.mobile||''}))})) as PlanProject[],
 };
}

// Who Montageplanung has assigned to a project on one day.
export async function readPlanDay(projectId:string,day:string):Promise<PlanDay>{
 const plan=(env as unknown as {PLAN_DB?:D1Database}).PLAN_DB;if(!plan||!/^\d{4}-\d{2}-\d{2}$/.test(day))return{employees:[],contractors:[]};
 const rows=await plan.prepare("SELECT r.name AS name,r.kind AS kind,a.count AS count FROM assignments a JOIN resources r ON r.id = a.resource_id WHERE a.project_id = ? AND a.day = ? AND a.assignment_type = 'project' AND r.archived_at IS NULL ORDER BY r.name").bind(projectId,day).all<Row>();
 return{employees:rows.results.filter(r=>r.kind==='employee').map(r=>r.name||''),contractors:rows.results.filter(r=>r.kind==='contractor').map(r=>({name:r.name||'',count:Math.max(1,Number(r.count)||1)}))};
}

// Employees Montageplanung has assigned to a project on any day.
export async function readPlanPeople(projectId:string):Promise<string[]>{
 const plan=(env as unknown as {PLAN_DB?:D1Database}).PLAN_DB;if(!plan)return[];
 const rows=await plan.prepare("SELECT DISTINCT r.name AS name FROM assignments a JOIN resources r ON r.id = a.resource_id WHERE a.project_id = ? AND r.kind = 'employee' AND r.archived_at IS NULL AND a.assignment_type = 'project' ORDER BY r.name").bind(projectId).all<Row>();
 return rows.results.map(r=>r.name||'');
}
