import {WORLD,TERRAIN_COLORS,dietProfile,vitality,adaptationColor,lifeStageScale,bodySizeMultiplier} from './simulation.js?v=permanent-water-1';
const TAU=Math.PI*2;
// Angles are measured around the rim of a top-down oval; +X is forward.
// Predators look forward, herbivores to either side, and many-eyed slimes all around.
export function slimeEyeAngles(g){
 const count=Math.max(0,Math.min(6,Math.trunc(g.eyes??0)));
 if(count===0)return [];
 if(count===1)return [0];
 if(count>=5)return Array.from({length:count},(_,i)=>TAU*i/count);
 // Most eyes face somewhat forward. Existing inherited diet and protection
 // alter peripheral vision, without introducing a redundant appearance gene.
 // Fully lateral eyes require an uncommon combination of protective and
 // herbivorous traits; they remain possible and heritable.
 const diet=Math.max(0,Math.min(1,g.diet??.5));
 const guard=Math.max(0,Math.min(1,g.guard??.5));
 const lateral=guard>.93&&diet<.19;
 const spread=lateral?Math.PI/2:.27+.43*(1-diet)+.16*guard;
 return Array.from({length:count},(_,i)=>(i/(count-1)*2-1)*spread);
}
export function slimeEyeColor(g){
 const c=adaptationColor(g);
 if(g.albino===1)return 'hsl(335,52%,38%)';
 // Eye pigment is a dark complementary shade of the adaptation-derived body.
 return `hsl(${(c.hue+125+(g.eyes??0)*8)%360},${Math.max(45,c.saturation-12)}%,${Math.max(18,c.lightness*.45)}%)`;
}
export function slimeEyeLocation(angle,rx,ry){
 return {x:rx*.70*Math.cos(angle),y:ry*.70*Math.sin(angle)};
}
// Direction tangent to the body ellipse at each eye's location.
// The body transform already applies the organism's facing direction.
export function closedEyeTangent(angle,rx,ry){
 const dx=-rx*Math.sin(angle),dy=ry*Math.cos(angle);
 const len=Math.hypot(dx,dy)||1;
 return {x:dx/len,y:dy/len};
}
// HP is remaining life. Colors start fading below half-life; at zero
// they match the corpse palette exactly. There are no persistent wound marks.
export const lifeFade=u=>{
 const fraction=Math.max(0,Math.min(1,(u.hp??u.maxHp??1)/Math.max(1,u.maxHp??1)));
 return Math.max(0,Math.min(1,(.5-fraction)*2));
};
export function organismVisualState(u){
 return {infected:!u.dead&&(u.infection??0)>0,
  attacking:!u.dead&&(u.attackFlash??0)>0,
  lifeFade:u.dead?1:lifeFade(u),
  hit:!u.dead&&(u.woundFlash??0)>0};
}
// Interpolate along the shortest hue arc toward the muted corpse brown.
export const livingBodyColor=(g,fade,edge=false)=>{
 const pigment=adaptationColor(g);
 const sat=g.albino===1?4:Math.min(100,Math.max(28,pigment.saturation+8));
 const light=g.albino===1?91:Math.min(85,Math.max(38,pigment.lightness+6));
 const t=Math.max(0,Math.min(1,fade));
 if(t>=1)return edge?'#655f56':'#9e9788';
 const hue=g.albino===1?0:pigment.hue;
 const sourceSat=edge?(g.albino===1?15:Math.max(30,sat-8)):sat;
 const sourceLight=edge?(g.albino===1?64:Math.max(19,light-29)):light;
 const delta=((40-hue+540)%360)-180;
 return `hsl(${(hue+delta*t+360)%360},${sourceSat*(1-t)+11*t}%,${sourceLight*(1-t)+(edge?36:58)*t}%)`;
};
// The palette modifies the terrain only, not creature pigments or simulation.
export const seasonPalette=season=>({
 spring:{terrain:TERRAIN_COLORS,grass:'#89ec5e',blade:'#2aa943',water:'#48c7ff',weed:'#24a86b'},
 summer:{terrain:['#71d95c','#34b6fa','#f5c76b','#9c95c8'],grass:'#b6f777',blade:'#30b34d',water:'#7bd7ff',weed:'#2abe78'},
 autumn:{terrain:['#b17c39','#379fc9','#dd9b4e','#9688a9'],grass:'#d99d43',blade:'#ad552b',water:'#5cb8db',weed:'#8c923e'},
 winter:{terrain:['#d9e7e7','#8ec6e2','#e7edf0','#b7c9d6'],grass:'#e1ece5',blade:'#9db9ab',water:'#b3e6f3',weed:'#6baf9c'}
})[season]||{terrain:TERRAIN_COLORS,grass:'#89ec5e',blade:'#2aa943',water:'#48c7ff',weed:'#24a86b'};
export function drawWorld(ctx,s,showEffects=true,selected=null){
 const {cell,columns,rows,width,height}=WORLD;
 const season=s.climateEnabled===false?'spring':s.seasonName?.()??'spring';
 const palette=seasonPalette(season);
 // Bright, layered handheld-console-style terrain, drawn procedurally.
 for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
  const i=y*columns+x,t=s.tiles[i],px=x*cell,py=y*cell;
  const seed=((x*73+y*137)*23)%17;
  ctx.fillStyle=palette.terrain[t];ctx.fillRect(px,py,cell,cell);
  ctx.fillStyle='rgba(255,255,255,.13)';ctx.fillRect(px,py,cell,3);
  ctx.fillStyle='rgba(13,37,61,.10)';ctx.fillRect(px,py+cell-3,cell,3);
  if(t===0){
   const cover=Math.max(0,Math.min(1,(s.grass[i]||0)/100));
   ctx.fillStyle=palette.grass;ctx.fillRect(px+2,py+2,(cell-4)*cover,cell-4);
   // Sparkling blades, proportional to the actual grass biomass.
   ctx.strokeStyle=palette.blade;ctx.lineWidth=1.6;ctx.lineCap='round';
   for(let k=0;k<Math.floor(cover*5);k++){
    const gx=px+3+(seed+k*7)%14,gy=py+8+(k*7+seed)%10;
    ctx.beginPath();ctx.moveTo(gx,gy+3);ctx.lineTo(gx-2,gy-2);ctx.moveTo(gx,gy+3);ctx.lineTo(gx+2,gy-1);ctx.stroke();
   }
   // Golden soil speckles make fertility intervention visible without
   // turning the whole map into a numerical resource display.
   const fertility=Math.max(0,Math.min(1,(s.soil?.[i]??0)/100));
   if(fertility>.22){
    ctx.fillStyle=`rgba(242,200,94,${(.25+fertility*.55).toFixed(2)})`;
    ctx.fillRect(px+5+(seed%5),py+13,2.5,2.5);
    if(fertility>.58)ctx.fillRect(px+13,py+5+(seed%5),2,2);
   }
   if(season==='autumn'&&cover>.02){
    // Red, amber and rust leaves occupy actual vegetated pixels only.
    // Deterministic hashes avoid consuming ecosystem RNG.
    for(let k=0;k<Math.ceil(cover*4);k++){
     const lx=px+3+(seed*3+k*7)%14,ly=py+4+(seed+k*5)%13;
     ctx.fillStyle=['#ecbc50','#b8582d','#d76d31','#a63e38'][(seed+k)%4];
     ctx.beginPath();ctx.ellipse(lx,ly,2.7,1.7,(seed+k)*.6,0,TAU);ctx.fill();
    }
   }
  }else if(t===1){
   const depth=Math.max(0,Math.min(1,(s.water[i]||0)/100));
   ctx.fillStyle=palette.water;ctx.fillRect(px+2,py+2,cell-4,(cell-4)*depth);
   ctx.strokeStyle='rgba(224,255,255,.82)';ctx.lineWidth=1.4;
   const wave=(s.tick*.08+seed)%8;
   ctx.beginPath();ctx.moveTo(px+3+wave*.4,py+5);ctx.lineTo(px+9+wave*.4,py+5);ctx.stroke();
   // Submerged vegetation is visible independently of the water quantity.
   const weed=Math.max(0,Math.min(1,(s.waterweed?.[i]||0)/100));
   if(weed>.02){
    ctx.strokeStyle=palette.weed;ctx.lineWidth=2;ctx.lineCap='round';
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
  // Winter snow cover and the crystalline surface of shallow water are
  // purely visual: water resources, terrain passability and RNG are unchanged.
  if(season==='winter'){
   if(t===0||t===2){
    ctx.fillStyle=t===0?'rgba(247,251,255,.46)':'rgba(250,252,255,.36)';
    ctx.fillRect(px+1,py+1,cell-2,cell-2);
    ctx.fillStyle='rgba(255,255,255,.85)';
    ctx.fillRect(px+3+(seed%5),py+3,5,2);
    ctx.fillRect(px+10,py+12+(seed%3),6,2);
   }else if(t===1&&s.water[i]>0){
    ctx.fillStyle='rgba(231,249,255,.66)';
    ctx.fillRect(px+1,py+2,cell-2,cell-3);
    ctx.strokeStyle='rgba(255,255,255,.92)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(px+2,py+8);ctx.lineTo(px+9,py+4);
    ctx.lineTo(px+17,py+9);ctx.moveTo(px+9,py+4);
    ctx.lineTo(px+12,py+16);ctx.stroke();
   }
  }
 }
 // Seasonal tint is kept on terrain only; slimes maintain their own color.
 const seasonalTint={summer:'rgba(255,246,185,.10)',autumn:'rgba(231,136,65,.055)',winter:'rgba(224,240,255,.045)'};
 if(seasonalTint[season]){ctx.fillStyle=seasonalTint[season];ctx.fillRect(0,0,width,height);}
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
 // Eggs have a shell, do not move, and visibly develop before hatching.
 for(const egg of s.eggs){
  const shell=egg.g.shell,prog=egg.age/egg.hatchAt;
  const emergence=Math.min(1,(s.tick-(egg.bornTick??s.tick))/3);
  const x=(egg.birthX??egg.x)*(1-emergence)+egg.x*emergence;
  const y=(egg.birthY??egg.y)*(1-emergence)+egg.y*emergence;
  ctx.save();ctx.translate(x,y);ctx.scale(.65+.35*emergence,.65+.35*emergence);
  // Egg clusters can contain dozens of overlapping shells. A dark solid
  // shadow beneath EACH egg merges into an apparent black ground stain.
  // Give each egg a light shell rim instead; do not paint dark backplates.
  const eggColor=adaptationColor(egg.g);
  const eggRx=3.5+shell*2.1,eggRy=4.5+shell*2.1;
  ctx.fillStyle=`hsl(${eggColor.hue},${Math.max(35,eggColor.saturation*.62)}%,${Math.min(90,eggColor.lightness+17-shell*4)}%)`;
  ctx.beginPath();ctx.ellipse(0,0,eggRx,eggRy,0,0,TAU);ctx.fill();
  ctx.strokeStyle='rgba(252,255,232,.92)';ctx.lineWidth=.85+shell*.8;ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,.68)';ctx.beginPath();
  ctx.ellipse(-eggRx*.28,-eggRy*.30,Math.max(1,eggRx*.28),Math.max(.8,eggRy*.17),-.35,0,TAU);ctx.fill();
  // The developing embryo is a small colored dot, not a black opaque disk.
  ctx.fillStyle=`hsla(${eggColor.hue},${Math.max(45,eggColor.saturation*.75)}%,${Math.max(28,eggColor.lightness-22)}%,.72)`;
  ctx.beginPath();ctx.arc(.8,.3,Math.min(1.65,.65+prog*.75),0,TAU);ctx.fill();
  if(prog>.75){ctx.strokeStyle='#754765';ctx.beginPath();ctx.moveTo(-2,-3);ctx.lineTo(0,-1);ctx.lineTo(-1,2);ctx.stroke();}
  ctx.restore();
 }
 for(const u of [...s.corpses.filter(c=>c.mass>0).map(c=>({
   id:-1,x:c.x,y:c.y,angle:c.angle,g:c.g,age:c.deathAge,corpseMass:c.mass,corpseInitialMass:c.initialMass,
   stage:c.stage,dead:true,corpse:true,corpseAge:c.age,growthScale:c.growthScale??1,bite:0,woundFlash:0,fleeing:false,
   decayScale:Math.max(.18,Math.sqrt(Math.max(0,c.mass/c.initialMass)))
  })),...s.units]){
  const dead=!!u.corpse;
  const condition=organismVisualState(u);
  const g=u.g,signal=dietProfile(g).signal,life=vitality(u),
   scale=lifeStageScale(u)*(u.growthScale??1)*bodySizeMultiplier(g)*(1-life.old*.12)*(dead?u.decayScale:1),
   halfL=g.r*g.elongation*scale,halfW=g.r*scale,phase=s.tick*.18+u.id;
  if(dead){ctx.save();ctx.globalAlpha=.96*Math.max(.42,Math.sqrt(Math.max(0,u.corpseMass/u.corpseInitialMass)));}

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
  const fade=condition.lifeFade;
  const base=livingBodyColor(g,fade);
  const outline=livingBodyColor(g,fade,true);
  const simpleBody=dead||fade>=.995||s.units.length>250&&Math.max(rx,ry)<18&&u!==selected;
  const shine=simpleBody?base:ctx.createRadialGradient(-rx*.38,-ry*.42,0,0,0,Math.max(rx,ry)*1.45);
  if(!simpleBody){
   shine.addColorStop(0,`rgba(255,255,255,${.38*(1-fade)})`);
   shine.addColorStop(.36,base);shine.addColorStop(1,outline);
  }
  ctx.fillStyle=dead?'#9e9788':shine;ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,0,TAU);ctx.fill();
  ctx.strokeStyle=dead?'#655f56':outline;ctx.lineWidth=dead?1.5:1.6;ctx.stroke();
  // Above 250 organisms, radial gradients are too expensive to create for
  // every tiny slime. A cheap clipped sheen keeps the body glossy instead.
  if(!dead&&simpleBody&&fade<.98){
   ctx.save();ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,0,TAU);ctx.clip();
   ctx.fillStyle=`rgba(255,255,255,${(.16*(1-fade)).toFixed(3)})`;
   ctx.beginPath();ctx.ellipse(-rx*.29,-ry*.36,rx*.70,ry*.53,-.20,0,TAU);ctx.fill();
   ctx.restore();
  }
  if(condition.hit){
   ctx.fillStyle='rgba(255,92,75,.27)';ctx.fill();
   ctx.strokeStyle='rgba(255,89,65,.85)';ctx.lineWidth=2.4;ctx.stroke();
  }
  if(!dead&&fade<1){ctx.fillStyle=`rgba(255,255,255,${.36*(1-fade)})`;ctx.beginPath();
  ctx.ellipse(-rx*.30,-ry*.36,rx*.21,ry*.10,-.35,0,TAU);ctx.fill();}
  // Sickness: muted bruised skin and irregular blotches, not bright
  // green orbiting particles that can be mistaken for a positive buff.
  if(condition.infected){
   const severity=Math.max(.25,Math.min(1,(u.infection??0)/90));
   ctx.save();
   ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,0,TAU);ctx.clip();
   ctx.fillStyle=`rgba(91,35,83,${(.13+severity*.12).toFixed(3)})`;
   ctx.fillRect(-rx,-ry,rx*2,ry*2);
   // Fixed, asymmetric sores remain attached to the organism.
   // Avoid placing them over the central eye region.
   ctx.fillStyle='rgba(104,34,67,.61)';
   for(const [px,py,sx,sy] of [[-.42,.26,.17,.12],[.23,-.32,.14,.10],[.40,.35,.12,.09]]){
    ctx.beginPath();
    ctx.ellipse(px*rx,py*ry,Math.max(.9,sx*rx),Math.max(.75,sy*ry),-.4,0,TAU);
    ctx.fill();
   }
   ctx.restore();
   // A dim broken border makes infected individuals identifiable at a glance
   // without looking like a celebratory halo.
   ctx.strokeStyle='rgba(123,43,74,.78)';
   ctx.lineWidth=1.2;
   ctx.setLineDash([2.5,4.5]);
   ctx.beginPath();ctx.ellipse(0,0,rx+2,ry+2,0,0,TAU);ctx.stroke();
   ctx.setLineDash([]);
  }
  // Predator attack flashes toward its facing direction (+X in local space).
  if(condition.attacking){
   const strength=Math.min(1,(u.attackFlash??0)/16);
   ctx.strokeStyle=(u.defendFlash??0)>0?'rgba(75,240,231,.93)':'rgba(255,148,42,.92)';ctx.lineWidth=2+3*strength;
   ctx.beginPath();ctx.arc(0,0,Math.max(rx,ry)+4,-.68,.68);ctx.stroke();
   ctx.fillStyle='rgba(255,245,133,.90)';
   for(const a of [-.33,.33]){
    ctx.beginPath();ctx.arc((rx+6)*Math.cos(a),(ry+5)*Math.sin(a),1.4+strength*1.6,0,TAU);ctx.fill();
   }
  }
  // Solid-colored, body-harmonized eyes, set inside the oval rather than on the rim.
  // No sclera or mouth: these slimes eat by enveloping food.
  const eyes=slimeEyeAngles(g),eyeRadius=Math.max(1.2,Math.min(3.6,ry*.19));
  ctx.fillStyle=dead?'#77707e':slimeEyeColor(g);
  for(const angle of (dead?[]:eyes)){
   const {x:ex,y:ey}=slimeEyeLocation(angle,rx,ry);
   if(u.dormant){
    // Closed eyes follow the local body outline: straight, not smile-shaped.
    // Body rotation is inherited from the surrounding canvas transform.
    const tangent=closedEyeTangent(angle,rx,ry);
    ctx.strokeStyle=slimeEyeColor(g);ctx.lineWidth=Math.max(1,eyeRadius*.8);
    ctx.lineCap='round';
    ctx.beginPath();
    ctx.moveTo(ex-tangent.x*eyeRadius,ey-tangent.y*eyeRadius);
    ctx.lineTo(ex+tangent.x*eyeRadius,ey+tangent.y*eyeRadius);
    ctx.stroke();
    continue;
   }
   ctx.beginPath();ctx.arc(ex,ey,eyeRadius,0,TAU);ctx.fill();
   // A tiny glossy reflection gives readable eyes without white sclera.
   if(!dead){ctx.fillStyle='rgba(255,255,255,.82)';ctx.beginPath();ctx.arc(ex-eyeRadius*.30,ey-eyeRadius*.30,Math.max(.55,eyeRadius*.23),0,TAU);ctx.fill();ctx.fillStyle=slimeEyeColor(g);}
  }
  if(dead){
   // Remaining food mass is visible as a few warm nutrient granules.
   // Large bodies start with a larger nutrient stock and retain more granules.
   const relative=Math.max(0,u.corpseMass/u.corpseInitialMass);
   const particles=Math.min(12,Math.max(1,Math.floor(Math.sqrt(u.corpseMass)/2.7)));
   for(let i=0;i<particles;i++){
    const a=i*2.39996+(u.corpseAge??0)*.015;
    const rad=Math.sqrt((i+.5)/particles)*.78;
    ctx.fillStyle=i%3===0?'#d9cf98':'#7fa07a';
    ctx.beginPath();ctx.arc(Math.cos(a)*rx*rad,Math.sin(a)*ry*rad,Math.max(.9,Math.min(2.4,1.3+relative)),0,TAU);ctx.fill();
   }
  }
  if(!dead&&u===selected){
   ctx.save();ctx.rotate(-u.angle);
   ctx.font='bold 15px system-ui';ctx.textAlign='center';
   ctx.lineWidth=3;ctx.strokeStyle='rgba(18,31,55,.9)';
   const symbol=u.sex==='H'?'⚥':u.sex==='F'?'♀':'♂';
   ctx.strokeText(symbol,0,-ry-11);ctx.fillStyle='#fff';ctx.fillText(symbol,0,-ry-11);
   ctx.restore();
  }
  if(!dead&&u===selected){ctx.strokeStyle='white';ctx.beginPath();ctx.ellipse(0,0,rx+7,ry+7,0,0,TAU);ctx.stroke();}
  ctx.restore();
  if(dead)ctx.restore();
 }
 // Each gameplay action uses a distinct visual language; effect time is frame-based.
 if(showEffects){
  for(const fx of s.effects){
   if(!['strike','rivalStrike','consume','graze','waterweed','drink','scavenge'].includes(fx.type))continue;
   const life=(fx.type==='strike'||fx.type==='rivalStrike')?22:fx.type==='consume'?30:fx.type==='drink'?24:30;
   const t=Math.min(1,fx.age/life),fade=Math.max(0,1-t);
   if(fade<=0)continue;
   ctx.save();ctx.globalAlpha=fade;ctx.lineCap='round';
   if(fx.type==='strike'||fx.type==='rivalStrike'){
    // Orange strike trajectory connects attacker to the impact briefly.
    if(Number.isFinite(fx.fromX)&&Number.isFinite(fx.fromY)){
     ctx.strokeStyle='rgba(255,185,75,.65)';
     ctx.lineWidth=2.5*fade+.6;
     ctx.beginPath();ctx.moveTo(fx.fromX,fx.fromY);ctx.lineTo(fx.x,fx.y);ctx.stroke();
    }
    // Sharp, warm impact burst plus outward shock ring.
    ctx.strokeStyle=fx.type==='rivalStrike'?'#e244c5':'#ff633d';ctx.lineWidth=3.6*(1-t)+1;
    ctx.beginPath();ctx.arc(fx.x,fx.y,4+t*17,0,TAU);ctx.stroke();
    ctx.strokeStyle='#fff0a8';ctx.lineWidth=2.2*(1-t)+.4;
    for(let i=0;i<5;i++){const a=TAU*i/5;const inner=6+t*7,outer=inner+7*(1-t);
     ctx.beginPath();ctx.moveTo(fx.x+Math.cos(a)*inner,fx.y+Math.sin(a)*inner);
     ctx.lineTo(fx.x+Math.cos(a)*outer,fx.y+Math.sin(a)*outer);ctx.stroke();
    }
   }else if(fx.type==='consume'||fx.type==='scavenge'){
    // Fading, compact sparks preserve predation feedback without large rings.
    ctx.fillStyle=fx.type==='consume'?'#ffb0cf':'#cbb0ff';
    for(let i=0;i<3;i++){
     const angle=TAU*i/3,rad=7*(1-t)+1;
     ctx.beginPath();ctx.arc(fx.x+Math.cos(angle)*rad,fx.y+Math.sin(angle)*rad,1.8*(1-t)+.5,0,TAU);ctx.fill();
    }
   }else if(fx.type==='drink'){
    // No repeated drink ripples; water-seeking movement remains visible.
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
 // Seasonal particles: animated leaves and snow, based on time rather than RNG.
 if(season==='autumn'||season==='winter'){
  ctx.save();ctx.beginPath();ctx.rect(0,0,width,height);ctx.clip();
  const animation=s.visualTick??s.tick;
  const winter=season==='winter';
  const count=winter?42:22;
  for(let i=0;i<count;i++){
   const x=((i*97.31+animation*(winter?.48:1.1))%(width+40))-20;
   const y=((i*71.73+animation*(winter?.75:.42))%(height+30))-15;
   ctx.beginPath();
   if(winter){
    ctx.fillStyle='rgba(249,253,255,.83)';
    ctx.arc(x,y,1.2+(i%4)*.34,0,TAU);
   }else{
    ctx.fillStyle=['rgba(180,92,33,.7)','rgba(229,165,69,.75)','rgba(160,117,46,.65)'][i%3];
    ctx.ellipse(x,y,3+(i%3),1.8,(i*.65+animation*.025),0,TAU);
   }
   ctx.fill();
  }
  ctx.restore();
 }
 // Falling rain: deterministic diagonal streaks, never one particle object per drop.
 // This is visual-only and works even when the world is paused.
 if(s.weather==='rain'&&season!=='winter'){
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
 // Preserve only a brief, small death marker; combat and infection have
 // their own distinct animations. Other world-space notice rings are gone.
 if(showEffects)for(const f of s.effects){
  if(f.type!=='death')continue;
  ctx.save();ctx.globalAlpha=Math.max(0,1-f.age/24)*.8;
  ctx.strokeStyle='#ff8290';ctx.lineWidth=1.7;
  ctx.beginPath();ctx.arc(f.x,f.y,5+f.age*.38,0,TAU);ctx.stroke();
  ctx.restore();
 }
}
export function drawChart(ctx,history){const w=ctx.canvas.width,h=ctx.canvas.height;ctx.fillStyle='#172731';ctx.fillRect(0,0,w,h);if(history.length<2)return;for(const [k,color] of [['population','#77dc9a'],['food','#e6c56a'],['corpses','#bc8ed6']]){const max=Math.max(1,...history.map(d=>d[k]))*1.12;ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();history.forEach((d,i)=>{const x=i/(history.length-1)*w,y=h-6-d[k]/max*(h-14);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();}}
