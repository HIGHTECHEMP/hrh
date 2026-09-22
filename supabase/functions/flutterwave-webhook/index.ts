import { createClient } from "npm:@supabase/supabase-js@2";
Deno.serve(async req=>{
 if(req.method!=="POST")return new Response("Method not allowed",{status:405});
 const hash=req.headers.get("verif-hash"); if(!hash||hash!==Deno.env.get("FLW_WEBHOOK_HASH"))return new Response("Forbidden",{status:403});
 const payload=await req.json(); const tx=payload?.data; if(!tx?.id||!tx?.tx_ref)return new Response("Bad request",{status:400});
 const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
 const {data:p}=await admin.from("payments").select("*").eq("tx_ref",tx.tx_ref).single(); if(!p)return new Response("Unknown reference",{status:404});
 const verify=await fetch(`https://api.flutterwave.com/v3/transactions/${tx.id}/verify`,{headers:{Authorization:`Bearer ${Deno.env.get("FLW_SECRET_KEY")!}`}});
 const v=await verify.json(); const d=v?.data;
 const valid=v?.status==="success"&&d?.status==="successful"&&d?.tx_ref===p.tx_ref&&d?.currency===p.currency&&Number(d?.amount)>=Number(p.amount);
 if(valid){await admin.from("payments").update({status:"successful",flutterwave_transaction_id:String(tx.id),paid_at:new Date().toISOString()}).eq("id",p.id);}
 else {await admin.from("payments").update({status:"failed",flutterwave_transaction_id:String(tx.id)}).eq("id",p.id);}
 return new Response("OK",{status:200});
});