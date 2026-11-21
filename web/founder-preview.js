// Lightweight visual-only preview that uses the same slime geometry,
// jelly shading, eyes, and ornaments as the running world renderer.
// No simulation advance, RNG use, or side effects on the selected genome.
import {morphology,bodySizeMultiplier} from './simulation.js';
import {slimeEyeAngles,slimeEyeColor,slimeEyeLocation} from './renderer.js';
import {drawJellyBody} from './jelly-visuals.js';
import {drawOrnamentsBehind,drawOrnamentsFront} from './slime-ornaments.js';

const TAU=Math.PI*2;
export function drawFounderAppearance(canvas,g,frame=0){
 if(!canvas||!g)return;
 const ctx=canvas.getContext('2d');
 if(!ctx)return;
 const w=canvas.width,h=canvas.height;
 ctx.clearRect(0,0,w,h);
 // Same restrained colors as the world canvas, for an honest comparison.
 const background=ctx.createLinearGradient(0,0,0,h);
 background.addColorStop(0,'#224455');
 background.addColorStop(1,'#18303d');
 ctx.fillStyle=background;ctx.fillRect(0,0,w,h);
 const m=morphology(g);
 // Fixed scale preserves visible differences when the body-size slider moves.
 const scale=6.0*bodySizeMultiplier(g);
 const squash=Math.sin(frame*.12)*.025;
 const rx=g.r*scale*1.06*Math.max(1,Math.min(3,g.elongation??1))*(1+squash);
 const ry=g.r*scale*1.06*(1-squash);
 // Size is allowed to change, but the preview must not crop big rare morphs.
 const fit=Math.min(1,(w*.44)/Math.max(1,rx),(h*.37)/Math.max(1,ry));
 const px=rx*fit,py=ry*fit;
 const cy=h*.51+Math.sin(frame*.08)*2.2;
 ctx.save();ctx.translate(w*.5,cy);
 // Shadow is painted behind the body, with +X as its forward direction.
 ctx.fillStyle='rgba(0,0,0,.18)';
 ctx.beginPath();ctx.ellipse(0,py*.83,Math.max(4,px*.84),Math.max(3,py*.16),0,0,TAU);ctx.fill();
 ctx.rotate(-.24);
 const phase=frame*.11;
 drawOrnamentsBehind(ctx,g,px,py,frame,0);
 drawJellyBody(ctx,g,px,py,phase,0,false);
 drawOrnamentsFront(ctx,g,px,py,frame,0);
 const angles=slimeEyeAngles(g);
 const eyeRadius=Math.max(.45,Math.min(3.6,py*.19));
 ctx.fillStyle=slimeEyeColor(g);
 for(const angle of angles){
  const {x,y}=slimeEyeLocation(angle,px,py);
  ctx.beginPath();ctx.arc(x,y,eyeRadius,0,TAU);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.82)';
  ctx.beginPath();ctx.arc(x-eyeRadius*.30,y-eyeRadius*.30,Math.max(.2,eyeRadius*.23),0,TAU);ctx.fill();
  ctx.fillStyle=slimeEyeColor(g);
 }
 ctx.restore();
 ctx.font='12px system-ui';
 ctx.fillStyle='rgba(225,246,250,.75)';
 ctx.textAlign='right';
 
}
