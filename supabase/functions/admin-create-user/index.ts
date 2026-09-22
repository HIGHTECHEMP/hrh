import { createClient } from "npm:@supabase/supabase-js@2";
Deno.serve(async req=>{
 const auth=req.headers.get("Authorization");if(!auth)return Response.json({error:"Unauthorized"},{status:401});
 const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
 const userClient=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_PUBLISHABLE_KEY")||Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:auth}}});
 const {data:{user}}=await userClient.auth.getUser();if(!user)return Response.json({error:"Unauthorized"},{status:401});
 const {data:actor}=await admin.from("profiles").select("role").eq("id",user.id).single();if(actor?.role!=="admin")return Response.json({error:"Forbidden"},{status:403});
 const {email,full_name,role,staff_no}=await req.json();if(!email||!full_name||!["lecturer","registry","admin"].includes(role))return Response.json({error:"Invalid fields"},{status:400});
 const {data:created,error}=await admin.auth.admin.inviteUserByEmail(email,{data:{full_name}});
 if(error)return Response.json({error:error.message},{status:400});
 const {error:pe}=await admin.from("profiles").insert({id:created.user.id,email,full_name,role,staff_no,active:true});
 if(pe)return Response.json({error:pe.message},{status:500});
 await admin.from("audit_logs").insert({actor_id:user.id,action:"create_staff_user",entity_type:"profile",entity_id:created.user.id,metadata:{email,role}});
 return Response.json({ok:true,user_id:created.user.id});
});