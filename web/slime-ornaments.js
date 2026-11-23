// Soft, readable jelly ornaments made entirely of overlapping round shapes.
// Drawing only: genes, hitboxes, upkeep, movement and RNG are unchanged.
// The organism faces +X. The upper-right contour is its forehead.
import {adaptationColor,visibleOrnaments} from './simulation.js?v=2026.11.23.3';
const TAU=Math.PI*2;
const lim=v=>Math.max(0,Math.min(1,v??0));
export const ornamentTraits=g=>visibleOrnaments(g);
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
 // Low, rounded forehead horns remain inside the body outline, above the eyes.
 // Mirror across the forward-facing X axis.
 if(ornamentVisibility(tr.horn)>.08){
  const horn=ornamentVisibility(tr.horn);
  const r=Math.max(1.1,Math.min(ry*.23,ry*(.10+.12*horn)));
  const x=rx*.43,sideY=ry*.36;
  ctx.save();
  for(const side of [-1,1]){
   bead(ctx,x,side*sideY,r*1.12,r*1.10,c);
   if(horn>.55)bead(ctx,x+r*.13,side*(sideY+r*.32),r*.78,r*.78,c);
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
  // Small paired internal facial nubs: no protruding cheek spheres.
  const r=Math.max(1.05,Math.min(ry*.14,ry*(.075+.06*antenna)));
  const anchorX=rx*.40,anchorY=ry*.24;
  const sway=Math.sin(tick*.095+id*.31)*r*.18*antenna;
  const segments=antenna>.57?2:1;
  ctx.save();
  for(const side of [-1,1]){
   for(let j=0;j<=segments;j++){
    const x=anchorX+(j+1)*r*.23+sway;
    const y=side*(anchorY+(j+1)*r*.24);
    bead(ctx,x,y,r*(.94-.07*j),r*(.97-.07*j),c);
   }
  }
  ctx.restore();
 }
}

// Functional visual cues, shared by the world and the editor. Each editable
// ability contributes to at least one channel. No extra cosmetic DNA or RNG.
const n=(g,k,lo=0,hi=1)=>lim(((g[k]??lo)-lo)/(hi-lo));
export function abilityAppearance(g){
 return {
  mouth:n(g,'diet')*.45+n(g,'jaw',.2,2.5)*.3+n(g,'juvenileCannibalism')*.25,
  mouths:Math.round(g.mouths??1),
  membrane:n(g,'dry')*.28+n(g,'resist')*.26+n(g,'tempTolerance',3,18)*.26+n(g,'shell')*.20,
  warmth:n(g,'idealTemp',-5,40),
  reserve:n(g,'parentFeeding')*.26+n(g,'yolkReserve')*.32+n(g,'brood',1,8)*.22+n(g,'repro',0,2)*.20,
  leaf:n(g,'waterGardening'),
  fins:n(g,'aquatic')*.3+n(g,'wet')*.35+n(g,'dispersal')*.35,
  armor:n(g,'rock')*.34+n(g,'retaliation')*.33+n(g,'guard')*.33,
  freckles:n(g,'deception')*.45+n(g,'nesting')*.25+n(g,'nestChoice')*.30,
  glow:n(g,'frugality')*.45+n(g,'hibernate')*.35+n(g,'sociability')*.20,
  brow:n(g,'caution')*.45+n(g,'predatorSense')*.55,
  vitality:n(g,'longevity',.6,2),
  size:n(g,'r',3,15),shape:n(g,'elongation',.65,3),eyes:n(g,'eyes',0,6)
 };
}
export function drawAbilityDetails(ctx,g,rx,ry){
 const a=abilityAppearance(g);
 // Avoid expensive fine detail on tiny organisms. Major existing ornaments remain.
 if(Math.min(rx,ry)<3)return;
 const c=appearance(g);
 ctx.save();ctx.beginPath();ctx.ellipse(0,0,rx*.94,ry*.94,0,0,TAU);ctx.clip();
 // Thin membrane and warm/cool tint; never change the ecological color class.
 ctx.strokeStyle='rgba(245,255,255,'+(.08+a.membrane*.48)+')';
 ctx.lineWidth=Math.max(.25,ry*(.025+a.membrane*.055));
 ctx.beginPath();ctx.ellipse(0,0,rx*.86,ry*.85,0,0,TAU);ctx.stroke();
 // Constitution is visible as a subtle, curved metabolic pulse on the inner rim.
 ctx.strokeStyle='rgba(230,250,211,'+(.10+a.vitality*.65)+')';
 ctx.lineWidth=Math.max(.35,ry*(.025+.045*a.vitality));
 ctx.beginPath();ctx.ellipse(-rx*.12,0,rx*(.57+.13*a.vitality),ry*.65,0,-Math.PI*.72,Math.PI*.24);ctx.stroke();
 ctx.fillStyle='hsla('+(210-180*a.warmth)+',80%,65%,'+(.035+a.glow*.13)+')';
 ctx.beginPath();ctx.ellipse(-rx*.16,0,rx*.67,ry*.60,0,0,TAU);ctx.fill();
 // Internal reserves and camouflage, concentrated away from the eyes.
 for(let i=0;i<3;i++){
  const x=-rx*(.24+i*.17),y=ry*(i%2?.28:-.22);
  ctx.fillStyle='rgba(255,231,166,'+(.08+a.reserve*.42)+')';
  ctx.beginPath();ctx.ellipse(x,y,rx*(.035+a.reserve*.07),ry*(.04+a.reserve*.09),0,0,TAU);ctx.fill();
 }
 if(a.freckles>0){
  ctx.fillStyle=c.mark;
  for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(-rx*.48,ry*(i-1)*.32,rx*(.035+a.freckles*.055),ry*.07,0,0,TAU);ctx.fill();}
 }
 ctx.fillStyle='rgba(56,42,66,.68)';
 for(let i=0;i<a.mouths;i++){
  const y=(i-(a.mouths-1)/2)*ry*.19;
  ctx.beginPath();ctx.ellipse(rx*.88,y,Math.max(.2,rx*(.025+a.mouth*.035)),Math.max(.2,ry*(.045+a.mouth*.07)),0,0,TAU);ctx.fill();
 }
 if(a.armor>.15)for(const side of [-1,1]){
  bead(ctx,-rx*.16,side*ry*.73,ry*(.07+a.armor*.05),ry*.10,c,false);
 }
 if(a.leaf>.15){
  ctx.fillStyle='rgba(143,230,145,.8)';
  ctx.beginPath();ctx.ellipse(-rx*.70,-ry*.2,rx*.12,ry*(.10+a.leaf*.12),-.5,0,TAU);ctx.fill();
 }
 // Eyebrow-like soft sensory arcs convey alertness without aggressive faces.
 ctx.strokeStyle='rgba(245,255,255,'+(.08+a.brow*.40)+')';
 ctx.lineWidth=Math.max(.25,ry*(.02+a.brow*.035));
 for(const side of [-1,1]){
  ctx.beginPath();ctx.ellipse(rx*.48,side*ry*.52,rx*.13,ry*.06,side*.25,0,TAU);ctx.stroke();
 }
 ctx.restore();
 // Rounded fins, only when swimming ability justifies the silhouette.
 if(a.fins>.15){ctx.save();for(const side of [-1,1])bead(ctx,-rx*.37,side*ry*.87,ry*(.10+a.fins*.11),ry*.16,c,false);ctx.restore();}
}
