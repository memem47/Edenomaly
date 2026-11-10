// Readable, inherited 2D appendages. This module is DRAWING ONLY: it never
// changes a gene, hitbox, habitat fitness, ecosystem tick, or random state.
// Organism faces +X after renderer rotation. Amplification is deliberately
// nonlinear: a 0.10 gene should be visible at ordinary 1x zoom.
import {adaptationColor} from './simulation.js?v=2026.11.11.4';
const TAU=Math.PI*2;
const lim=v=>Math.max(0,Math.min(1,v??0));
export const ornamentTraits=g=>({
 tail:lim(g.tailLength),horn:lim(g.hornLength),
 antenna:lim(g.antennaLength),pattern:lim(g.pattern)
});
// No embellishment at zero; continuous, easily visible growth beyond zero.
export const ornamentVisibility=v=>Math.pow(lim(v),.43);
const appearance=g=>{
 const c=adaptationColor(g),h=c.hue,s=c.saturation,l=c.lightness;
 return {
  body:`hsla(${h},${s}%,${Math.min(92,l+11)}%,.94)`,
  rim:`hsla(${h},${Math.min(100,s+6)}%,${Math.max(13,l-29)}%,.92)`,
  gleam:`hsla(${h},${Math.max(22,s*.5)}%,${Math.min(98,l+34)}%,.69)`,
  mark:`hsla(${(h+25)%360},${Math.min(100,s+13)}%,${Math.max(10,l-29)}%,.61)`
 };
};
const strokeFill=(ctx,col,stroke,width)=>{
 ctx.fillStyle=col;ctx.strokeStyle=stroke;ctx.lineWidth=width;
 ctx.fill();ctx.stroke();
};
// Body and protrusions are drawn in world-space so zoom works naturally.
// Extent is at most a few body radii to avoid large visual obstruction.
export function drawOrnamentsBehind(ctx,g,rx,ry,tick=0,id=0){
 const traits=ornamentTraits(g),c=appearance(g);
 const tail=ornamentVisibility(traits.tail),horn=ornamentVisibility(traits.horn);
 if(tail>.08){
  // Long tapering tail, broad at the base; animated gently in the transverse
  // direction. It extends behind the slime instead of hiding in its body.
  const reach=Math.max(3,rx*(.62+1.56*tail));
  const breadth=Math.max(1.4,ry*(.19+.42*tail));
  const swish=Math.sin(tick*.12+id*.47)*ry*.31*tail;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-rx*.73,-breadth);
  ctx.bezierCurveTo(-rx-reach*.28,-breadth*1.17,
   -rx-reach*.69,swish-breadth*.44,-rx-reach,swish);
  ctx.bezierCurveTo(-rx-reach*.75,swish+breadth*.45,
   -rx-reach*.23,breadth*1.20,-rx*.73,breadth);
  ctx.closePath();
  strokeFill(ctx,c.body,c.rim,Math.max(.8,Math.min(1.9,ry*.15)));
  ctx.strokeStyle=c.gleam;ctx.lineWidth=Math.max(.65,ry*.09);
  ctx.beginPath();ctx.moveTo(-rx*.95,-breadth*.52);
  ctx.quadraticCurveTo(-rx-reach*.43,swish-breadth*.4,-rx-reach*.83,swish);
  ctx.stroke();ctx.restore();
 }
 if(horn>.08){
  // Two dorsal spikes are offset from the face/eyes and are long enough to
  // read as horns instead of tiny marks. Low guard genes retain one horn.
  const count=(g.guard??0)>.57?2:1;
  const reach=Math.max(3.1,ry*(.70+1.65*horn));
  const breadth=Math.max(1.45,ry*(.20+.25*horn));
  ctx.save();
  for(let k=0;k<count;k++){
   const bx=count===1?rx*.02:(k===0?-rx*.38:rx*.34);
   const baseY=-ry*.72;
   const tipX=bx+(k===0?-.28:.34)*reach;
   const tipY=-ry-reach;
   ctx.beginPath();ctx.moveTo(bx-breadth,baseY+.8);
   ctx.quadraticCurveTo(bx-breadth*.65,baseY-reach*.60,tipX,tipY);
   ctx.quadraticCurveTo(bx+breadth*.80,baseY-reach*.52,bx+breadth,baseY+.8);
   ctx.closePath();strokeFill(ctx,c.body,c.rim,Math.max(.8,Math.min(2,ry*.13)));
   ctx.strokeStyle=c.gleam;ctx.lineWidth=Math.max(.65,ry*.08);
   ctx.beginPath();ctx.moveTo(bx-breadth*.32,baseY-reach*.20);
   ctx.quadraticCurveTo(bx-breadth*.38,baseY-reach*.67,tipX,tipY+.8);
   ctx.stroke();
  }
  ctx.restore();
 }
}
export function drawOrnamentsFront(ctx,g,rx,ry,tick=0,id=0){
 const tr=ornamentTraits(g),c=appearance(g);
 const pattern=ornamentVisibility(tr.pattern),antenna=ornamentVisibility(tr.antenna);
 if(pattern>.10){
  ctx.save();ctx.beginPath();ctx.ellipse(0,0,rx*.94,ry*.92,0,0,TAU);ctx.clip();
  ctx.fillStyle=c.mark;
  if((g.deception??.5)>.55){
   // Wide stripes, three distinct bands, still clipped to the membrane.
   for(let i=0;i<3;i++){
    const x=(-.54+i*.54)*rx;
    ctx.beginPath();ctx.ellipse(x,0,Math.max(1.15,rx*(.10+.055*pattern)),
     ry*.74,-.17,0,TAU);ctx.fill();
   }
  }else{
   // Eye-safe large spots; stable positions depend on identity, not RNG.
   const n=3+Math.round(4*pattern);
   for(let i=0;i<n;i++){
    const a=i*2.399963+id*.07,rad=Math.sqrt((i+.45)/(n+1))*.64;
    const x=rx*Math.cos(a)*rad,y=ry*Math.sin(a)*rad;
    ctx.beginPath();ctx.ellipse(x,y,Math.max(1.1,rx*(.09+.065*pattern)),
     Math.max(.95,ry*(.08+.06*pattern)),a*.35,0,TAU);ctx.fill();
   }
  }
  ctx.restore();
 }
 if(antenna>.10){
  // Sensory feelers emerge from the upper front edge rather than from the
  // eye positions; tips are bright and are visible without zoom.
  const count=(g.eyes??0)>2?2:1;
  const reach=Math.max(4,ry*(.85+1.65*antenna));
  const swish=Math.sin(tick*.11+id*.31)*ry*.15*antenna;
  ctx.save();ctx.lineCap='round';
  for(let k=0;k<count;k++){
   const ox=count===1?rx*.20:(k===0?rx*.0:rx*.52);
   const oy=-ry*.72;
   const tx=ox+reach*(k===0?-.33:.48)+swish;
   const ty=oy-reach*(k===0?.86:.78);
   ctx.strokeStyle=c.rim;ctx.lineWidth=Math.max(1.05,Math.min(2.5,ry*.17));
   ctx.beginPath();ctx.moveTo(ox,oy);
   ctx.quadraticCurveTo(tx+reach*.2,oy-reach*.56,tx,ty);ctx.stroke();
   ctx.fillStyle=c.gleam;
   ctx.beginPath();ctx.arc(tx,ty,Math.max(1.25,Math.min(3.5,ry*(.19+.13*antenna))),0,TAU);
   ctx.fill();
  }
  ctx.restore();
 }
}
