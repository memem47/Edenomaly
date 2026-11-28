// Cosmetic feedback for all game interventions. Never changes ecology or random state.
import {WORLD} from './simulation.js';
export const INTERVENTION_VISUALS=Object.freeze({
 terrain0:{color:'#83ef82',radius:20},terrain1:{color:'#72d9ff',radius:20},
 terrain2:{color:'#e9c476',radius:20},terrain3:{color:'#c4b3d9',radius:20},
 terrain4:{color:'#96e1b0',radius:20},terrain5:{color:'#ff9b75',radius:20},
 seed:{color:'#a6f56f',radius:45},fertilize:{color:'#e6d17d',radius:45},
 rain:{color:'#7bd9ff',radius:100,global:true,duration:120},
 clinic:{color:'#8aeee9',radius:65,duration:110},
 nursery:{color:'#ffb7df',radius:55,duration:260},
 oasis:{color:'#80d5ff',radius:65,duration:200},
 veteranCare:{color:'#ffe28a',radius:36,duration:160},
 reserveForest:{color:'#78eda0',radius:110},
 sanctuary:{color:'#76e8c7',radius:115,duration:500},
 lakeMaker:{color:'#7acbfa',radius:48},
 worldShaper:{color:'#e6c781',radius:90},
 mutationPulse:{color:'#c49bff',radius:100,global:true,duration:400},
 evolutionSanctuary:{color:'#f6d78c',radius:115,duration:600}
});
const TAU=Math.PI*2;
export const activeInterventionVisuals=world=>(world.interventionVisuals??[]).filter(v=>v.until>world.tick);
export function drawInterventionVisuals(ctx,world,{lowImpact=false}={}){
 const clock=world.visualTick??world.tick;
 for(const v of activeInterventionVisuals(world)){
  const spec=INTERVENTION_VISUALS[v.kind];if(!spec)continue;
  const fade=Math.min(1,(v.until-world.tick)/40);
  const pulse=1+Math.sin(clock*.075+v.started*.03)*.035;
  ctx.save();ctx.globalAlpha=fade;
  if(spec.global){
   ctx.fillStyle=v.kind==='mutationPulse'?'rgba(157,92,222,.065)':'rgba(80,172,225,.045)';
   ctx.fillRect(0,0,WORLD.width,WORLD.height);
   ctx.strokeStyle=spec.color;ctx.globalAlpha=.22*fade;ctx.lineWidth=lowImpact?2:3;
   ctx.strokeRect(3,3,WORLD.width-6,WORLD.height-6);
  }else{
   const radius=spec.radius*pulse;
   ctx.fillStyle=v.kind==='evolutionSanctuary'?'rgba(198,145,242,.075)':v.kind==='nursery'?'rgba(255,157,214,.07)':'rgba(115,215,225,.06)';
   ctx.beginPath();ctx.arc(v.x,v.y,radius,0,TAU);ctx.fill();
   ctx.strokeStyle=spec.color;ctx.globalAlpha=.65*fade;
   ctx.lineWidth=lowImpact?1.5:2.1;ctx.setLineDash(lowImpact?[]:[8,7]);
   ctx.beginPath();ctx.arc(v.x,v.y,radius,0,TAU);ctx.stroke();
   if(!lowImpact){ctx.setLineDash([]);ctx.globalAlpha=.24*fade;
    ctx.beginPath();ctx.arc(v.x,v.y,radius*.78,0,TAU);ctx.stroke();}
  }
  ctx.restore();
 }
 for(const fx of world.effects??[]){
  if(fx.type!=='playerIntervention')continue;
  const spec=INTERVENTION_VISUALS[fx.kind];if(!spec)continue;
  const life=fx.ttl??32,t=Math.min(1,fx.age/life);
  if(t>=1)continue;
  const radius=spec.global?Math.min(WORLD.width,WORLD.height)*(.1+.8*t):spec.radius*(.18+.9*t);
  ctx.save();ctx.globalAlpha=Math.pow(1-t,1.3)*.85;
  ctx.strokeStyle=spec.color;ctx.lineWidth=3.4*(1-t)+.7;
  ctx.beginPath();ctx.arc(fx.x,fx.y,radius,0,TAU);ctx.stroke();
  if(!lowImpact){ctx.globalAlpha=(1-t)*.48;ctx.beginPath();
   ctx.arc(fx.x,fx.y,radius*.70,0,TAU);ctx.stroke();}
  ctx.restore();
 }
}
