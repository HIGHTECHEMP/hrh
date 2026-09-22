import {createClient} from "npm:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
Deno.serve(async req=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  const auth=req.headers.get("Authorization"); if(!auth)return Response.json({error:"Unauthorized"},{status:401,headers:cors});
  const sb=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_PUBLISHABLE_KEY")||Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:auth}}});
  const {data:{user}}=await sb.auth.getUser(); if(!user)return Response.json({error:"Unauthorized"},{status:401,headers:cors});
  const {tx_ref}=await req.json(); if(!tx_ref)return Response.json({error:"Missing transaction reference"},{status:400,headers:cors});
  const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const {data:p}=await admin.from("payments").select("id,tx_ref,purpose,amount,currency,status,receipt_no,fulfillment_status,paid_at,created_at,payer_user_id,customer_email").eq("tx_ref",tx_ref).single();
  if(!p)return Response.json({error:"Payment not found"},{status:404,headers:cors});
  const allowed=p.payer_user_id===user.id; let role="";
  if(!allowed){const {data:pr}=await admin.from("profiles").select("role").eq("id",user.id).single();role=pr?.role||"";}
  if(!allowed&&!['admin','registry'].includes(role))return Response.json({error:"Forbidden"},{status:403,headers:cors});
  return Response.json({payment:p},{headers:cors});
});
