// Jelly-quality 2D body shading. Purely visual: never touch ecosystem state or RNG.
// Run AFTER the organism's translate/rotate, BEFORE eyes and condition effects.
import {adaptationColor} from './simulation.js?v=2026.11.09.4';
const TAU=Math.PI*2;
const bound=(x,min,max)=>Math.max(min,Math.min(max,x));
const ellipse=(ctx,x,y,rx,ry,angle=0)=>{
 ctx.beginPath();ctx.ellipse(x,y,rx,ry,angle,0,TAU);
};
// A cubic closed outline smoothly ripples around an oval. The waves are small
// enough to preserve inherited round/oval morphology and eye placement.
export function jellyPath(ctx,rx,ry,phase,still=false){
 const count=12,points=[];
 for(let k=0;k<count;k++){
  const a=k*TAU/count;
  const ripple=still?1:1+.030*Math.sin(phase*1.13+a*3)
   +.014*Math.sin(phase*.71-a*5);
  points.push({x:rx*Math.cos(a)*ripple,y:ry*Math.sin(a)*ripple});
 }
 ctx.beginPath();
 for(let k=0;k<count;k++){
  const p=points[k],q=points[(k+1)%count],prev=points[(k+count-1)%count],after=points[(k+2)%count];
  // Catmull-Rom -> cubic Bezier at a moderate tension for a smooth membrane.
  const c1x=p.x+(q.x-prev.x)/6,c1y=p.y+(q.y-prev.y)/6;
  const c2x=q.x-(after.x-p.x)/6,c2y=q.y-(after.y-p.y)/6;
  if(k===0)ctx.moveTo(p.x,p.y);
  ctx.bezierCurveTo(c1x,c1y,c2x,c2y,q.x,q.y);
 }
 ctx.closePath();
}
export function drawJellyBody(ctx,g,rx,ry,phase,fade,lowDetail=false){
 const p=adaptationColor(g),albino=g.albino===1;
 const hue=albino?0:p.hue;
 const fadeAmount=bound(fade,0,1),colorHue=(hue+(((40-hue+540)%360)-180)*fadeAmount+360)%360;
 const saturation=albino?10:bound((p.saturation+12)*(1-.82*fadeAmount),12,95);
 const lightness=albino?85:bound(p.lightness+7,40,78);
 const size=Math.min(rx,ry);
 const inner=`hsl(${colorHue},${saturation*.72}%,${bound(lightness+16,0,96)}%)`;
 const color=`hsl(${colorHue},${saturation}%,${lightness}%)`;
 const deep=`hsl(${colorHue},${bound(saturation*.91,0,100)}%,${bound(lightness-24,15,70)}%)`;
 const detail=!lowDetail&&size>=3.5&&fadeAmount<.92;
 // Shadow is drawn outside the membrane by the existing renderer.
 ctx.save();
 jellyPath(ctx,rx,ry,phase);
 if(detail){
  // High point of the fluid volume shifts toward the upper-left light source.
  const volume=ctx.createRadialGradient(-rx*.34,-ry*.41,.05,rx*.23,ry*.20,Math.max(rx,ry)*1.31);
  volume.addColorStop(0,inner);
  volume.addColorStop(.37,color);
  volume.addColorStop(.73,color);
  volume.addColorStop(1,deep);
  ctx.globalAlpha=.91-.15*fadeAmount;
  ctx.fillStyle=volume;
 }else{
  ctx.fillStyle=color;
  ctx.globalAlpha=.9;
 }
 ctx.fill();
 ctx.globalAlpha=1;
 if(detail){
  // Transparent rim: the underlying terrain shows through the thin membrane.
  ctx.save();jellyPath(ctx,rx,ry,phase);ctx.clip();
  const transmitted=ctx.createRadialGradient(-rx*.1,-ry*.2,size*.08,0,0,Math.max(rx,ry));
  transmitted.addColorStop(0,'rgba(255,255,255,.045)');
  transmitted.addColorStop(.68,'rgba(255,255,255,.01)');
  transmitted.addColorStop(1,'rgba(255,255,255,.26)');
  ctx.fillStyle=transmitted;ctx.fillRect(-rx,-ry,rx*2,ry*2);
  // Glassy surface patch: not a white sclera or a separate floating object.
  ctx.fillStyle='rgba(255,255,255,.25)';
  ellipse(ctx,-rx*.28,-ry*.33,rx*.47,ry*.29,-.39);ctx.fill();
  // Mild inner caustic, suggesting translucent fluid under a membrane.
  ctx.strokeStyle=`rgba(250,255,250,${.18*(1-fadeAmount)})`;
  ctx.lineWidth=Math.max(.5,Math.min(1.9,size*.12));
  ctx.beginPath();
  ctx.ellipse(rx*.12,ry*.15,rx*.74,ry*.68,-.28,.35,2.33);ctx.stroke();
  // A tiny complementary reflection on the lower-right edge.
  ctx.fillStyle='rgba(255,255,255,.19)';
  ellipse(ctx,rx*.54,ry*.58,Math.max(.4,rx*.13),Math.max(.3,ry*.06),-.25);ctx.fill();
  ctx.restore();
 }
 // Illuminated perimeter and a dark refractive contour remain visible at zoom 1.
 jellyPath(ctx,rx,ry,phase);
 ctx.strokeStyle=`hsla(${colorHue},${bound(saturation*.72,0,100)}%,${Math.max(18,lightness-24)}%,.75)`;
 ctx.lineWidth=Math.max(.65,Math.min(2.3,size*.17));ctx.stroke();
 if(detail){
  ctx.save();
  ctx.strokeStyle='rgba(255,255,255,.57)';
  ctx.lineWidth=Math.max(.45,Math.min(1.5,size*.09));
  ctx.beginPath();ctx.ellipse(0,-ry*.05,rx*.92,ry*.9,0,3.56,5.12);ctx.stroke();
  ctx.restore();
 }
 ctx.restore();
}
