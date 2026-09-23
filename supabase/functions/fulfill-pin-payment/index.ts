import {createClient} from "npm:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
async function hash(v:string){const b=new TextEncoder().encode(v);const h=await crypto.subtle.digest("SHA-256",b);return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,"0")).join("");}
function pin(){return String(Math.floor(100000+Math.random()*900000));}
Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  const auth=req.headers.get("Authorization");if(!auth)return Response.json({error:"Unauthorized"},{status:401,headers:cors});
  const sb=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_PUBLISHABLE_KEY")||Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:auth}}});
  const {data:{user}}=await sb.auth.getUser();if(!user)return Response.json({error:"Unauthorized"},{status:401,headers:cors});
  const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const {data:pr}=await admin.from("profiles").select("role,active").eq("id",user.id).single();
  if(!pr?.active||!['admin','registry'].includes(pr.role))return Response.json({error:"Forbidden"},{status:403,headers:cors});
  const {payment_id}=await req.json();if(!payment_id)return Response.json({error:"Missing payment"},{status:400,headers:cors});
  const {data:p}=await admin.from("payments").select("id,purpose,status,fulfillment_status,receipt_no,metadata").eq("id",payment_id).single();
  if(!p)return Response.json({error:"Payment not found"},{status:404,headers:cors});
  if(p.status!=="successful")return Response.json({error:"Payment is not successful."},{status:400,headers:cors});
  if(p.purpose!=="result_pin")return Response.json({error:"This payment is not for a result PIN."},{status:400,headers:cors});
  if(p.fulfillment_status==="fulfilled")return Response.json({error:"This payment has already been fulfilled."},{status:409,headers:cors});
  const pepper=Deno.env.get("RESULT_PIN_PEPPER");if(!pepper)return Response.json({error:"RESULT_PIN_PEPPER is not configured."},{status:500,headers:cors});
  let raw="";let insertedId="";
  for(let i=0;i<10;i++){
    const candidate=pin();const pin_hash=await hash(candidate+pepper);
    const {data, error}=await admin.from("result_pins").insert({pin_hash,status:"active",max_uses:1,uses:0,created_by:user.id}).select("id").single();
    if(!error&&data){raw=candidate;insertedId=data.id;break;}
  }
  if(!raw||!insertedId)return Response.json({error:"Unable to issue a unique PIN. Please try again."},{status:500,headers:cors});
  const metadata={...(p.metadata||{}),pin_issued:true,issued_pin_id:insertedId};
  const {error}=await admin.from("payments").update({fulfillment_status:"fulfilled",fulfilled_at:new Date().toISOString(),fulfilled_by:user.id,metadata}).eq("id",payment_id).neq("fulfillment_status","fulfilled");
  if(error)return Response.json({error:error.message},{status:500,headers:cors});
  return Response.json({pin:raw,receipt_no:p.receipt_no},{headers:cors});
});
