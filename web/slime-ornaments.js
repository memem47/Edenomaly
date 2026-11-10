// Soft, readable jelly ornaments made entirely of overlapping round shapes.
// Drawing only: genes, hitboxes, upkeep, movement and RNG are unchanged.
// The organism faces +X. The upper-right contour is its forehead.
import {adaptationColor} from './simulation.js?v=2026.11.11.8';
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

}
export function drawOrnamentsFront(ctx,g,rx,ry,tick=0,id=0){
 const tr=ornamentTraits(g),c=appearance(g);
 const pattern=ornamentVisibility(tr.pattern),antenna=ornamentVisibility(tr.antenna);
 // Symmetric head lobes are drawn AFTER the membrane so neither side is
 // hidden behind the slime. Mirror across the forward-facing X axis.
 if(ornamentVisibility(tr.horn)>.08){
  const horn=ornamentVisibility(tr.horn);
  const r=Math.max(1.1,Math.min(ry*.32,ry*(.16+.16*horn)));
  const x=rx*.48,sideY=ry*.87;
  ctx.save();
  for(const side of [-1,1]){
   bead(ctx,x,side*sideY,r*1.12,r*1.10,c);
   if(horn>.55)bead(ctx,x+r*.13,side*(sideY+r*.87),r*.78,r*.78,c);
  }
  ctx.restore();
 }

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
  // ALWAYS a matched pair, one on either side of the face. The two bulb
  // chains use identical X locations and opposite Y; no upper-only feelers.
  const r=Math.max(1.05,Math.min(ry*.28,ry*(.16+.10*antenna)));
  const anchorX=rx*.73,anchorY=ry*.53;
  const sway=Math.sin(tick*.095+id*.31)*r*.18*antenna;
  const segments=antenna>.57?2:1;
  ctx.save();
  for(const side of [-1,1]){
   for(let j=0;j<=segments;j++){
    const x=anchorX+(j+1)*r*.38+sway;
    const y=side*(anchorY+(j+1)*r*.43);
    bead(ctx,x,y,r*(.94-.07*j),r*(.97-.07*j),c);
   }
  }
  ctx.restore();
 }
}
