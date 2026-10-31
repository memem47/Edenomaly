import {WORLD,TERRAIN_COLORS} from './simulation.js';
const TAU=Math.PI*2;
export function drawWorld(ctx,s,showEffects=true,selected=null){
 const {cell,columns,rows,width,height}=WORLD;
 for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){ctx.fillStyle=TERRAIN_COLORS[s.tiles[y*columns+x]];ctx.fillRect(x*cell,y*cell,cell,cell);}
 ctx.strokeStyle='rgba(0,0,0,.11)';ctx.lineWidth=.5;ctx.beginPath();for(let x=0;x<width;x+=cell){ctx.moveTo(x,0);ctx.lineTo(x,height);}for(let y=0;y<height;y+=cell){ctx.moveTo(0,y);ctx.lineTo(width,y);}ctx.stroke();
 for(const f of s.food){ctx.fillStyle=f.source==='corpse'?'#f3cc78':'#b6f18b';ctx.beginPath();ctx.arc(f.x,f.y,2.5,0,TAU);ctx.fill();}
 for(const c of s.corpses){const radius=Math.max(2,Math.min(8,Math.sqrt(c.mass)*.9));ctx.fillStyle='#513553';ctx.beginPath();ctx.ellipse(c.x,c.y,radius*1.4,radius,0,0,TAU);ctx.fill();ctx.strokeStyle='#d9abd9';ctx.beginPath();ctx.moveTo(c.x-radius*.5,c.y-radius*.5);ctx.lineTo(c.x+radius*.5,c.y+radius*.5);ctx.moveTo(c.x+radius*.5,c.y-radius*.5);ctx.lineTo(c.x-radius*.5,c.y+radius*.5);ctx.stroke();}
 for(const u of s.units){
  const g=u.g,halfL=g.r*g.elongation,halfW=g.r,phase=s.tick*.18+u.id;
  ctx.save();ctx.translate(u.x,u.y);ctx.rotate(u.angle);
  // Body shadow and soft body. The collider and costs use the same dimensions indirectly.
  ctx.fillStyle='rgba(0,0,0,.26)';ctx.beginPath();ctx.ellipse(1.5,2,halfL*1.09,halfW*1.1,0,0,TAU);ctx.fill();
  // Legs: symmetric pairs along the longitudinal axis, moving with phase.
  ctx.lineCap='round';ctx.lineWidth=Math.max(1.5,halfW*.32);ctx.strokeStyle=`hsl(${g.hue},57%,51%)`;
  for(let i=0;i<g.legs/2;i++)for(const side of [-1,1]){
   const x=(i+1)/(g.legs/2+1)*halfL*1.5-halfL*.75;
   const wave=Math.sin(phase+i*2+side)*halfW*.22;
   ctx.beginPath();ctx.moveTo(x,side*halfW*.64);ctx.lineTo(x-halfW*.15+wave,side*halfW*1.35);ctx.lineTo(x+wave,side*halfW*1.62);ctx.stroke();
  }
  ctx.fillStyle=`hsl(${g.hue},75%,69%)`;ctx.beginPath();ctx.ellipse(0,0,halfL,halfW,0,0,TAU);ctx.fill();
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
  if(u===selected){ctx.strokeStyle='white';ctx.lineWidth=1.3;ctx.beginPath();ctx.ellipse(0,0,halfL+7,halfW+7,0,0,TAU);ctx.stroke();}
  ctx.restore();
 }
 if(showEffects){const colors={birth:'#91f7ac',death:'#ff8290',meal:'#f9d36b',pred:'#be82ec',new:'#ffe486',decay:'#e2b96e'};for(const f of s.effects){ctx.save();ctx.globalAlpha=Math.max(0,1-f.age/35);ctx.strokeStyle=colors[f.type]||'#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(f.x,f.y,5+f.age*.65,0,TAU);ctx.stroke();ctx.restore();}}
}
export function drawChart(ctx,history){const w=ctx.canvas.width,h=ctx.canvas.height;ctx.fillStyle='#172731';ctx.fillRect(0,0,w,h);if(history.length<2)return;for(const [k,color] of [['population','#77dc9a'],['food','#e6c56a'],['corpses','#bc8ed6']]){const max=Math.max(1,...history.map(d=>d[k]))*1.12;ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();history.forEach((d,i)=>{const x=i/(history.length-1)*w,y=h-6-d[k]/max*(h-14);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();}}
