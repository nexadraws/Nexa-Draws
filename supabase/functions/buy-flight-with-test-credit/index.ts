import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
 if(req.method!=="POST") return json({success:false,error:"Method not allowed"},405);
 try{
  const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),adminUid=Deno.env.get("FLIGHT_ADMIN_UID");
  if(!url||!anon||!service||!adminUid) return json({success:false,error:"Server configuration missing"},500);
  const auth=createClient(url,anon,{global:{headers:{Authorization:req.headers.get("Authorization")||""}}});
  const {data:{user}}=await auth.auth.getUser();
  if(!user) return json({success:false,error:"Sign in required"},401);
  if(user.id!==adminUid) return json({success:false,error:"Administrator access required"},403);

  const body=await req.json().catch(()=>({}));
  const packageId=String(body?.package_id||"");
  const packages:Record<string,{amountPence:number;attempts:number}>={single:{amountPence:100,attempts:1},five:{amountPence:400,attempts:5},ten:{amountPence:700,attempts:10}};
  const selected=packages[packageId];
  if(!selected) return json({success:false,error:"Invalid Flight package"},400);

  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:comp,error:ce}=await admin.from("skill_competitions").select("id,status,closes_at").eq("slug","flight-challenge-250").single();
  if(ce||!comp||!["test","live"].includes(comp.status)) return json({success:false,error:"Flight Challenge is unavailable"},409);
  if(comp.closes_at&&new Date(comp.closes_at).getTime()<=Date.now()) return json({success:false,error:"Challenge closed"},409);

  const {data:remaining,error:spendError}=await admin.rpc("spend_flight_test_credit",{p_user_id:user.id,p_amount_pence:selected.amountPence});
  if(spendError) return json({success:false,error:"Insufficient test credit"},409);

  const reference="test-credit:"+crypto.randomUUID();
  const {data:purchase,error:pe}=await admin.from("skill_purchases").insert({
   competition_id:comp.id,user_id:user.id,provider:"test_credit",order_reference:reference,
   amount_pence:selected.amountPence,currency:"GBP",status:"paid",attempts_total:selected.attempts,attempts_used:0,paid_at:new Date().toISOString()
  }).select("id").single();

  if(pe||!purchase){
   // Refund the ledger if entitlement creation fails.
   await admin.from("skill_test_credit").update({balance_pence:Number(remaining)+selected.amountPence,updated_at:new Date().toISOString()}).eq("user_id",user.id);
   throw pe||new Error("Could not create test entitlement");
  }

  return json({success:true,test_credit:true,attempts:selected.attempts,spent_pence:selected.amountPence,balance_pence:Number(remaining),purchase_id:purchase.id});
 }catch(e){
  const message=e instanceof Error?e.message:String(e);
  console.error("buy-flight-with-test-credit error:",message,e);
  return json({success:false,error:message},400);
 }
});