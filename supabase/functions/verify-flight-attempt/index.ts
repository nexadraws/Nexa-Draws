import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'};
const DT=1/120, GRAVITY=1550, FLAP=-470, SPEED=220, GAP=170, PIPE_W=86, BIRD_X=210, R=19, W=900, H=520, GROUND=54, SPAWN=1.48;
const seq=[.42,.56,.35,.61,.47,.31,.53,.39,.58,.44,.34,.50];
function gateY(i:number){return 92+seq[i%seq.length]*(H-GROUND-184)}
function coinY(cy:number,i:number){const margin=R+17,reach=GAP/2-margin,offsets=[-.78,.72,-.58,.84,-.88,.62,.76,-.69,.9,-.52,.67,-.82];return cy+offsets[i%offsets.length]*reach}
function simulate(taps:number[],endTick:number){
 let y=H*.48,vy=0,spawn=.75,score=0,gi=0,dead=false; const pipes:any[]=[]; let ti=0;
 for(let tick=0;tick<endTick&&tick<120*60*20;tick++){
  while(ti<taps.length&&taps[ti]===tick){vy=FLAP;ti++}
  vy+=GRAVITY*DT;y+=vy*DT;spawn-=DT;
  if(spawn<=0){{const i=gi,cy=gateY(gi++);pipes.push({x:W+20,cy,coinY:coinY(cy,i),passed:false,coin:true})};spawn+=SPAWN}
  for(const p of pipes){
   p.x-=SPEED*DT;
   if(p.coin){const cx=p.x+PIPE_W/2,cy=p.coinY,dx=BIRD_X-cx,dy=y-cy;if(dx*dx+dy*dy<(R+14)*(R+14)){p.coin=false;score+=2}}
   if(!p.passed&&p.x+PIPE_W<BIRD_X){p.passed=true;score++}
  }
  if(y-R<0||y+R>H-GROUND){dead=true;break}
  for(const p of pipes){const within=BIRD_X+R>p.x&&BIRD_X-R<p.x+PIPE_W,top=p.cy-GAP/2,bottom=p.cy+GAP/2;if(within&&(y-R<top||y+R>bottom)){dead=true;break}}
  if(dead)break;
 }
 return {score,dead};
}
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
 try{
  const url=Deno.env.get('SUPABASE_URL')!, anon=Deno.env.get('SUPABASE_ANON_KEY')!, service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const auth=createClient(url,anon,{global:{headers:{Authorization:req.headers.get('Authorization')||''}}}); const {data:{user}}=await auth.auth.getUser(); if(!user) throw new Error('Sign in required');
  const {attempt_id,taps,end_tick}=await req.json();
  if(!attempt_id||!Array.isArray(taps)||!Number.isInteger(end_tick)) throw new Error('Invalid replay');
  if(taps.length>20000||end_tick<1||end_tick>144000) throw new Error('Replay outside limits');
  let prev=-1; for(const t of taps){if(!Number.isInteger(t)||t<0||t> end_tick||t<=prev) throw new Error('Invalid tap sequence');prev=t}
  const admin=createClient(url,service); const {data:a,error:ae}=await admin.from('skill_attempts').select('*').eq('id',attempt_id).eq('user_id',user.id).single();
  if(ae||!a) throw new Error('Attempt not found'); if(a.status!=='started') throw new Error('Attempt already consumed'); if(a.game_version!=='flight-v1') throw new Error('Unsupported game version');
  const result=simulate(taps,end_tick); if(!result.dead) throw new Error('Run must end in a collision');
  const replay={taps,end_tick}; const bytes=new TextEncoder().encode(JSON.stringify(replay)); const digest=await crypto.subtle.digest('SHA-256',bytes); const hash=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
  const {error:ue}=await admin.from('skill_attempts').update({status:'verified',score:result.score,replay, replay_hash:hash,submitted_at:new Date().toISOString(),verified_at:new Date().toISOString()}).eq('id',a.id).eq('status','started');
  if(ue) throw ue;
  return Response.json({success:true,score:result.score},{headers:cors});
 }catch(e){return Response.json({success:false,error:e.message},{status:400,headers:cors})}
});