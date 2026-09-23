import { createClient } from "npm:@supabase/supabase-js@2";
function rand(n=12){const a="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";let s="";const x=new Uint32Array(n);crypto.getRandomValues(x);for(const v of x)s+=a[v%a.length];return s}
Deno.serve(async req=>{
 const auth=req.headers.get("Authorization");if(!auth)return Response.json({error:"Unauthorized"},{status:401});
 const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
 const userClient=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_PUBLISHABLE_KEY")||Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:auth}}});
 const {data:{user}}=await userClient.auth.getUser();if(!user)return Response.json({error:"Unauthorized"},{status:401});
 const {data:p}=await admin.from("profiles").select("role").eq("id",user.id).single();if(!["registry","admin"].includes(p?.role))return Response.json({error:"Forbidden"},{status:403});
 const {quantity=1,max_uses=1,expires_at=null}=await req.json();if(quantity<1||quantity>500)return Response.json({error:"Invalid quantity"},{status:400});
 const out=[];const pepper=Deno.env.get("RESULT_PIN_PEPPER")!;
 for(let i=0;i<quantity;i++){const raw=rand();const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw+pepper));const hash=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");await admin.from("result_pins").insert({pin_hash:hash,max_uses,expires_at,created_by:user.id});out.push(raw)}
 await admin.from("audit_logs").insert({actor_id:user.id,action:"issue_result_pins",metadata:{quantity,max_uses}});
 return Response.json({pins:out});
});