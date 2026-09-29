import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'};
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
 try{
  const url=Deno.env.get('SUPABASE_URL')!, anon=Deno.env.get('SUPABASE_ANON_KEY')!, service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const auth=createClient(url,anon,{global:{headers:{Authorization:req.headers.get('Authorization')||''}}});
  const {data:{user}}=await auth.auth.getUser(); if(!user) throw new Error('Sign in required');
  const admin=createClient(url,service);
  const {data:comp,error:ce}=await admin.from('skill_competitions').select('*').eq('slug','flight-challenge-250').in('status',['test','live']).single();
  if(ce||!comp) throw new Error('Challenge unavailable');
  // TEST ONLY. Live mode must consume a paid entitlement instead of minting attempts here.
  if(comp.status!=='test') throw new Error('Paid attempt issuance is not enabled yet');
  const seed=1; // v1 uses a fixed deterministic course for equal conditions.
  const {data:attempt,error}=await admin.from('skill_attempts').insert({competition_id:comp.id,user_id:user.id,entitlement_source:'test',status:'started',game_version:comp.game_version,seed,started_at:new Date().toISOString()}).select('id,game_version,seed').single();
  if(error) throw error;
  return Response.json({success:true,attempt},{headers:cors});
 }catch(e){return Response.json({success:false,error:e.message},{status:400,headers:cors})}
});