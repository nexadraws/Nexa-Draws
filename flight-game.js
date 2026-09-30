'use strict';
(() => {
 const SUPABASE_URL='https://hkxegnjlxuscusygckqm.supabase.co';
 const SUPABASE_KEY='sb_publishable_kO22Zj703int4nZp8ha9jg_hwgz5f9X';
 const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
 const canvas=document.getElementById('game'),ctx=canvas.getContext('2d'),scoreEl=document.getElementById('score'),bestEl=document.getElementById('best');
 const leaderboardList=document.getElementById('leaderboardList'),leaderboardStatus=document.getElementById('leaderboardStatus'),attemptBalance=document.getElementById('attemptBalance');
 const overlay=document.getElementById('overlay'),title=document.getElementById('overlayTitle'),copy=document.getElementById('overlayText'),play=document.getElementById('playBtn'),restart=document.getElementById('restartBtn'),packageBtns=[...document.querySelectorAll('.package-btn')],checkoutStatus=document.getElementById('checkoutStatus'),paymentBox=document.getElementById('flightPayment'),paymentMount=document.getElementById('paymentMount'),closePayment=document.getElementById('closePayment');
 const W=900,H=520,ground=54,DT=1/120,cfg={gravity:1550,flap:-470,speed:220,gap:170,pipeW:86,spawn:1.48,birdX:210,radius:19};
 const seq=[.42,.56,.35,.61,.47,.31,.53,.39,.58,.44,.34,.50];
 let running=false,waitingForFirstFlap=false,last=0,acc=0,spawn=.75,score=0,best=Number(localStorage.getItem('nexa_flight_best')||0),bird,pipes=[],gateIndex=0,tick=0,taps=[],attemptId=null,ending=false;
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
 async function loadLeaderboard(){
   if(!leaderboardList)return;
   if(leaderboardStatus)leaderboardStatus.textContent='Refreshing…';
   const {data,error}=await sb.rpc('get_flight_leaderboard');
   if(error){leaderboardList.innerHTML='<p class="leaderboard-empty">Leaderboard will appear here when available.</p>';if(leaderboardStatus)leaderboardStatus.textContent='Refresh unavailable.';return}
   if(!data?.length){leaderboardList.innerHTML='<p class="leaderboard-empty">No verified scores yet. Set the first one!</p>';if(leaderboardStatus)leaderboardStatus.textContent='Updates automatically.';return}
   if(leaderboardStatus)leaderboardStatus.textContent='Updated '+new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+' · auto-refresh 15s';
   leaderboardList.innerHTML=data.map((row,i)=>'<div class="leaderboard-row"><span class="leaderboard-rank">'+(i<3?['🥇','🥈','🥉'][i]:'#'+(i+1))+'</span><span class="leaderboard-name">'+String(row.player_label||'Player')+'<small>VERIFIED</small></span><strong class="leaderboard-score">'+Number(row.best_score||0)+'</strong></div>').join('');
 }
 async function loadAttemptBalance(){
   if(!attemptBalance)return;
   const {data:{session}}=await sb.auth.getSession();
   if(!session){attemptBalance.textContent='Sign in to see your attempts.';return}
   try{
     const {data,error}=await sb.functions.invoke('get-flight-status',{body:{},headers:{Authorization:`Bearer ${session.access_token}`}});
     if(error||!data?.success)throw error||new Error(data?.error||'Status unavailable');
     attemptBalance.textContent=data.mode==='test'?'Unlimited test attempts':data.attempts_remaining+' attempt'+(data.attempts_remaining===1?'':'s')+' remaining';
   }catch(_){attemptBalance.textContent='Attempt balance unavailable.'}
 }
 async function countdown(){title.textContent='GET READY';copy.textContent='3';overlay.classList.remove('hidden');for(const n of ['3','2','1']){copy.textContent=n;await wait(700)}copy.textContent='GO!';await wait(350);overlay.classList.add('hidden')}
 async function start(){
   play.disabled=true;copy.textContent='Preparing your attempt…';
   const {data:{session}}=await sb.auth.getSession();
   if(!session){title.textContent='SIGN IN REQUIRED';copy.textContent='Please sign in to your NexaDraw account, then return to the Flight Challenge.';play.textContent='TRY AGAIN';play.disabled=false;return}
   let data=null,error=null;
   try{
     const result=await sb.functions.invoke('start-flight-attempt',{body:{},headers:{Authorization:`Bearer ${session.access_token}`}});
     data=result.data;error=result.error;
   }catch(e){error=e}
   if(error||!data?.success){
     let message=data?.error||'';
     try{
       const context=error?.context;
       if(context instanceof Response){
         const raw=await context.clone().text();
         try{const detail=JSON.parse(raw);message=detail?.error||detail?.message||raw||message}catch(_){message=raw||message}
         if(!message)message='Start request failed (HTTP '+context.status+').';
       }else if(context?.json){
         const detail=await context.json();message=detail?.error||detail?.message||message;
       }else if(context?.text){
         const detail=await context.text();if(detail)message=detail;
       }
       if(!message&&error?.message)message=error.message;
     }catch(_){if(!message&&error?.message)message=error.message}
     title.textContent='UNABLE TO START';copy.textContent=message||'The attempt could not be started.';play.textContent='TRY AGAIN';play.disabled=false;return
   }
   attemptId=data.attempt.id;if(data.mode==='test'&&attemptBalance)attemptBalance.textContent='Unlimited test attempts';else if(Number.isFinite(data.attempts_remaining)&&attemptBalance)attemptBalance.textContent=data.attempts_remaining+' attempt'+(data.attempts_remaining===1?'':'s')+' remaining';reset();await countdown();waitingForFirstFlap=true;title.textContent='YOUR TURN';copy.textContent='Click, tap or press Space to make the first move.';overlay.classList.remove('hidden');play.style.display='none';play.disabled=false;
 }
 function flap(){if(waitingForFirstFlap){waitingForFirstFlap=false;overlay.classList.add('hidden');play.style.display='';running=true;if(taps[taps.length-1]!==tick)taps.push(tick);bird.vy=cfg.flap;requestAnimationFrame(loop);return}if(!running)return;if(taps[taps.length-1]!==tick)taps.push(tick);bird.vy=cfg.flap}
 function gateY(i){return 92+seq[i%seq.length]*(H-ground-184)}
 function coinSpec(cy,i){
   // Deterministic "random" course pattern: only some gates carry a coin,
   // with deliberately awkward high/low placements that the verifier can replay.
   const show=[false,true,false,false,true,false,true,false,false,true,false,false];
   const offsets=[0,-.86,0,0,.82,0,-.72,0,0,.9,0,0];
   const margin=cfg.radius+17,reach=cfg.gap/2-margin;
   return {show:show[i%show.length],y:cy+offsets[i%offsets.length]*reach};
 }
 function addPipe(){const i=gateIndex,cy=gateY(gateIndex++),coin=coinSpec(cy,i);pipes.push({x:W+20,cy,coinY:coin.y,passed:false,coin:coin.show})}
 function step(){
   bird.vy+=cfg.gravity*DT;bird.y+=bird.vy*DT;spawn-=DT;
   if(spawn<=0){addPipe();spawn+=cfg.spawn}
   for(const p of pipes){
     p.x-=cfg.speed*DT;
     if(p.coin){
       const cx=p.x+cfg.pipeW/2,cy=p.coinY,dx=bird.x-cx,dy=bird.y-cy;
       if(dx*dx+dy*dy<(cfg.radius+14)*(cfg.radius+14)){p.coin=false;score+=2;scoreEl.textContent=score}
     }
     if(!p.passed&&p.x+cfg.pipeW<bird.x){p.passed=true;score++;scoreEl.textContent=score}
   }
   pipes=pipes.filter(p=>p.x+cfg.pipeW>-10);
   let dead=bird.y-cfg.radius<0||bird.y+cfg.radius>H-ground;
   if(!dead)for(const p of pipes){const within=bird.x+cfg.radius>p.x&&bird.x-cfg.radius<p.x+cfg.pipeW,top=p.cy-cfg.gap/2,bottom=p.cy+cfg.gap/2;if(within&&(bird.y-cfg.radius<top||bird.y+cfg.radius>bottom)){dead=true;break}}
   tick++; if(dead)finish();
 }
 async function finish(){
   if(ending)return;ending=true;running=false;waitingForFirstFlap=false;play.style.display='';title.textContent='VERIFYING RUN';copy.textContent='NexaDraw is replaying your inputs on the server…';overlay.classList.remove('hidden');play.disabled=true;
   const {data:{session}}=await sb.auth.getSession();
   if(!session){title.textContent='RUN NOT VERIFIED';copy.textContent='Your login session expired. Please sign in again.';play.textContent='TRY AGAIN';play.disabled=false;return}
   const payload={attempt_id:attemptId,taps:[...taps],end_tick:tick};
   let data=null,error=null;
   try{
     const result=await sb.functions.invoke('verify-flight-attempt',{body:payload,headers:{Authorization:`Bearer ${session.access_token}`}});
     data=result.data;error=result.error;
   }catch(e){error=e}
   if(error||!data?.success){
     let message=data?.error||'';
     try{
       const context=error?.context;
       if(context instanceof Response){
         const raw=await context.clone().text();
         try{const detail=JSON.parse(raw);message=detail?.error||detail?.message||raw||message}catch(_){message=raw||message}
         if(!message)message='Verification request failed (HTTP '+context.status+').';
       }else if(error?.message)message=error.message;
     }catch(_){if(!message&&error?.message)message=error.message}
     title.textContent='RUN NOT VERIFIED';copy.textContent=message||'This run could not be verified.';play.textContent='NEW TEST';play.disabled=false;return
   }
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
   const themes=[
     ['#8d520b','#f0a51d','#ffc944','#9a590c','#291603'],
     ['#142d58','#3266a0','#83b9d8','#254d72','#091528'],
     ['#51236b','#a94d8d','#f09b87','#62315f','#1c102b'],
     ['#07524d','#15906f','#8fcf87','#276342','#071f1b']
   ],theme=themes[Math.floor(score/20)%themes.length];
   const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,theme[0]);sky.addColorStop(.24,theme[1]);sky.addColorStop(.52,theme[2]);sky.addColorStop(.72,theme[3]);sky.addColorStop(1,theme[4]);ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
   const sun=ctx.createRadialGradient(W*.68,H*.25,8,W*.68,H*.25,230);sun.addColorStop(0,'rgba(255,255,224,1)');sun.addColorStop(.08,'rgba(255,238,130,.9)');sun.addColorStop(.36,'rgba(255,184,35,.28)');sun.addColorStop(1,'rgba(255,180,0,0)');ctx.fillStyle=sun;ctx.fillRect(0,0,W,H);
   ctx.globalAlpha=.2;ctx.strokeStyle='#fff4a5';ctx.lineWidth=1;for(let i=0;i<18;i++){const a=i*Math.PI/9;ctx.beginPath();ctx.moveTo(W*.68,H*.25);ctx.lineTo(W*.68+Math.cos(a)*500,H*.25+Math.sin(a)*500);ctx.stroke()}ctx.globalAlpha=1;
   const zone=Math.floor(score/20)%4;
   ctx.fillStyle=zone===0?'#7a470b':zone===1?'#173454':zone===2?'#55284f':'#12483a';
   for(let x=0;x<W;x+=27){const hh=35+((x*19)%135);ctx.fillRect(x,H-ground-hh,20,hh);if(x%81===0)ctx.fillRect(x+5,H-ground-hh-22,5,22)}
   if(zone===1){ctx.globalAlpha=.55;ctx.fillStyle='#d8efff';for(let x=40;x<W;x+=145){ctx.beginPath();ctx.arc(x,95+(x%70),22,0,Math.PI*2);ctx.arc(x+24,92+(x%70),30,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1}
   if(zone===2){ctx.fillStyle='#ffe5aa';for(let x=65;x<W;x+=180){ctx.beginPath();ctx.arc(x,H-ground-18,26,Math.PI,0);ctx.fill()}}
   if(zone===3){ctx.fillStyle='#082d24';for(let x=20;x<W;x+=95){ctx.beginPath();ctx.moveTo(x,H-ground);ctx.lineTo(x+28,H-ground-85);ctx.lineTo(x+56,H-ground);ctx.fill()}}
   ctx.globalAlpha=.65;ctx.strokeStyle='#ffcf43';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(0,H-ground-35);ctx.quadraticCurveTo(W*.22,H-ground-70,W*.45,H-ground-35);ctx.quadraticCurveTo(W*.68,H-ground-72,W,H-ground-35);ctx.stroke();ctx.globalAlpha=1;
   for(let i=0;i<45;i++){const x=(i*173)%W,y=70+((i*97)%(H-ground-120)),r=i%5===0?3:1.3;ctx.fillStyle=i%4===0?'#fff6bd':'#ffd348';ctx.shadowColor='#ffd33d';ctx.shadowBlur=8;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}ctx.shadowBlur=0;
   for(const p of pipes){
     const top=p.cy-cfg.gap/2,bottom=p.cy+cfg.gap/2;pipe(p.x,0,top,false);pipe(p.x,bottom,H-ground-bottom,true);
     if(p.coin){
       const cx=p.x+cfg.pipeW/2,cy=p.coinY;
       ctx.save();ctx.shadowColor='#ffe45c';ctx.shadowBlur=18;
       const cg=ctx.createRadialGradient(cx-5,cy-6,2,cx,cy,15);cg.addColorStop(0,'#fff8b0');cg.addColorStop(.35,'#ffd83d');cg.addColorStop(1,'#a96000');
       ctx.fillStyle=cg;ctx.strokeStyle='#fff079';ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,cy,14,0,Math.PI*2);ctx.fill();ctx.stroke();
       ctx.fillStyle='#6e3d00';ctx.font='900 15px Montserrat,Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('N',cx,cy+1);ctx.restore();
     }
   }
   const water=ctx.createLinearGradient(0,H-ground,0,H);water.addColorStop(0,'#8e5709');water.addColorStop(1,'#201204');ctx.fillStyle=water;ctx.fillRect(0,H-ground,W,ground);ctx.strokeStyle='#ffd95c';ctx.lineWidth=3;for(let y=H-ground+8;y<H;y+=12){ctx.globalAlpha=.28;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}ctx.globalAlpha=1;
   ctx.save();ctx.translate(bird.x,bird.y);ctx.rotate(Math.max(-.35,Math.min(.7,bird.vy/850)));
   ctx.shadowColor='#ffcf35';ctx.shadowBlur=18;
   const body=ctx.createRadialGradient(-7,-9,3,0,0,34);body.addColorStop(0,'#5a5a58');body.addColorStop(.28,'#171717');body.addColorStop(.72,'#050505');body.addColorStop(1,'#000');ctx.fillStyle=body;ctx.strokeStyle='#d89000';ctx.lineWidth=2.5;ctx.beginPath();ctx.ellipse(0,1,31,23,-.08,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.shadowBlur=0;
   const wing=ctx.createLinearGradient(-44,-20,-8,16);wing.addColorStop(0,'#373737');wing.addColorStop(.55,'#090909');wing.addColorStop(1,'#000');ctx.fillStyle=wing;ctx.beginPath();ctx.moveTo(-13,-7);ctx.quadraticCurveTo(-40,-30,-47,-18);ctx.quadraticCurveTo(-37,-10,-50,-5);ctx.quadraticCurveTo(-36,1,-45,8);ctx.quadraticCurveTo(-27,14,-10,9);ctx.closePath();ctx.fill();ctx.stroke();ctx.strokeStyle='#b77a0b';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-15,-4);ctx.lineTo(-40,-17);ctx.moveTo(-14,1);ctx.lineTo(-42,-6);ctx.moveTo(-13,6);ctx.lineTo(-37,6);ctx.stroke();
   ctx.fillStyle='#f3aa13';ctx.strokeStyle='#6b3a00';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(25,-5);ctx.lineTo(48,2);ctx.lineTo(26,11);ctx.lineTo(30,3);ctx.closePath();ctx.fill();ctx.stroke();
   ctx.fillStyle='#f7f1d5';ctx.beginPath();ctx.arc(13,-9,9,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#6b4a10';ctx.stroke();ctx.fillStyle='#050505';ctx.beginPath();ctx.arc(16,-9,4,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(17.5,-11,1.2,0,Math.PI*2);ctx.fill();
   ctx.fillStyle='#f4b91e';ctx.strokeStyle='#5d3500';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-12,-21);ctx.lineTo(-16,-36);ctx.lineTo(-7,-29);ctx.lineTo(0,-40);ctx.lineTo(7,-29);ctx.lineTo(16,-36);ctx.lineTo(12,-20);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#1a1205';ctx.font='900 9px Montserrat,Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('NEXA',0,-27);
   ctx.fillStyle='#f2bd24';ctx.font='900 20px Montserrat,Arial';ctx.fillText('N',-5,3);
   ctx.restore();ctx.restore()
 }
 function loop(t){if(!running)return;if(!last)last=t;acc+=Math.min((t-last)/1000,.1);last=t;while(acc>=DT&&running){step();acc-=DT}draw();if(running)requestAnimationFrame(loop)}
 function setCheckoutBusy(busy){
   packageBtns.forEach(btn=>btn.disabled=busy);
 }
 function mountPaymentWidget(data){
   if(!paymentBox||!paymentMount||!data?.checkout_id)return;
   paymentMount.innerHTML='<form action="flight-game.html?payment=return" class="paymentWidgets" data-brands="VISA MASTER"></form>';
   paymentBox.hidden=false;
   document.querySelectorAll('script[data-flight-payment]').forEach(el=>el.remove());
   const script=document.createElement('script');script.src=data.payment_widget_url;script.async=true;script.dataset.flightPayment='1';
   script.onerror=()=>{if(checkoutStatus)checkoutStatus.textContent='Secure payment form could not be loaded. Please try again.';setCheckoutBusy(false)};
   document.body.appendChild(script);paymentBox.scrollIntoView({behavior:'smooth',block:'center'});
 }
 async function createPackageCheckout(packageId){
   const {data:{session}}=await sb.auth.getSession();
   if(!session){window.location.href='index.html#account';return}
   setCheckoutBusy(true);if(checkoutStatus)checkoutStatus.textContent='Preparing secure checkout…';
   const {data,error}=await sb.functions.invoke('create-flight-checkout',{body:{package_id:packageId},headers:{Authorization:`Bearer ${session.access_token}`}});
   if(error||!data?.success){
     const message=data?.error||error?.context?.error||'Checkout is unavailable.';
     if(checkoutStatus)checkoutStatus.textContent=message;
     setCheckoutBusy(false);return
   }
   if(checkoutStatus)checkoutStatus.textContent=data.attempts+' attempt'+(data.attempts===1?'':'s')+' · £'+data.amount+' · Secure payment';
   mountPaymentWidget(data);setCheckoutBusy(false);
 }
 packageBtns.forEach(btn=>btn.addEventListener('click',()=>createPackageCheckout(btn.dataset.package)));if(closePayment)closePayment.addEventListener('click',()=>{paymentBox.hidden=true;paymentMount.innerHTML=''});
 play.addEventListener('click',start);restart.addEventListener('click',()=>{if(!running)start()});overlay.addEventListener('pointerdown',e=>{if(waitingForFirstFlap&&e.target!==play){e.preventDefault();flap()}});canvas.addEventListener('pointerdown',e=>{e.preventDefault();flap()});window.addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();flap()}});
 setupHD();reset();draw();loadLeaderboard();loadAttemptBalance();sb.auth.onAuthStateChange(()=>loadAttemptBalance());setInterval(()=>{if(!document.hidden)loadLeaderboard()},15000);window.addEventListener('resize',()=>{setupHD();draw()});
})();