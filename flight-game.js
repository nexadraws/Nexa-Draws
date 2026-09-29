'use strict';
(() => {
  const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
  const scoreEl=document.getElementById('score'),bestEl=document.getElementById('best');
  const overlay=document.getElementById('overlay'),title=document.getElementById('overlayTitle'),copy=document.getElementById('overlayText');
  const play=document.getElementById('playBtn'),restart=document.getElementById('restartBtn');
  const W=canvas.width,H=canvas.height,ground=54;
  const cfg={gravity:1550,flap:-470,speed:220,gap:170,pipeW:86,spawn:1.48,birdX:210,radius:19};
  let running=false,last=0,spawn=0,score=0,best=Number(localStorage.getItem('nexa_flight_best')||0),bird,pipes=[];
  bestEl.textContent=best;

  function reset(){
    bird={x:cfg.birdX,y:H*.48,vy:0};pipes=[];spawn=.75;score=0;scoreEl.textContent='0';last=0;
  }
  function start(){
    reset();running=true;overlay.classList.add('hidden');requestAnimationFrame(loop);
  }
  function flap(){if(!running)return;bird.vy=cfg.flap;}
  function gateY(i){
    // deterministic sequence: same challenge for every run/build.
    const seq=[.42,.56,.35,.61,.47,.31,.53,.39,.58,.44,.34,.50];
    return 92+seq[i%seq.length]*(H-ground-184);
  }
  let gateIndex=0;
  function addPipe(){const cy=gateY(gateIndex++);pipes.push({x:W+20,cy,passed:false});}
  function update(dt){
    bird.vy+=cfg.gravity*dt;bird.y+=bird.vy*dt;
    spawn-=dt;if(spawn<=0){addPipe();spawn=cfg.spawn;}
    for(const p of pipes){
      p.x-=cfg.speed*dt;
      if(!p.passed&&p.x+cfg.pipeW<bird.x){p.passed=true;score++;scoreEl.textContent=score;}
    }
    pipes=pipes.filter(p=>p.x+cfg.pipeW>-10);
    if(bird.y-cfg.radius<0||bird.y+cfg.radius>H-ground)return end();
    for(const p of pipes){
      const within=bird.x+cfg.radius>p.x&&bird.x-cfg.radius<p.x+cfg.pipeW;
      const top=p.cy-cfg.gap/2,bottom=p.cy+cfg.gap/2;
      if(within&&(bird.y-cfg.radius<top||bird.y+cfg.radius>bottom))return end();
    }
  }
  function end(){
    running=false;
    if(score>best){best=score;localStorage.setItem('nexa_flight_best',String(best));bestEl.textContent=best;}
    title.textContent='RUN COMPLETE';copy.textContent='Score: '+score+' — Best: '+best+'. Try again and beat it.';
    play.textContent='PLAY AGAIN';overlay.classList.remove('hidden');
  }
  function pipe(x,y,h,capBottom){
    const g=ctx.createLinearGradient(x,0,x+cfg.pipeW,0);g.addColorStop(0,'#70470a');g.addColorStop(.25,'#e6ad25');g.addColorStop(.52,'#fff0a0');g.addColorStop(.75,'#c28713');g.addColorStop(1,'#573606');
    ctx.fillStyle=g;ctx.strokeStyle='#493005';ctx.lineWidth=4;ctx.fillRect(x,y,cfg.pipeW,h);ctx.strokeRect(x,y,cfg.pipeW,h);
    const capY=capBottom?y:y+h-26;ctx.fillRect(x-10,capY,cfg.pipeW+20,26);ctx.strokeRect(x-10,capY,cfg.pipeW+20,26);
  }
  function draw(){
    const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#f2c55a');sky.addColorStop(.55,'#b97d17');sky.addColorStop(1,'#49300a');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    ctx.globalAlpha=.25;ctx.fillStyle='#fff6b7';ctx.beginPath();ctx.arc(W*.48,H*.48,150,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    // simple skyline
    ctx.fillStyle='#5a3a0c';for(let x=0;x<W;x+=38){const h=35+((x*17)%85);ctx.fillRect(x,H-ground-h,30,h)}
    for(const p of pipes){const top=p.cy-cfg.gap/2,bottom=p.cy+cfg.gap/2;pipe(p.x,0,top,false);pipe(p.x,bottom,H-ground-bottom,true)}
    ctx.fillStyle='#2a1a04';ctx.fillRect(0,H-ground,W,ground);ctx.strokeStyle='#e0a92a';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(0,H-ground);ctx.lineTo(W,H-ground);ctx.stroke();
    // original Nexa-inspired player token
    ctx.save();ctx.translate(bird.x,bird.y);ctx.rotate(Math.max(-.35,Math.min(.7,bird.vy/850)));
    ctx.fillStyle='#111';ctx.strokeStyle='#ffd45c';ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,cfg.radius,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle='#ffd45c';ctx.font='900 24px Montserrat,Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('N',0,1);
    ctx.beginPath();ctx.moveTo(-17,-2);ctx.lineTo(-38,-16);ctx.lineTo(-28,3);ctx.lineTo(-40,12);ctx.lineTo(-17,9);ctx.fill();
    ctx.beginPath();ctx.moveTo(17,-2);ctx.lineTo(38,-16);ctx.lineTo(28,3);ctx.lineTo(40,12);ctx.lineTo(17,9);ctx.fill();ctx.restore();
  }
  function loop(t){
    if(!running)return;
    if(!last)last=t;const dt=Math.min((t-last)/1000,.025);last=t;update(dt);draw();if(running)requestAnimationFrame(loop);
  }
  play.addEventListener('click',start);restart.addEventListener('click',start);
  canvas.addEventListener('pointerdown',e=>{e.preventDefault();flap()});
  window.addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();flap()}});
  reset();draw();
})();