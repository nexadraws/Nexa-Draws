import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'};
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
 try{
  const url=Deno.env.get('SUPABASE_URL')!, anon=Deno.env.get('SUPABASE_ANON_KEY')!, service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const adminUid=Deno.env.get('FLIGHT_ADMIN_UID');
  const auth=createClient(url,anon,{global:{headers:{Authorization:req.headers.get('Authorization')||''}}});
  const {data:{user}}=await auth.auth.getUser(); if(!user) throw new Error('Sign in required');
  const admin=createClient(url,service);
  const {data:comp,error:ce}=await admin.from('skill_competitions').select('*').eq('slug','flight-challenge-250').in('status',['test','live']).single();
  if(ce||!comp) throw new Error('Challenge unavailable');
  if(comp.closes_at && new Date(comp.closes_at).getTime()<=Date.now()) throw new Error('Challenge closed');
  const seed=1;

  // TEST mode is unlimited beta play for signed-in users, including the admin.
  // Paid entitlement is enforced automatically when the competition is switched LIVE.
  const usePaidEntitlement=comp.status==='live';
  if(!usePaidEntitlement){
   const {data:attempt,error}=await admin.from('skill_attempts').insert({competition_id:comp.id,user_id:user.id,entitlement_source:'test',status:'started',game_version:comp.game_version,seed,started_at:new Date().toISOString()}).select('id,game_version,seed').single();
   if(error) throw error;
   return Response.json({success:true,attempt,mode:'test'},{headers:cors});
  }

  const {data:purchases,error:pe}=await admin.from('skill_purchases').select('id,order_reference,attempts_total,attempts_used').eq('competition_id',comp.id).eq('user_id',user.id).eq('status','paid').order('paid_at',{ascending:true});
  if(pe) throw pe;
  const purchase=(purchases||[]).find((p:any)=>p.attempts_used<p.attempts_total);
  if(!purchase) throw new Error('No paid attempts available');
  const {data:claimed,error:claimError}=await admin.from('skill_purchases').update({attempts_used:purchase.attempts_used+1,updated_at:new Date().toISOString()}).eq('id',purchase.id).eq('attempts_used',purchase.attempts_used).select('id,order_reference').maybeSingle();
  if(claimError) throw claimError;
  if(!claimed) throw new Error('Attempt credit already being used; please try again');
  const {data:attempt,error}=await admin.from('skill_attempts').insert({competition_id:comp.id,user_id:user.id,entitlement_source:'payment',payment_reference:claimed.order_reference,status:'started',game_version:comp.game_version,seed,started_at:new Date().toISOString()}).select('id,game_version,seed').single();
  if(error){
   await admin.from('skill_purchases').update({attempts_used:purchase.attempts_used,updated_at:new Date().toISOString()}).eq('id',purchase.id).eq('attempts_used',purchase.attempts_used+1);
   throw error;
  }
  const remaining=(purchases||[]).reduce((sum:any,p:any)=>sum+Math.max(0,Number(p.attempts_total||0)-Number(p.attempts_used||0)),0)-1;
  return Response.json({success:true,attempt,mode:'paid',attempts_remaining:Math.max(0,remaining)},{headers:cors});
 }catch(e){const message=e instanceof Error?e.message:String(e);console.error('start-flight-attempt error:',message,e);return Response.json({success:false,error:message},{status:400,headers:cors})}
});