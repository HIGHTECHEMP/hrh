import { createClient } from "npm:@supabase/supabase-js@2";
const json=(x:any,s=200)=>Response.json(x,{status:s,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type"}});
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok");
 const {pin,matric_no,semester,examination,academic_year}=await req.json().catch(()=>({}));
 if(!pin||!matric_no||!semester||!examination||!academic_year)return json({error:"Missing fields"},400);
 const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
 // Production lookup uses a peppered server-side comparison. The raw PIN never enters Postgres.
 const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(pin+Deno.env.get("RESULT_PIN_PEPPER")));
 const b=[...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,"0")).join("");
 const {data:pins}=await admin.from("result_pins").select("id,expires_at,uses,max_uses,status,pin_hash").eq("status","active");
 const pinRow=pins?.find((p:any)=>p.pin_hash===b);
 if(!pinRow|| (pinRow.expires_at&&new Date(pinRow.expires_at)<new Date()) || pinRow.uses>=pinRow.max_uses)return json({error:"Invalid or expired PIN"},401);
 const {data:student}=await admin.from("profiles").select("id,full_name,matric_no,school_id").eq("matric_no",matric_no).eq("role","student").single();
 if(!student)return json({error:"Student not found"},404);
 const {data:results}=await admin.from("results").select("semester,examination,academic_year,grade,gp,gpa,cgpa,total_score").eq("student_id",student.id).eq("semester",semester).eq("examination",examination).eq("academic_year",academic_year).eq("status","published");
 if(!results?.length)return json({error:"Published result not found"},404);
 await admin.from("result_pins").update({uses:pinRow.uses+1,status:pinRow.uses+1>=pinRow.max_uses?"used":"active"}).eq("id",pinRow.id);
 await admin.from("result_pin_access").insert({pin_id:pinRow.id,matric_no});
 return json({student:{full_name:student.full_name,matric_no:student.matric_no},results});
});