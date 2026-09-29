import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
};

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
  try{
    const url=Deno.env.get('SUPABASE_URL');
    const anon=Deno.env.get('SUPABASE_ANON_KEY');
    const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if(!url||!anon||!service) throw new Error('Server configuration missing');

    const auth=createClient(url,anon,{global:{headers:{Authorization:req.headers.get('Authorization')||''}}});
    const {data:{user},error:authError}=await auth.auth.getUser();
    if(authError||!user) return Response.json({success:false,error:'Sign in required'},{status:401,headers:cors});

    const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:comp,error:compError}=await admin.from('skill_competitions')
      .select('id,status,closes_at')
      .eq('slug','flight-challenge-250')
      .in('status',['test','live'])
      .single();
    if(compError||!comp) throw new Error('Challenge unavailable');

    if(comp.status==='test'){
      return Response.json({success:true,mode:'test',attempts_remaining:null},{headers:cors});
    }

    const {data:purchases,error:purchaseError}=await admin.from('skill_purchases')
      .select('attempts_total,attempts_used')
      .eq('competition_id',comp.id)
      .eq('user_id',user.id)
      .eq('status','paid');
    if(purchaseError) throw purchaseError;

    const remaining=(purchases||[]).reduce((sum:any,p:any)=>sum+Math.max(0,Number(p.attempts_total||0)-Number(p.attempts_used||0)),0);
    return Response.json({success:true,mode:'paid',attempts_remaining:remaining},{headers:cors});
  }catch(e){
    const message=e instanceof Error?e.message:String(e);
    console.error('get-flight-status error:',message,e);
    return Response.json({success:false,error:message},{status:400,headers:cors});
  }
});