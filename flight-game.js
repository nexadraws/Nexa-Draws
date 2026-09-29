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
 function pipe(x,y,h,capBottom){
   const g=ctx.createLinearGradient(x,0,x+cfg.pipeW,0);g.addColorStop(0,'#4b2900');g.addColorStop(.12,'#9d5c00');g.addColorStop(.32,'#ffd24a');g.addColorStop(.48,'#fff3a8');g.addColorStop(.62,'#e5a116');g.addColorStop(.84,'#8a4c00');g.addColorStop(1,'#321a00');
   ctx.shadowColor='#ffcf45';ctx.shadowBlur=10;ctx.fillStyle=g;ctx.strokeStyle='#ffdf6b';ctx.lineWidth=2;ctx.fillRect(x,y,cfg.pipeW,h);ctx.strokeRect(x,y,cfg.pipeW,h);ctx.shadowBlur=0;
   const capY=capBottom?y:y+h-30;const cg=ctx.createLinearGradient(x-10,0,x+cfg.pipeW+10,0);cg.addColorStop(0,'#5c3100');cg.addColorStop(.28,'#ffbf1e');cg.addColorStop(.5,'#fff1a0');cg.addColorStop(.72,'#c87900');cg.addColorStop(1,'#452400');ctx.fillStyle=cg;ctx.fillRect(x-11,capY,cfg.pipeW+22,30);ctx.strokeRect(x-11,capY,cfg.pipeW+22,30);
   ctx.fillStyle='#7b4700';ctx.font='900 24px Georgia';ctx.textAlign='center';ctx.fillText('♛',x+cfg.pipeW/2,capBottom?y+62:y+h-58);ctx.font='900 29px Georgia';ctx.fillStyle='#ffe46b';ctx.strokeStyle='#5a3100';ctx.lineWidth=3;ctx.strokeText('N',x+cfg.pipeW/2,capBottom?y+92:y+h-30);ctx.fillText('N',x+cfg.pipeW/2,capBottom?y+92:y+h-30)
 }
 function draw(){
   ctx.save();
   const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#8d520b');sky.addColorStop(.24,'#f0a51d');sky.addColorStop(.52,'#ffc944');sky.addColorStop(.72,'#9a590c');sky.addColorStop(1,'#291603');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
   const sun=ctx.createRadialGradient(W*.68,H*.25,8,W*.68,H*.25,230);sun.addColorStop(0,'rgba(255,255,224,1)');sun.addColorStop(.08,'rgba(255,238,130,.9)');sun.addColorStop(.36,'rgba(255,184,35,.28)');sun.addColorStop(1,'rgba(255,180,0,0)');ctx.fillStyle=sun;ctx.fillRect(0,0,W,H);
   ctx.globalAlpha=.2;ctx.strokeStyle='#fff4a5';ctx.lineWidth=1;for(let i=0;i<18;i++){const a=i*Math.PI/9;ctx.beginPath();ctx.moveTo(W*.68,H*.25);ctx.lineTo(W*.68+Math.cos(a)*500,H*.25+Math.sin(a)*500);ctx.stroke()}ctx.globalAlpha=1;
   ctx.fillStyle='#7a470b';for(let x=0;x<W;x+=27){const hh=35+((x*19)%135);ctx.fillRect(x,H-ground-hh,20,hh);if(x%81===0){ctx.fillRect(x+5,H-ground-hh-22,5,22)}}
   ctx.globalAlpha=.65;ctx.strokeStyle='#ffcf43';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(0,H-ground-35);ctx.quadraticCurveTo(W*.22,H-ground-70,W*.45,H-ground-35);ctx.quadraticCurveTo(W*.68,H-ground-72,W,H-ground-35);ctx.stroke();ctx.globalAlpha=1;
   for(let i=0;i<45;i++){const x=(i*173)%W,y=70+((i*97)%(H-ground-120)),r=i%5===0?3:1.3;ctx.fillStyle=i%4===0?'#fff6bd':'#ffd348';ctx.shadowColor='#ffd33d';ctx.shadowBlur=8;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}ctx.shadowBlur=0;
   for(const p of pipes){const top=p.cy-cfg.gap/2,bottom=p.cy+cfg.gap/2;pipe(p.x,0,top,false);pipe(p.x,bottom,H-ground-bottom,true)}
   const water=ctx.createLinearGradient(0,H-ground,0,H);water.addColorStop(0,'#8e5709');water.addColorStop(1,'#201204');ctx.fillStyle=water;ctx.fillRect(0,H-ground,W,ground);ctx.strokeStyle='#ffd95c';ctx.lineWidth=3;for(let y=H-ground+8;y<H;y+=12){ctx.globalAlpha=.28;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}ctx.globalAlpha=1;
   ctx.save();ctx.translate(bird.x,bird.y);ctx.rotate(Math.max(-.35,Math.min(.7,bird.vy/850)));ctx.shadowColor='#ffcf35';ctx.shadowBlur=15;const bg=ctx.createLinearGradient(-30,-20,30,20);bg.addColorStop(0,'#fff09a');bg.addColorStop(.35,'#f5bd24');bg.addColorStop(1,'#9c5700');ctx.fillStyle=bg;ctx.strokeStyle='#4b2900';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,0,30,21,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle='#f0a800';ctx.beginPath();ctx.moveTo(-20,3);ctx.quadraticCurveTo(-46,-22,-39,7);ctx.quadraticCurveTo(-31,23,-10,12);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#ffdd43';ctx.beginPath();ctx.moveTo(25,-3);ctx.lineTo(46,4);ctx.lineTo(25,11);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(12,-8,8,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#080603';ctx.beginPath();ctx.arc(15,-8,3.5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#171007';ctx.font='900 18px Montserrat,Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('N',-5,1);ctx.fillStyle='#ffd73b';ctx.font='900 14px Georgia';ctx.fillText('♛',-5,-24);ctx.restore();ctx.restore()
 }
 function loop(t){if(!running)return;if(!last)last=t;acc+=Math.min((t-last)/1000,.1);last=t;while(acc>=DT&&running){step();acc-=DT}draw();if(running)requestAnimationFrame(loop)}
 play.addEventListener('click',start);restart.addEventListener('click',()=>{if(!running)start()});canvas.addEventListener('pointerdown',e=>{e.preventDefault();flap()});window.addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();flap()}});
 setupHD();reset();draw();loadLeaderboard();window.addEventListener('resize',()=>{setupHD();draw()});
})();