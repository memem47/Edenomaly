import {WORLD,TERRAIN_COLORS,dietProfile,vitality} from './simulation.js';
const TAU=Math.PI*2;
export function drawWorld(ctx,s,showEffects=true,selected=null){
 const {cell,columns,rows,width,height}=WORLD;
 for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
  const i=y*columns+x,t=s.tiles[i];
  ctx.fillStyle=TERRAIN_COLORS[t];ctx.fillRect(x*cell,y*cell,cell,cell);
  if(t===0){
   ctx.fillStyle='rgba(114,224,112,.5)';
   const coverage=(s.grass?.[i]??0)/100;
   ctx.fillRect(x*cell,y*cell+cell*(1-coverage),cell,cell*coverage);
  }
  if(t===1){
   ctx.fillStyle='rgba(90,188,248,.55)';
   const level=(s.water?.[i]??0)/100;
   ctx.fillRect(x*cell,y*cell+cell*(1-level),cell,cell*level);
  }
 }
 ctx.strokeStyle='rgba(0,0,0,.11)';ctx.lineWidth=.5;ctx.beginPath();for(let x=0;x<width;x+=cell){ctx.moveTo(x,0);ctx.lineTo(x,height);}for(let y=0;y<height;y+=cell){ctx.moveTo(0,y);ctx.lineTo(width,y);}ctx.stroke();

 // Corpses share the creature renderer, preserving the inherited oval proportions and eyes.
 // Courtship: a living couple is joined by a conspicuous animated magenta bond.
 for(const pair of s.courtships){
  const a=s.units.find(u=>u.id===pair.a),b=s.units.find(u=>u.id===pair.b);
  if(!a||!b)continue;
  const pulse=.5+.5*Math.sin(s.tick*.34);
  ctx.save();ctx.strokeStyle='#ff91e8';ctx.lineWidth=2+pulse*2;ctx.setLineDash([6,4]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='#fff1fc';ctx.font='bold 11px system-ui';ctx.textAlign='center';const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;ctx.strokeStyle='#ffe1f9';ctx.lineWidth=2;ctx.beginPath();ctx.arc(mx,my,9+2*pulse,-Math.PI/2,-Math.PI/2+TAU*(pair.progress/pair.required));ctx.stroke();
  ctx.restore();
 }
 // A translucent path shows where the laying parent deposited its egg.
 for(const trail of s.eggTrails){
  const alpha=Math.max(0,1-trail.age/trail.life);
  ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle='#ffe3a1';ctx.lineWidth=2.5;ctx.setLineDash([3,4]);
  ctx.beginPath();ctx.moveTo(trail.x1,trail.y1);ctx.lineTo(trail.x2,trail.y2);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='#fff0ad';ctx.font='bold 11px system-ui';ctx.textAlign='center';ctx.strokeStyle='#ffe3a1';ctx.lineWidth=1.5+alpha*2;ctx.beginPath();ctx.arc(trail.x2,trail.y2,10+(1-alpha)*23,0,TAU);ctx.stroke();
  ctx.restore();
 }
 // Eggs have a shell, do not move, and visibly develop before hatching.
 for(const egg of s.eggs){
  const shell=egg.g.shell,prog=egg.age/egg.hatchAt;
  const emergence=Math.min(1,(s.tick-(egg.bornTick??s.tick))/9);
  const x=(egg.birthX??egg.x)*(1-emergence)+egg.x*emergence;
  const y=(egg.birthY??egg.y)*(1-emergence)+egg.y*emergence;
  ctx.save();ctx.translate(x,y);ctx.scale(.65+.35*emergence,.65+.35*emergence);
  ctx.fillStyle='#513e52';ctx.beginPath();ctx.ellipse(0,1,4.2+shell*2.3,5.3+shell*2.3,0,0,TAU);ctx.fill();
  ctx.fillStyle=`hsl(${egg.g.hue},${Math.max(35,egg.g.saturation*.65)}%,${Math.min(88,egg.g.lightness+14-shell*5)}%)`;ctx.beginPath();ctx.ellipse(0,0,3.5+shell*2.1,4.5+shell*2.1,0,0,TAU);ctx.fill();
  ctx.strokeStyle='#f0e4d0';ctx.lineWidth=.7+shell*1.2;ctx.stroke();
  ctx.fillStyle='#4d384d';ctx.beginPath();ctx.arc(1,0,Math.max(.6,1+prog*1.5),0,TAU);ctx.fill();
  if(prog>.75){ctx.strokeStyle='#754765';ctx.beginPath();ctx.moveTo(-2,-3);ctx.lineTo(0,-1);ctx.lineTo(-1,2);ctx.stroke();}
  ctx.restore();
 }
 for(const u of [...s.corpses.map(c=>({
   id:-1,x:c.x,y:c.y,angle:c.angle,g:c.g,age:c.deathAge,
   stage:c.stage,dead:true,corpse:true,bite:0,woundFlash:0,fleeing:false,
   decayScale:Math.max(.50,Math.sqrt(c.mass/c.initialMass))
  })),...s.units]){
  const dead=!!u.corpse;
  const g=u.g,signal=dietProfile(g).signal,life=vitality(u),
   scale=(u.stage==='juvenile'?.55:1)*(1-life.old*.12)*(dead?u.decayScale:1),
   halfL=g.r*g.elongation*scale,halfW=g.r*scale,phase=s.tick*.18+u.id;
  if(dead){ctx.save();ctx.filter='grayscale(0.82) brightness(0.73)';ctx.globalAlpha=.85;}

  if(u.courtPartner||u.pregnancy){
   ctx.save();ctx.strokeStyle=u.pregnancy?'#ffe59b':'#ff93e9';ctx.lineWidth=2.5;
   ctx.beginPath();ctx.arc(u.x,u.y,Math.max(13,g.r*g.elongation+8),0,TAU);ctx.stroke();
   ctx.fillStyle=u.pregnancy?'#ffe59b':'#ffd5f5';ctx.font='bold 12px system-ui';ctx.textAlign='center';
   if(u.pregnancy){const v=1-u.pregnancy.remaining/u.pregnancy.total;ctx.beginPath();ctx.arc(u.x,u.y,Math.max(13,g.r*g.elongation+8)+4,-Math.PI/2,-Math.PI/2+TAU*v);ctx.stroke();}else{ctx.beginPath();ctx.arc(u.x,u.y,Math.max(13,g.r*g.elongation+8)+3,0,TAU);ctx.stroke();}ctx.restore();
  }
  ctx.save();ctx.translate(u.x,u.y);ctx.rotate(u.angle);
  const blobPhase=s.tick*.11+(u.id||0);
  const wobble=dead?0:Math.sin(blobPhase*1.35)*.10;
  const rx=halfL*.82*(1+wobble*.55),ry=halfW*1.2*(1-wobble*.40);
  ctx.fillStyle=u.woundFlash?'#fff2ea':`hsl(${g.hue},${Math.max(12,g.saturation*(1-life.old*.6))}%,${g.lightness}%)`;
  // Keep a perfectly smooth oval: only its two axes squash and stretch.
  ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,0,TAU);ctx.fill();ctx.strokeStyle='rgba(255,255,255,.55)';ctx.lineWidth=1.4;ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,.25)';ctx.beginPath();ctx.ellipse(-rx*.3+Math.sin(blobPhase*.85)*(dead?0:ry*.12),-ry*.35+Math.cos(blobPhase*.7)*(dead?0:ry*.09),rx*.3,ry*.15,-.4,0,TAU);ctx.fill();
  for(let i=0;i<Math.min(g.eyes,6);i++){
   const ex=rx*(.12+(i%3)*.22)+(dead?0:Math.sin(blobPhase*.73+i*.4)*ry*.045),ey=ry*(-.36+Math.floor(i/3)*.4)+(dead?0:Math.cos(blobPhase*.83+i*.4)*ry*.045),er=Math.max(1.6,ry*.22);
   ctx.fillStyle='white';ctx.beginPath();ctx.arc(ex,ey,er,0,TAU);ctx.fill();
   ctx.fillStyle='#283449';ctx.beginPath();ctx.arc(ex+er*.2,ey,er*.45,0,TAU);ctx.fill();
  }
  ctx.strokeStyle='#65405e';ctx.lineWidth=Math.max(1.5,ry*.12);ctx.beginPath();ctx.arc(rx*.4,ry*.27,Math.max(2,ry*.24),.1,Math.PI-.1);ctx.stroke();
  if(u.bite>0){ctx.fillStyle='#703b55';ctx.beginPath();ctx.ellipse(rx*.47,ry*.28,ry*.20,ry*.23,0,0,TAU);ctx.fill();}
  if(!dead&&u===selected){ctx.strokeStyle='white';ctx.beginPath();ctx.ellipse(0,0,rx+7,ry+7,0,0,TAU);ctx.stroke();}
  ctx.restore();
  if(dead)ctx.restore();
 }
 if(showEffects){
  for(const fx of s.effects){
   if(fx.type!=='strike'&&fx.type!=='consume')continue;
   const q=Math.min(1,fx.age/23),alpha=1-q;
   ctx.save();ctx.globalAlpha=alpha;
   if(fx.type==='strike'){
    const vx=fx.x-(fx.fromX??fx.x-14),vy=fx.y-(fx.fromY??fx.y),ang=Math.atan2(vy,vx);
    ctx.translate(fx.x,fx.y);ctx.rotate(ang);
    ctx.strokeStyle='#ffe3a0';ctx.lineWidth=3.5*(1-q)+.5;ctx.lineCap='round';
    for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(-20*(1-q)-4,side*6);ctx.lineTo(8+q*10,side*3);ctx.stroke();}
    ctx.strokeStyle='#fff3ce';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,5+q*15,-.9,.9);ctx.stroke();
   }else{
    ctx.strokeStyle='#e5a9ec';ctx.lineWidth=3*(1-q)+.5;ctx.beginPath();ctx.arc(fx.x,fx.y,5+q*19,0,TAU);ctx.stroke();
    for(let i=0;i<6;i++){const a=i*TAU/6+q*1.7;const r=8+q*23;
     ctx.fillStyle=i%2?'#f8cd90':'#ce91df';ctx.beginPath();ctx.arc(fx.x+Math.cos(a)*r,fx.y+Math.sin(a)*r,2.8*(1-q)+.5,0,TAU);ctx.fill();}
   }
   ctx.restore();
  }
 }
 if(showEffects){const colors={birth:'#91f7ac',death:'#ff8290',meal:'#f9d36b',pred:'#be82ec',new:'#ffe486',decay:'#e2b96e',mate:'#f5a5ed',egg:'#efd6a4',hatch:'#95eec2',eggeaten:'#f7818d'};for(const f of s.effects){if(f.type==='strike'||f.type==='consume')continue;ctx.save();ctx.globalAlpha=Math.max(0,1-f.age/35);ctx.strokeStyle=colors[f.type]||'#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(f.x,f.y,5+f.age*.65,0,TAU);ctx.stroke();ctx.restore();}}
}
export function drawChart(ctx,history){const w=ctx.canvas.width,h=ctx.canvas.height;ctx.fillStyle='#172731';ctx.fillRect(0,0,w,h);if(history.length<2)return;for(const [k,color] of [['population','#77dc9a'],['food','#e6c56a'],['corpses','#bc8ed6']]){const max=Math.max(1,...history.map(d=>d[k]))*1.12;ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();history.forEach((d,i)=>{const x=i/(history.length-1)*w,y=h-6-d[k]/max*(h-14);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();}}
