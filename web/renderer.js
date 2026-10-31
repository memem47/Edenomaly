import {WORLD,TERRAIN_COLORS,dietProfile} from './simulation.js';
const TAU=Math.PI*2;
export function drawWorld(ctx,s,showEffects=true,selected=null){
 const {cell,columns,rows,width,height}=WORLD;
 for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){ctx.fillStyle=TERRAIN_COLORS[s.tiles[y*columns+x]];ctx.fillRect(x*cell,y*cell,cell,cell);}
 ctx.strokeStyle='rgba(0,0,0,.11)';ctx.lineWidth=.5;ctx.beginPath();for(let x=0;x<width;x+=cell){ctx.moveTo(x,0);ctx.lineTo(x,height);}for(let y=0;y<height;y+=cell){ctx.moveTo(0,y);ctx.lineTo(width,y);}ctx.stroke();
 for(const f of s.food){ctx.fillStyle=f.source==='corpse'?'#f3cc78':'#b6f18b';ctx.beginPath();ctx.arc(f.x,f.y,2.5,0,TAU);ctx.fill();}
 for(const c of s.corpses){const radius=Math.max(2,Math.min(8,Math.sqrt(c.mass)*.9));ctx.fillStyle='#513553';ctx.beginPath();ctx.ellipse(c.x,c.y,radius*1.4,radius,0,0,TAU);ctx.fill();ctx.strokeStyle='#d9abd9';ctx.beginPath();ctx.moveTo(c.x-radius*.5,c.y-radius*.5);ctx.lineTo(c.x+radius*.5,c.y+radius*.5);ctx.moveTo(c.x+radius*.5,c.y-radius*.5);ctx.lineTo(c.x-radius*.5,c.y+radius*.5);ctx.stroke();}
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
  ctx.save();ctx.translate(egg.x,egg.y);
  ctx.fillStyle='#513e52';ctx.beginPath();ctx.ellipse(0,1,4.2+shell*2.3,5.3+shell*2.3,0,0,TAU);ctx.fill();
  ctx.fillStyle=`hsl(${egg.g.hue},${Math.max(35,egg.g.saturation*.65)}%,${Math.min(88,egg.g.lightness+14-shell*5)}%)`;ctx.beginPath();ctx.ellipse(0,0,3.5+shell*2.1,4.5+shell*2.1,0,0,TAU);ctx.fill();
  ctx.strokeStyle='#f0e4d0';ctx.lineWidth=.7+shell*1.2;ctx.stroke();
  ctx.fillStyle='#4d384d';ctx.beginPath();ctx.arc(1,0,Math.max(.6,1+prog*1.5),0,TAU);ctx.fill();
  if(prog>.75){ctx.strokeStyle='#754765';ctx.beginPath();ctx.moveTo(-2,-3);ctx.lineTo(0,-1);ctx.lineTo(-1,2);ctx.stroke();}
  ctx.restore();
 }
 for(const u of s.units){
  const g=u.g,signal=dietProfile(g).signal,scale=u.stage==='juvenile'?.55:1,halfL=g.r*g.elongation*scale,halfW=g.r*scale,phase=s.tick*.18+u.id;
  if(u.courtPartner||u.pregnancy){
   ctx.save();ctx.strokeStyle=u.pregnancy?'#ffe59b':'#ff93e9';ctx.lineWidth=2.5;
   ctx.beginPath();ctx.arc(u.x,u.y,Math.max(13,g.r*g.elongation+8),0,TAU);ctx.stroke();
   ctx.fillStyle=u.pregnancy?'#ffe59b':'#ffd5f5';ctx.font='bold 12px system-ui';ctx.textAlign='center';
   if(u.pregnancy){const v=1-u.pregnancy.remaining/u.pregnancy.total;ctx.beginPath();ctx.arc(u.x,u.y,Math.max(13,g.r*g.elongation+8)+4,-Math.PI/2,-Math.PI/2+TAU*v);ctx.stroke();}else{ctx.beginPath();ctx.arc(u.x,u.y,Math.max(13,g.r*g.elongation+8)+3,0,TAU);ctx.stroke();}ctx.restore();
  }
  ctx.save();ctx.translate(u.x,u.y);ctx.rotate(u.angle);
  // Body shadow and soft body. The collider and costs use the same dimensions indirectly.
  ctx.fillStyle='rgba(0,0,0,.26)';ctx.beginPath();ctx.ellipse(1.5,2,halfL*1.09,halfW*1.1,0,0,TAU);ctx.fill();
  // Legs: symmetric pairs along the longitudinal axis, moving with phase.
  ctx.lineCap='round';ctx.lineWidth=Math.max(1.5,halfW*.32);ctx.strokeStyle=`hsl(${(g.hue+24)%360},${Math.max(40,g.saturation-18)}%,${Math.max(25,g.lightness-17)}%)`;
  for(let i=0;i<g.legs/2;i++)for(const side of [-1,1]){
   const x=(i+1)/(g.legs/2+1)*halfL*1.5-halfL*.75;
   const wave=Math.sin(phase+i*2+side)*halfW*.22;
   ctx.beginPath();ctx.moveTo(x,side*halfW*.64);ctx.lineTo(x-halfW*.15+wave,side*halfW*1.35);ctx.lineTo(x+wave,side*halfW*1.62);ctx.stroke();
  }
  // Visible feeding signal: round leafy feelers for apparent grazers, sharp spines for apparent hunters.
  // The signal is inherited separately from the actual diet, enabling deceptive appearances.
  if(signal<.45){
   ctx.strokeStyle=`hsl(${(g.hue+90)%360},73%,75%)`;ctx.lineWidth=Math.max(1,halfW*.19);
   for(const side of [-1,1]){
    ctx.beginPath();ctx.moveTo(-halfL*.38,side*halfW*.65);
    ctx.quadraticCurveTo(-halfL*.65,side*halfW*1.55,-halfL*.82,side*halfW*1.65);ctx.stroke();
    ctx.fillStyle='#b5f6af';ctx.beginPath();ctx.ellipse(-halfL*.84,side*halfW*1.66,halfW*.22,halfW*.40,side*.5,0,TAU);ctx.fill();
   }
  }else if(signal>.55){
   const spikes=2+Math.floor(signal*4);
   ctx.fillStyle=`hsl(${(g.hue+25)%360},${g.saturation}%,${Math.max(24,g.lightness-18)}%)`;
   for(let i=0;i<spikes;i++){
    const x=-halfL*.7+i*halfL*1.4/Math.max(1,spikes-1);
    ctx.beginPath();ctx.moveTo(x-halfL*.13,-halfW*.65);ctx.lineTo(x, -halfW*(1.35+signal*.5));ctx.lineTo(x+halfL*.13,-halfW*.65);ctx.fill();
   }
  }
  ctx.fillStyle=`hsl(${g.hue},${g.saturation}%,${g.lightness}%)`;ctx.beginPath();ctx.ellipse(0,0,halfL,halfW,0,0,TAU);ctx.fill();
  // Heritable spots, stripes and dorsal marks distinguish siblings and lineages.
  ctx.save();ctx.beginPath();ctx.ellipse(0,0,halfL,halfW,0,0,TAU);ctx.clip();
  ctx.strokeStyle=`hsla(${(g.hue+165)%360},85%,83%,.67)`;ctx.fillStyle=`hsla(${(g.hue+165)%360},85%,85%,.48)`;
  if(g.pattern===1){for(let i=-2;i<=2;i++){ctx.beginPath();ctx.arc(i*halfL*.31,Math.sin(i*2)*halfW*.42,Math.max(1.1,halfW*.20),0,TAU);ctx.fill();}}
  if(g.pattern===2){ctx.lineWidth=Math.max(1.4,halfW*.23);for(let i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(i*halfL*.36-halfW*.25,-halfW);ctx.lineTo(i*halfL*.36+halfW*.25,halfW);ctx.stroke();}}
  if(g.pattern===3){ctx.lineWidth=Math.max(1.3,halfW*.28);ctx.beginPath();ctx.moveTo(-halfL*.85,0);ctx.lineTo(halfL*.85,0);ctx.stroke();for(let i=-2;i<=2;i++){ctx.beginPath();ctx.arc(i*halfL*.34,0,halfW*.15,0,TAU);ctx.fill();}}
  ctx.restore();
  if(u.pregnancy){const n=u.pregnancy.genomes.length;ctx.fillStyle='#ffe9a6';for(let i=0;i<Math.min(n,8);i++){const a=i*TAU/n;ctx.beginPath();ctx.arc(-halfL*.25+Math.cos(a)*halfL*.23,Math.sin(a)*halfW*.39,Math.max(1.2,halfW*.14),0,TAU);ctx.fill();}}
  ctx.strokeStyle='rgba(255,255,255,.58)';ctx.lineWidth=1;ctx.stroke();
  // Eye rows: zero eyes is possible, causing very short perception range.
  const er=Math.max(1.45,Math.min(2.6,halfW*.31));
  for(let i=0;i<g.eyes;i++){
   const row=Math.floor(i/2),side=i%2===0?-1:1;
   const ex=halfL*(.37-row*.29),ey=side*halfW*.47;
   ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ex,ey,er,0,TAU);ctx.fill();
   ctx.fillStyle='#263345';ctx.beginPath();ctx.arc(ex+er*.3,ey,er*.49,0,TAU);ctx.fill();
  }
  // Mouths along leading edge. Large jaw and active bite create an unsettling maw.
  for(let i=0;i<g.mouths;i++){
   const offset=(i-(g.mouths-1)/2)*halfW*.55;
   const radius=Math.max(1.1,g.jaw*(u.bite>0?2.8:1.05));
   ctx.fillStyle=u.bite>0?'#3c102e':'#713a4f';ctx.beginPath();ctx.ellipse(halfL*.79,offset,radius*1.13,radius,0,0,TAU);ctx.fill();
   if(u.bite>0){ctx.fillStyle='#ffe6dd';for(const side of [-1,1]){
    ctx.beginPath();ctx.moveTo(halfL*.7,offset+side*radius*.85);ctx.lineTo(halfL*.91,offset);ctx.lineTo(halfL*1.04,offset+side*radius*.8);ctx.fill();
   }}
  }
  // Warning appearance: tooth-like marks can be bluff, not necessarily actual predation.
  if(signal>.50){
   ctx.fillStyle='#fff6e8';
   for(let j=0;j<Math.round(1+signal*3);j++){
    const y=(j-(Math.round(1+signal*3)-1)/2)*halfW*.40;
    ctx.beginPath();ctx.moveTo(halfL*.84,y-halfW*.14);ctx.lineTo(halfL*(1.04+signal*.07),y);ctx.lineTo(halfL*.84,y+halfW*.14);ctx.fill();
   }
  }
  if(u.fleeing){ctx.strokeStyle='#eefcff';ctx.lineWidth=1.8;ctx.beginPath();ctx.arc(-halfL*.35,0,Math.max(3,halfW*.7),-.9,.9);ctx.stroke();}
  if(u===selected){ctx.strokeStyle='white';ctx.lineWidth=1.3;ctx.beginPath();ctx.ellipse(0,0,halfL+7,halfW+7,0,0,TAU);ctx.stroke();}
  ctx.restore();
 }
 if(showEffects){const colors={birth:'#91f7ac',death:'#ff8290',meal:'#f9d36b',pred:'#be82ec',new:'#ffe486',decay:'#e2b96e',mate:'#f5a5ed',egg:'#efd6a4',hatch:'#95eec2',eggeaten:'#f7818d'};for(const f of s.effects){ctx.save();ctx.globalAlpha=Math.max(0,1-f.age/35);ctx.strokeStyle=colors[f.type]||'#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(f.x,f.y,5+f.age*.65,0,TAU);ctx.stroke();ctx.restore();}}
}
export function drawChart(ctx,history){const w=ctx.canvas.width,h=ctx.canvas.height;ctx.fillStyle='#172731';ctx.fillRect(0,0,w,h);if(history.length<2)return;for(const [k,color] of [['population','#77dc9a'],['food','#e6c56a'],['corpses','#bc8ed6']]){const max=Math.max(1,...history.map(d=>d[k]))*1.12;ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();history.forEach((d,i)=>{const x=i/(history.length-1)*w,y=h-6-d[k]/max*(h-14);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();}}
