// Soft, readable jelly ornaments made entirely of overlapping round shapes.
// Drawing only: genes, hitboxes, upkeep, movement and RNG are unchanged.
// The organism faces +X. The upper-right contour is its forehead.
import {adaptationColor} from './simulation.js?v=2026.11.11.5';
const TAU=Math.PI*2;
const lim=v=>Math.max(0,Math.min(1,v??0));
export const ornamentTraits=g=>({
 tail:lim(g.tailLength),horn:lim(g.hornLength),
 antenna:lim(g.antennaLength),pattern:lim(g.pattern)
});
// Magnify small expressions visually without changing the underlying trait.
export const ornamentVisibility=v=>Math.pow(lim(v),.43);
const appearance=g=>{
 const c=adaptationColor(g),h=c.hue,s=c.saturation,l=c.lightness;
 return {
  body:`hsla(${h},${s}%,${Math.min(93,l+12)}%,.94)`,
  rim:`hsla(${h},${Math.min(92,s+4)}%,${Math.max(21,l-23)}%,.7)`,
  gleam:`hsla(${h},${Math.max(16,s*.48)}%,${Math.min(98,l+33)}%,.62)`,
  mark:`hsla(${(h+12)%360},${Math.max(28,s*.67)}%,${Math.max(30,l-12)}%,.30)`
 };
};
const bead=(ctx,x,y,rx,ry,c,outline=true)=>{
 ctx.beginPath();ctx.ellipse(x,y,Math.max(.45,rx),Math.max(.45,ry),0,0,TAU);
 ctx.fillStyle=c.body;ctx.fill();
 if(outline){
  ctx.strokeStyle=c.rim;ctx.lineWidth=Math.max(.48,Math.min(1.1,Math.min(rx,ry)*.14));ctx.stroke();
 }
 // A soft bubble gleam: a distinct small oval, not a sharp line.
 if(Math.min(rx,ry)>1.25){
  ctx.beginPath();ctx.ellipse(x-rx*.23,y-ry*.24,rx*.30,ry*.18,-.25,0,TAU);
  ctx.fillStyle=c.gleam;ctx.fill();
 }
};
export const headAnchor=(rx,ry)=>({x:rx*.47,y:-ry*.68});
export function drawOrnamentsBehind(ctx,g,rx,ry,tick=0,id=0){
 const tr=ornamentTraits(g),c=appearance(g);
 const tail=ornamentVisibility(tr.tail),horn=ornamentVisibility(tr.horn);
 if(tail>.08){
  // A slightly swaying chain of one to three overlapping jelly bubbles.
  // The first bead starts inside the body, so there is no disconnected tail.
  const segments=tail<.36?1:tail<.70?2:3;
  const radius=Math.max(1.3,Math.min(ry*.43,ry*(.25+.14*tail)));
  const gap=radius*1.55;
  const sway=Math.sin(tick*.11+id*.37)*radius*.39*tail;
  ctx.save();
  for(let i=0;i<segments;i++){
   const taper=1-i*.13;
   const x=-rx*.90-radius*.55-i*gap;
   const y=(i+1)/segments*sway;
   bead(ctx,x,y,radius*taper,radius*.89*taper,c);
  }
  ctx.restore();
 }
 if(horn>.08){
  // Soft forehead nubs, not spikes. Both stay on the front half of the head.
  // The whole extension is built from round overlapping beads.
  const two=(g.guard??0)>.57;
  const count=two?2:1;
  const {x:headX,y:headY}=headAnchor(rx,ry);
  const r=Math.max(1.1,Math.min(ry*.35,ry*(.18+.19*horn)));
  ctx.save();
  for(let k=0;k<count;k++){
   const shift=count===1?0:(k===0?-rx*.18:rx*.22);
   const x=headX+shift;
   const y=headY+(k===0?ry*.04:ry*.12);
   bead(ctx,x,y,r*1.18,r*1.12,c);
   if(horn>.55)bead(ctx,x+r*.08,y-r*.97,r*.83,r*.84,c);
  }
  ctx.restore();
 }
}
export function drawOrnamentsFront(ctx,g,rx,ry,tick=0,id=0){
 const tr=ornamentTraits(g),c=appearance(g);
 const pattern=ornamentVisibility(tr.pattern),antenna=ornamentVisibility(tr.antenna);
 if(pattern>.10){
  // Low-contrast spots, cheeks and oval belly markings. No harsh stripes.
  ctx.save();
  ctx.beginPath();ctx.ellipse(0,0,rx*.93,ry*.90,0,0,TAU);ctx.clip();
  ctx.fillStyle=c.mark;
  const freckles=(g.deception??.5)>.55?4:3+Math.round(2*pattern);
  for(let i=0;i<freckles;i++){
   const a=2.4*i+.35,rad=.36+.15*((i%3)/2);
   const x=rx*Math.cos(a)*rad,y=ry*Math.sin(a)*rad;
   ctx.beginPath();ctx.ellipse(x,y,
    Math.max(.65,rx*(.075+.035*pattern)),
    Math.max(.5,ry*(.085+.035*pattern)),0,0,TAU);ctx.fill();
  }
  ctx.restore();
 }
 if(antenna>.10){
  // Only the forehead can host antennae. Round overlapping jelly nodes
  // replace creepy thin filament strokes; never attach at the torso/rear.
  const count=(g.eyes??0)>2?2:1;
  const {x:headX,y:headY}=headAnchor(rx,ry);
  const r=Math.max(1.05,Math.min(ry*.31,ry*(.16+.11*antenna)));
  const sway=Math.sin(tick*.095+id*.31)*r*.26*antenna;
  ctx.save();
  for(let k=0;k<count;k++){
   const dx=count===1?0:(k===0?-rx*.13:rx*.20);
   const bx=headX+dx;
   const by=headY+ry*.02;
   const length=antenna>.57?2:1;
   // A short plump antenna: 1–2 connected balls and a rounded tip.
   for(let j=0;j<length;j++){
    const x=bx+(j+1)*r*.38+sway*(j+1)/length;
    const y=by-(j+1)*r*.72;
    bead(ctx,x,y,r*(.97-.10*j),r*(1.08-.09*j),c);
   }
   bead(ctx,bx+(length+1)*r*.37+sway,by-(length+1)*r*.72,
    r*.96,r*.94,c);
  }
  ctx.restore();
 }
}
