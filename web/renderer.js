import {WORLD,TERRAIN_COLORS,dietProfile,vitality} from './simulation.js';
const TAU=Math.PI*2;
// Angles are measured around the rim of a top-down oval; +X is forward.
// Predators look forward, herbivores to either side, and many-eyed slimes all around.
export function slimeEyeAngles(g){
 const count=Math.max(0,Math.min(6,Math.trunc(g.eyes??0)));
 if(count===0)return [];
 if(count>=5)return Array.from({length:count},(_,i)=>TAU*i/count);
 const diet=g.diet??.5;
 if(diet>.7){
  return Array.from({length:count},(_,i)=>count===1?0:(i/(count-1)-.5)*1.12);
 }
 if(diet<.3){
  return Array.from({length:count},(_,i)=>{
   const side=i%2===0?-1:1;
   const row=Math.floor(i/2);
   return side*(Math.PI/2)+(row?side*.28:0);
  });
 }
 return Array.from({length:count},(_,i)=>count===1?0:(i/(count-1)-.5)*Math.PI*1.6);
}
export function drawWorld(ctx,s,showEffects=true,selected=null){
 const {cell,columns,rows,width,height}=WORLD;
 // Bright, layered handheld-console-style terrain, drawn procedurally.
 for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
  const i=y*columns+x,t=s.tiles[i],px=x*cell,py=y*cell;
  const seed=((x*73+y*137)*23)%17;
  ctx.fillStyle=TERRAIN_COLORS[t];ctx.fillRect(px,py,cell,cell);
  ctx.fillStyle='rgba(255,255,255,.13)';ctx.fillRect(px,py,cell,3);
  ctx.fillStyle='rgba(13,37,61,.10)';ctx.fillRect(px,py+cell-3,cell,3);
  if(t===0){
   const cover=Math.max(0,Math.min(1,(s.grass[i]||0)/100));
   ctx.fillStyle='#89ec5e';ctx.fillRect(px+2,py+2,(cell-4)*cover,cell-4);
   // Sparkling blades, proportional to the actual grass biomass.
   ctx.strokeStyle='#2aa943';ctx.lineWidth=1.6;ctx.lineCap='round';
   for(let k=0;k<Math.floor(cover*5);k++){
    const gx=px+3+(seed+k*7)%14,gy=py+8+(k*7+seed)%10;
    ctx.beginPath();ctx.moveTo(gx,gy+3);ctx.lineTo(gx-2,gy-2);ctx.moveTo(gx,gy+3);ctx.lineTo(gx+2,gy-1);ctx.stroke();
   }
  }else if(t===1){
   const depth=Math.max(0,Math.min(1,(s.water[i]||0)/100));
   ctx.fillStyle='#48c7ff';ctx.fillRect(px+2,py+2,cell-4,(cell-4)*depth);
   ctx.strokeStyle='rgba(224,255,255,.82)';ctx.lineWidth=1.4;
   const wave=(s.tick*.08+seed)%8;
   ctx.beginPath();ctx.moveTo(px+3+wave*.4,py+5);ctx.lineTo(px+9+wave*.4,py+5);ctx.stroke();
   // Submerged vegetation is visible independently of the water quantity.
   const weed=Math.max(0,Math.min(1,(s.waterweed?.[i]||0)/100));
   if(weed>.02){
    ctx.strokeStyle='#24a86b';ctx.lineWidth=2;ctx.lineCap='round';
    for(let k=0;k<Math.max(1,Math.floor(weed*4));k++){
     const wx=px+4+(k*5+seed)%13,wy=py+17;
     ctx.beginPath();ctx.moveTo(wx,wy);ctx.quadraticCurveTo(wx-3,wy-4,wx+Math.sin(s.tick*.08+k)*2,wy-8-weed*4);ctx.stroke();
    }
   }
  }else if(t===2){
   ctx.fillStyle='#ffe099';ctx.fillRect(px+3+(seed%5),py+5,3,2);
   ctx.fillStyle='#cb8c45';ctx.fillRect(px+10,py+13+(seed%4),5,2);
  }else{
   ctx.fillStyle='#b9b7df';ctx.beginPath();ctx.moveTo(px+3,py+11);ctx.lineTo(px+9,py+3);ctx.lineTo(px+16,py+8);ctx.lineTo(px+14,py+17);ctx.lineTo(px+4,py+16);ctx.closePath();ctx.fill();
   ctx.strokeStyle='#65638e';ctx.lineWidth=1;ctx.stroke();
  }
 }
 // Weather darkens the terrain lightly without hiding organisms or map resources.
 if(s.weather==='cloudy'||s.weather==='rain'){
  ctx.fillStyle=s.weather==='rain'?'rgba(30,64,126,.13)':'rgba(50,78,107,.085)';
  ctx.fillRect(0,0,width,height);
 }
 ctx.strokeStyle='rgba(33,58,88,.08)';ctx.lineWidth=.5;ctx.beginPath();
 for(let x=0;x<width;x+=cell){ctx.moveTo(x,0);ctx.lineTo(x,height);}
 for(let y=0;y<height;y+=cell){ctx.moveTo(0,y);ctx.lineTo(width,y);}
 ctx.stroke();

 // Bodies leave nutrients for a long time, but their silhouettes fade quickly.
 // Do not render old resource corpses as opaque black stains.
 // Corpses share inherited body shape and eye positions.
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
 for(const u of [...s.corpses.filter(c=>c.age<135&&c.mass>0).map(c=>({
   id:-1,x:c.x,y:c.y,angle:c.angle,g:c.g,age:c.deathAge,
   stage:c.stage,dead:true,corpse:true,corpseAge:c.age,growthScale:c.growthScale??1,bite:0,woundFlash:0,fleeing:false,
   decayScale:Math.max(.24,Math.sqrt(Math.max(0,c.mass/c.initialMass)))
  })),...s.units]){
  const dead=!!u.corpse;
  const g=u.g,signal=dietProfile(g).signal,life=vitality(u),
   scale=(u.stage==='juvenile'?.55:1)*(u.growthScale??1)*(1-life.old*.12)*(dead?u.decayScale:1),
   halfL=g.r*g.elongation*scale,halfW=g.r*scale,phase=s.tick*.18+u.id;
  if(dead){ctx.save();ctx.filter='grayscale(0.65) brightness(1.12)';ctx.globalAlpha=.50*Math.max(0,1-(u.corpseAge??0)/135);}

  if(u.courtPartner||u.pregnancy){
   ctx.save();ctx.strokeStyle=u.pregnancy?'#ffe59b':'#ff93e9';ctx.lineWidth=2.5;
   ctx.beginPath();ctx.arc(u.x,u.y,Math.max(13,g.r*g.elongation+8),0,TAU);ctx.stroke();
   ctx.fillStyle=u.pregnancy?'#ffe59b':'#ffd5f5';ctx.font='bold 12px system-ui';ctx.textAlign='center';
   if(u.pregnancy){const v=1-u.pregnancy.remaining/u.pregnancy.total;ctx.beginPath();ctx.arc(u.x,u.y,Math.max(13,g.r*g.elongation+8)+4,-Math.PI/2,-Math.PI/2+TAU*v);ctx.stroke();}else{ctx.beginPath();ctx.arc(u.x,u.y,Math.max(13,g.r*g.elongation+8)+3,0,TAU);ctx.stroke();}ctx.restore();
  }
  // Ground shadow gives every slime some separation from the bright terrain.
  if(!dead){
   ctx.save();ctx.fillStyle='rgba(29,42,75,.075)';ctx.beginPath();
   ctx.ellipse(u.x+1.5,u.y+Math.min(halfW*.40,10),Math.max(2,Math.min(halfL*.48,20)),Math.max(1.5,Math.min(halfW*.20,6)),u.angle,0,TAU);
   ctx.fill();ctx.restore();
  }
  ctx.save();ctx.translate(u.x,u.y);ctx.rotate(u.angle);
  const blobPhase=s.tick*.11+(u.id||0);
  // A mathematically exact circle or ellipse, with a tiny whole-body squash.
  const squash=dead?0:Math.sin(blobPhase*1.35)*.032;
  const aspect=Math.max(1,Math.min(3,g.elongation??1));
  const rx=halfW*1.06*aspect*(1+squash);
  const ry=halfW*1.06*(1-squash);
  const sat=Math.min(100,Math.max(28,g.saturation*(1-life.old*.42)+12));
  const light=Math.min(85,Math.max(38,g.lightness+8));
  const base=u.woundFlash?'#fff0e2':`hsl(${g.hue},${sat}%,${light}%)`;
  const outline=`hsl(${g.hue},${Math.max(30,sat-8)}%,${Math.max(19,light-29)}%)`;
  const shine=ctx.createRadialGradient(-rx*.38,-ry*.42,0,0,0,Math.max(rx,ry)*1.45);
  shine.addColorStop(0,'rgba(255,255,255,.68)');
  shine.addColorStop(.36,base);
  shine.addColorStop(1,outline);
  ctx.fillStyle=shine;ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,0,TAU);ctx.fill();
  ctx.strokeStyle=outline;ctx.lineWidth=1.6;ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,.36)';ctx.beginPath();
  ctx.ellipse(-rx*.30,-ry*.36,rx*.21,ry*.10,-.35,0,TAU);ctx.fill();
  // Solid-colored, body-harmonized eyes, set inside the oval rather than on the rim.
  // No sclera or mouth: these slimes eat by enveloping food.
  const eyes=slimeEyeAngles(g),eyeRadius=Math.max(1.2,Math.min(3.6,ry*.19));
  const eyeHue=(g.hue+115+(Math.round(g.eyes*17)+Math.round(g.jaw*29))%110)%360;
  ctx.fillStyle=dead?'#77707e':`hsl(${eyeHue},${Math.min(85,Math.max(45,g.saturation))}%,${Math.max(21,Math.min(35,g.lightness*.52))}%)`;
  for(const angle of eyes){
   const ex=rx*.70*Math.cos(angle),ey=ry*.70*Math.sin(angle);
   ctx.beginPath();ctx.arc(ex,ey,eyeRadius,0,TAU);ctx.fill();
  }
  if(!dead&&u===selected){ctx.strokeStyle='white';ctx.beginPath();ctx.ellipse(0,0,rx+7,ry+7,0,0,TAU);ctx.stroke();}
  ctx.restore();
  if(dead)ctx.restore();
 }
 // Each gameplay action uses a distinct visual language; effect time is frame-based.
 if(showEffects){
  for(const fx of s.effects){
   if(!['strike','consume','graze','waterweed','drink','scavenge'].includes(fx.type))continue;
   const life=fx.type==='strike'?22:fx.type==='consume'?30:fx.type==='drink'?24:30;
   const t=Math.min(1,fx.age/life),fade=Math.max(0,1-t);
   if(fade<=0)continue;
   ctx.save();ctx.globalAlpha=fade;ctx.lineCap='round';
   if(fx.type==='strike'){
    // Sharp, warm impact burst plus outward shock ring.
    ctx.strokeStyle='#ff633d';ctx.lineWidth=3.6*(1-t)+1;
    ctx.beginPath();ctx.arc(fx.x,fx.y,4+t*17,0,TAU);ctx.stroke();
    ctx.strokeStyle='#fff0a8';ctx.lineWidth=2.2*(1-t)+.4;
    for(let i=0;i<5;i++){const a=TAU*i/5;const inner=6+t*7,outer=inner+7*(1-t);
     ctx.beginPath();ctx.moveTo(fx.x+Math.cos(a)*inner,fx.y+Math.sin(a)*inner);
     ctx.lineTo(fx.x+Math.cos(a)*outer,fx.y+Math.sin(a)*outer);ctx.stroke();
    }
   }else if(fx.type==='consume'||fx.type==='scavenge'){
    // Pink-violet absorption ring and particles moving into the consumer.
    const color=fx.type==='consume'?'#ff5aab':'#bf70ff';
    ctx.strokeStyle=color;ctx.lineWidth=3*(1-t)+.6;
    ctx.beginPath();ctx.arc(fx.x,fx.y,17-t*13,0,TAU);ctx.stroke();
    ctx.fillStyle='#ffe1fa';
    for(let i=0;i<7;i++){const a=TAU*i/7,rad=18*(1-t)+2;
     ctx.beginPath();ctx.arc(fx.x+Math.cos(a)*rad,fx.y+Math.sin(a)*rad,2.6*(1-t)+.5,0,TAU);ctx.fill();
    }
   }else if(fx.type==='drink'){
    // Blue ripples, visibly unlike grazing or attacking.
    ctx.strokeStyle='#b5f3ff';ctx.lineWidth=2.2*(1-t)+.5;
    ctx.beginPath();ctx.arc(fx.x,fx.y,3+t*13,0,TAU);ctx.stroke();
    ctx.strokeStyle='#39b9fa';ctx.lineWidth=1.4;
    ctx.beginPath();ctx.arc(fx.x,fx.y,2+t*7,Math.PI*.08,Math.PI*.92);ctx.stroke();
   }else{
    // Food fragments converge from plant location toward the slime's center.
    const aquatic=fx.type==='waterweed';
    const color=aquatic?'#18f1d3':'#a6ff68';
    ctx.fillStyle=color;ctx.strokeStyle=color;ctx.lineWidth=2;
    const fromX=fx.fromX??fx.x-8,fromY=fx.fromY??fx.y+7;
    for(let i=0;i<5;i++){
     const a=TAU*i/5;
     const startX=fromX+Math.cos(a)*8,startY=fromY+Math.sin(a)*8;
     const x=startX+(fx.x-startX)*t,y=startY+(fx.y-startY)*t;
     if(aquatic){ctx.beginPath();ctx.moveTo(x-2,y+2);ctx.quadraticCurveTo(x+2,y-3,x+4,y-5);ctx.stroke();}
     else{ctx.beginPath();ctx.ellipse(x,y,2.4,1.4,a,0,TAU);ctx.fill();}
    }
   }
   ctx.restore();
  }
 }
 // Falling rain: deterministic diagonal streaks, never one particle object per drop.
 // This is visual-only and works even when the world is paused.
 if(s.weather==='rain'){
  const strength=Math.max(.3,s.weatherStrength??.6);
  const count=Math.round(45+strength*115);
  ctx.save();ctx.beginPath();ctx.rect(0,0,width,height);ctx.clip();
  ctx.strokeStyle='rgba(220,251,255,.67)';ctx.lineWidth=1.2;ctx.lineCap='round';
  ctx.beginPath();
  for(let i=0;i<count;i++){
   const animation=s.visualTick??s.tick;
   const x=((i*137.47+animation*2.8+i%5*14)% (width+40))-20;
   const y=((i*83.19+animation*7.2)% (height+40))-20;
   const len=8+strength*8+(i%4);
   ctx.moveTo(x,y);ctx.lineTo(x-4,y+len);
  }
  ctx.stroke();ctx.restore();
 }
 if(showEffects){const colors={birth:'#91f7ac',death:'#ff8290',meal:'#f9d36b',pred:'#be82ec',new:'#ffe486',decay:'#e2b96e',mate:'#f5a5ed',egg:'#efd6a4',hatch:'#95eec2',eggeaten:'#f7818d'};for(const f of s.effects){if(['strike','consume','graze','waterweed','drink','scavenge'].includes(f.type))continue;ctx.save();ctx.globalAlpha=Math.max(0,1-f.age/35);ctx.strokeStyle=colors[f.type]||'#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(f.x,f.y,5+f.age*.65,0,TAU);ctx.stroke();ctx.restore();}}
}
export function drawChart(ctx,history){const w=ctx.canvas.width,h=ctx.canvas.height;ctx.fillStyle='#172731';ctx.fillRect(0,0,w,h);if(history.length<2)return;for(const [k,color] of [['population','#77dc9a'],['food','#e6c56a'],['corpses','#bc8ed6']]){const max=Math.max(1,...history.map(d=>d[k]))*1.12;ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();history.forEach((d,i)=>{const x=i/(history.length-1)*w,y=h-6-d[k]/max*(h-14);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();}}
