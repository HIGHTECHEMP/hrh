import { createClient } from "npm:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(x:any,status=200)=>Response.json(x,{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async req=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  const auth=req.headers.get("Authorization"); if(!auth) return json({error:"Unauthorized"},401);
  const sb=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_PUBLISHABLE_KEY")||Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:auth}}});
  const {data:{user}}=await sb.auth.getUser(); if(!user) return json({error:"Unauthorized"},401);
  const {fee_id,reference}=await req.json(); if(!fee_id) return json({error:"A fee must be selected."},400);
  const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const {data:fee,error:fe}=await admin.from("fee_catalog").select("id,code,name,amount,currency,active").eq("id",fee_id).single();
  if(fe||!fee||!fee.active||Number(fee.amount)<=0) return json({error:"This fee is not currently available for payment."},400);
  const {data:profile}=await admin.from("profiles").select("email,full_name,exam_number,matric_no").eq("id",user.id).maybeSingle();
  const email=user.email||profile?.email; if(!email) return json({error:"No email is available for this account."},400);
  const tx_ref=`HR-${crypto.randomUUID()}`;
  const receipt_no=`HRR-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${crypto.randomUUID().slice(0,6).toUpperCase()}`;
  const purpose=fee.code;
  const {data:payment,error:pe}=await admin.from("payments").insert({tx_ref,purpose,customer_email:email,amount:Number(fee.amount),currency:fee.currency,payer_user_id:user.id,fee_id:fee.id,receipt_no,metadata:{reference:reference||null,user_id:user.id,fee_code:fee.code}}).select("id").single();
  if(pe) return json({error:pe.message},500);
  const res=await fetch("https://api.flutterwave.com/v3/payments",{method:"POST",headers:{"Authorization":`Bearer ${Deno.env.get("FLW_SECRET_KEY")!}`,"Content-Type":"application/json"},body:JSON.stringify({tx_ref,amount:Number(fee.amount),currency:fee.currency,redirect_url:`${Deno.env.get("SITE_URL")}/payment-return.html?tx_ref=${encodeURIComponent(tx_ref)}`,customer:{email,name:profile?.full_name||"Holy Rosary Student"},customizations:{title:"Holy Rosary Hospital Emekuku",description:fee.name},meta:{payment_id:payment.id,reference:reference||"",fee_code:fee.code}})});
  const out=await res.json();
  if(!res.ok||out.status!=="success"||!out.data?.link){await admin.from("payments").update({status:"failed"}).eq("id",payment.id);return json({error:"Flutterwave checkout creation failed."},502);}
  return json({link:out.data.link,tx_ref,receipt_no,amount:fee.amount,currency:fee.currency});
});
