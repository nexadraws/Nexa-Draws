'use strict';
(() => {
 const SUPABASE_URL='https://hkxegnjlxuscusygckqm.supabase.co';
 const SUPABASE_KEY='sb_publishable_kO22Zj703int4nZp8ha9jg_hwgz5f9X';
 const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
 const canvas=document.getElementById('game'),ctx=canvas.getContext('2d'),scoreEl=document.getElementById('score'),bestEl=document.getElementById('best');
 const leaderboardList=document.getElementById('leaderboardList');
 const overlay=document.getElementById('overlay'),title=document.getElementById('overlayTitle'),copy=document.getElementById('overlayText'),play=document.getElementById('playBtn'),restart=document.getElementById('restartBtn');
 const W=900,H=520,ground=54,DT=1/120,cfg={gravity:1550,flap:-470,speed:220,gap:170,pipeW:86,spawn:1.48,birdX:210,radius:19};
 const seq=[.42,.56,.35,.61,.47,.31,.53,.39,.58,.44,.34,.50];
 let running=false,last=0,acc=0,spawn=.75,score=0,best=Number(localStorage.getItem('nexa_flight_best')||0),bird,pipes=[],gateIndex=0,tick=0,taps=[],attemptId=null,ending=false;
 bestEl.textContent=best;
 function setupHD(){
   const dpr=Math.min(window.devicePixelRatio||1,3);
   canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);
   canvas.style.aspectRatio=W+'/'+H;
   ctx.setTransform(dpr,0,0,dpr,0,0);
   ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 }
 function reset(){bird={x:cfg.birdX,y:H*.48,vy:0};pipes=[];spawn=.75;score=0;gateIndex=0;tick=0;taps=[];last=0;acc=0;ending=false;scoreEl.textContent='0'}
 function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
 function shortPlayer(id){return id?'Player '+String(id).slice(0,4).toUpperCase():'Player'}
 async function loadLeaderboard(){
   if(!leaderboardList)return;
   const {data,error}=await sb.from('skill_leaderboard').select('user_id,best_score').eq('competition_slug','flight-challenge-250').order('best_score',{ascending:false}).limit(10);
   if(error){leaderboardList.innerHTML='<p class="leaderboard-empty">Leaderboard will appear here when available.</p>';return}
   if(!data?.length){leaderboardList.innerHTML='<p class="leaderboard-empty">No verified scores yet. Set the first one!</p>';return}
   leaderboardList.innerHTML=data.map((row,i)=>'<div class="leaderboard-row"><span class="leaderboard-rank">'+(i<3?['🥇','🥈','🥉'][i]:'#'+(i+1))+'</span><span class="leaderboard-name">'+shortPlayer(row.user_id)+'<small>VERIFIED</small></span><strong class="leaderboard-score">'+Number(row.best_score||0)+'</strong></div>').join('');
 }
 async function countdown(){title.textContent='GET READY';copy.textContent='3';overlay.classList.remove('hidden');for(const n of ['3','2','1']){copy.textContent=n;await wait(700)}copy.textContent='GO!';await wait(350);overlay.classList.add('hidden')}
 async function start(){
   play.disabled=true;copy.textContent='Creating secure test attempt…';
   const {data:{session}}=await sb.auth.getSession();
   if(!session){title.textContent='SIGN IN REQUIRED';copy.textContent='Please sign in through NexaDraw My Account first, then return to the Flight Challenge.';play.textContent='TRY AGAIN';play.disabled=false;return}
   const {data,error}=await sb.functions.invoke('start-flight-attempt');
   if(error||!data?.success){title.textContent='TEST SETUP NEEDED';copy.textContent=data?.error||'The secure test-attempt function is not deployed yet.';play.textContent='TRY AGAIN';play.disabled=false;return}
   attemptId=data.attempt.id;reset();await countdown();running=true;play.disabled=false;requestAnimationFrame(loop);
 }
 function flap(){if(!running)return;if(taps[taps.length-1]!==tick)taps.push(tick);bird.vy=cfg.flap}
 function gateY(i){return 92+seq[i%seq.length]*(H-ground-184)}
 function addPipe(){pipes.push({x:W+20,cy:gateY(gateIndex++),passed:false})}
 function step(){
   bird.vy+=cfg.gravity*DT;bird.y+=bird.vy*DT;spawn-=DT;
   if(spawn<=0){addPipe();spawn+=cfg.spawn}
   for(const p of pipes){p.x-=cfg.speed*DT;if(!p.passed&&p.x+cfg.pipeW<bird.x){p.passed=true;score++;scoreEl.textContent=score}}
   pipes=pipes.filter(p=>p.x+cfg.pipeW>-10);
   let dead=bird.y-cfg.radius<0||bird.y+cfg.radius>H-ground;
   if(!dead)for(const p of pipes){const within=bird.x+cfg.radius>p.x&&bird.x-cfg.radius<p.x+cfg.pipeW,top=p.cy-cfg.gap/2,bottom=p.cy+cfg.gap/2;if(within&&(bird.y-cfg.radius<top||bird.y+cfg.radius>bottom)){dead=true;break}}
   tick++; if(dead)finish();
 }
 async function finish(){
   if(ending)return;ending=true;running=false;title.textContent='VERIFYING RUN';copy.textContent='NexaDraw is replaying your inputs on the server…';overlay.classList.remove('hidden');play.disabled=true;
   const {data,error}=await sb.functions.invoke('verify-flight-attempt',{body:{attempt_id:attemptId,taps,end_tick:tick}});
   if(error||!data?.success){title.textContent='RUN NOT VERIFIED';copy.textContent=data?.error||'This run could not be verified.';play.textContent='NEW TEST';play.disabled=false;return}
   score=data.score;scoreEl.textContent=score;if(score>best){best=score;localStorage.setItem('nexa_flight_best',String(best));bestEl.textContent=best}
   title.textContent='VERIFIED SCORE';copy.textContent='Server-verified score: '+score+' — Best on this device: '+best+'.';play.textContent='PLAY AGAIN';play.disabled=false;loadLeaderboard();
 }
 function pipe(x,y,h,capBottom){const g=ctx.createLinearGradient(x,0,x+cfg.pipeW,0);g.addColorStop(0,'#70470a');g.addColorStop(.25,'#e6ad25');g.addColorStop(.52,'#fff0a0');g.addColorStop(.75,'#c28713');g.addColorStop(1,'#573606');ctx.fillStyle=g;ctx.strokeStyle='#493005';ctx.lineWidth=4;ctx.fillRect(x,y,cfg.pipeW,h);ctx.strokeRect(x,y,cfg.pipeW,h);const capY=capBottom?y:y+h-26;ctx.fillRect(x-10,capY,cfg.pipeW+20,26);ctx.strokeRect(x-10,capY,cfg.pipeW+20,26)}
 function draw(){ctx.save();const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#f9d875');sky.addColorStop(.42,'#c78b20');sky.addColorStop(1,'#3d2808');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);const glow=ctx.createRadialGradient(W*.48,H*.42,10,W*.48,H*.42,230);glow.addColorStop(0,'rgba(255,248,190,.72)');glow.addColorStop(.45,'rgba(255,215,100,.18)');glow.addColorStop(1,'rgba(255,210,70,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);ctx.globalAlpha=.16;ctx.fillStyle='#fff9cf';for(let i=0;i<34;i++){const x=(i*137)%W,y=(i*83)%360,r=1+(i%3);ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;ctx.fillStyle='#5a3a0c';for(let x=0;x<W;x+=38){const h=35+((x*17)%85);ctx.fillRect(x,H-ground-h,30,h)}for(const p of pipes){const top=p.cy-cfg.gap/2,bottom=p.cy+cfg.gap/2;pipe(p.x,0,top,false);pipe(p.x,bottom,H-ground-bottom,true)}ctx.fillStyle='#2a1a04';ctx.fillRect(0,H-ground,W,ground);ctx.strokeStyle='#e0a92a';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(0,H-ground);ctx.lineTo(W,H-ground);ctx.stroke();ctx.save();ctx.translate(bird.x,bird.y);ctx.rotate(Math.max(-.35,Math.min(.7,bird.vy/850)));ctx.fillStyle='#111';ctx.strokeStyle='#ffd45c';ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,cfg.radius,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#ffd45c';ctx.font='900 24px Montserrat,Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('N',0,1);ctx.beginPath();ctx.moveTo(-17,-2);ctx.lineTo(-38,-16);ctx.lineTo(-28,3);ctx.lineTo(-40,12);ctx.lineTo(-17,9);ctx.fill();ctx.beginPath();ctx.moveTo(17,-2);ctx.lineTo(38,-16);ctx.lineTo(28,3);ctx.lineTo(40,12);ctx.lineTo(17,9);ctx.fill();ctx.restore();ctx.restore()}
 function loop(t){if(!running)return;if(!last)last=t;acc+=Math.min((t-last)/1000,.1);last=t;while(acc>=DT&&running){step();acc-=DT}draw();if(running)requestAnimationFrame(loop)}
 play.addEventListener('click',start);restart.addEventListener('click',()=>{if(!running)start()});canvas.addEventListener('pointerdown',e=>{e.preventDefault();flap()});window.addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();flap()}});
 setupHD();reset();draw();loadLeaderboard();window.addEventListener('resize',()=>{setupHD();draw()});
})();