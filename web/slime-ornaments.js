// Inherited organism ornaments. All four shapes are calculated from
// genetics and current simulation tick; they never sample simulation RNG.
// +X is the organism's front, -X the rear.
import {adaptationColor} from './simulation.js?v=2026.11.09.6';
const TAU=Math.PI*2;
const lim=(v)=>Math.max(0,Math.min(1,v??0));
export const ornamentTraits=g=>({
 tail:lim(g.tailLength),horn:lim(g.hornLength),
 antenna:lim(g.antennaLength),pattern:lim(g.pattern)
});
export function drawOrnamentsBehind(ctx,g,rx,ry,tick=0,id=0){
 const tr=ornamentTraits(g),color=adaptationColor(g),hue=color.hue;
 if(tr.tail>.035){
  const wave=Math.sin(tick*.14+id*.4)*tr.tail*ry*.28;
  const length=rx*(.16+.95*tr.tail),width=ry*(.09+.22*tr.tail);
  ctx.save();
  ctx.fillStyle=`hsla(${hue},${color.saturation}%,${Math.min(85,color.lightness+2)}%,.78)`;
  ctx.strokeStyle=`hsla(${hue},${color.saturation}%,${Math.max(20,color.lightness-21)}%,.77)`;
  ctx.lineWidth=Math.max(.5,Math.min(1.5,ry*.1));
  ctx.beginPath();ctx.moveTo(-rx*.76,-width);
  ctx.bezierCurveTo(-rx-length*.50,-width*1.1+wave,-rx-length*.95,wave-width*.25,-rx-length,wave);
  ctx.bezierCurveTo(-rx-length*.92,wave+width*.32,-rx-length*.45,width*.85,-rx*.76,width);
  ctx.closePath();ctx.fill();ctx.stroke();
  ctx.restore();
 }
 // Horns are jelly-covered raised nubs, not disconnected rigid triangles.
 if(tr.horn>.09){
  const length=ry*(.18+.75*tr.horn);
  const width=ry*(.11+.15*tr.horn);
  const count=(g.guard??0)>.62?2:1;
  ctx.save();
  ctx.fillStyle=`hsla(${hue},${color.saturation}%,${Math.min(95,color.lightness+9)}%,.93)`;
  ctx.strokeStyle=`hsla(${hue},${color.saturation}%,${Math.max(18,color.lightness-26)}%,.76)`;
  ctx.lineWidth=Math.max(.45,Math.min(1.3,ry*.09));
  for(let k=0;k<count;k++){
   const cy=count===1?0:(k===0?-ry*.47:ry*.47);
   const bx=rx*.65,by=cy,tipX=rx*.82+length*.74,tipY=cy+(k===0?-1:1)*length*.30;
   ctx.beginPath();ctx.moveTo(bx-width,by-width);
   ctx.quadraticCurveTo(tipX,tipY-width*.28,tipX,tipY);
   ctx.quadraticCurveTo(bx+width,by+width,bx-width,by+width);
   ctx.closePath();ctx.fill();ctx.stroke();
  }
  ctx.restore();
 }
}
export function drawOrnamentsFront(ctx,g,rx,ry,tick=0,id=0){
 const tr=ornamentTraits(g),color=adaptationColor(g),hue=color.hue;
 // Keep markings under the eyes by drawing in the local body coordinate system.
 if(tr.pattern>.14){
  ctx.save();ctx.beginPath();ctx.ellipse(0,0,rx*.96,ry*.96,0,0,TAU);ctx.clip();
  ctx.fillStyle=`hsla(${(hue+21)%360},${Math.min(90,color.saturation*.85)}%,${Math.max(18,color.lightness-19)}%,${.09+.29*tr.pattern})`;
  if((g.deception??.5)>.55){
   // Curved inherited stripes follow the long axis.
   for(let i=0;i<3;i++){
    const x=(-.50+i*.47)*rx;
    ctx.beginPath();ctx.ellipse(x,0,Math.max(.7,rx*.095),ry*.66,-.22,0,TAU);ctx.fill();
   }
  }else{
   // Spots have stable locations independent of ecology RNG.
   const n=2+Math.round(tr.pattern*6);
   for(let i=0;i<n;i++){
    const a=i*2.399963+id*.13,rad=Math.sqrt((i+.4)/(n+1))*.63;
    const px=rx*Math.cos(a)*rad,py=ry*Math.sin(a)*rad;
    ctx.beginPath();ctx.ellipse(px,py,Math.max(.65,rx*(.065+.025*(i%3))),Math.max(.55,ry*.09),a,0,TAU);ctx.fill();
   }
  }
  ctx.restore();
 }
 if(tr.antenna>.06){
  const length=ry*(.33+1.15*tr.antenna);
  const sway=Math.sin(tick*.10+id*.31)*ry*.08*tr.antenna;
  const count=(g.eyes??0)>2?2:1;
  ctx.save();ctx.lineCap='round';
  ctx.strokeStyle=`hsla(${hue},${Math.max(40,color.saturation)}%,${Math.max(22,color.lightness-18)}%,.92)`;
  ctx.lineWidth=Math.max(.55,Math.min(1.45,ry*.11));
  for(let k=0;k<count;k++){
   const sy=count===1?0:(k===0?-ry*.34:ry*.34);
   const ex=rx*.84+length*.45,ey=sy+(k===0?-1:1)*length*.60+sway;
   ctx.beginPath();ctx.moveTo(rx*.59,sy);
   ctx.quadraticCurveTo(rx*.83+length*.2,sy-length*.4,ex,ey);
   ctx.stroke();
   ctx.fillStyle=`hsla(${hue},${color.saturation}%,${Math.min(90,color.lightness+19)}%,.92)`;
   ctx.beginPath();ctx.arc(ex,ey,Math.max(.7,Math.min(2.6,ry*.15)),0,TAU);ctx.fill();
  }
  ctx.restore();
 }
}
