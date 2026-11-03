// Manual balance experiment; does not run in npm test.
// Usage: node web/ecology-benchmark.mjs [seed=72] [steps=1250]
// Reports, but never enforces, gameplay population milestones.
import {Ecosystem} from './simulation.js';

const seed=Number(process.argv[2]??72);
const steps=Math.max(1,Math.min(5000,Number(process.argv[3]??1250)));
if(!Number.isFinite(seed)||!Number.isFinite(steps))throw new Error('Invalid seed or step count');

for(const managed of [false,true]){
 const w=new Ecosystem(seed);
 if(managed){w.growth=95;w.rainfall=75;w.stress=7;}
 w.introduce(170,130,1);
 const start=performance.now(),history=[];
 let peak=w.units.length;
 for(let i=0;i<steps;i++){
  if(managed&&i%160===0){
   for(let y=55;y<460;y+=140)for(let x=55;x<800;x+=140)w.fertilize(x,y,4);
   if(i>0)w.rain();
  }
  w.step();
  peak=Math.max(peak,w.units.length);
  if((i+1)%200===0)history.push({step:i+1,live:w.units.length,eggs:w.eggs.length});
 }
 const averageCrowd=w.units.length?w.units.reduce((sum,u)=>sum+(u.habitatLoad??0),0)/w.units.length:0;
 console.log(JSON.stringify({scenario:managed?'soil+rain managed':'natural baseline',seed,steps,
  introduced:w.introducedCount,peak,final:w.units.length,eggs:w.eggs.length,
  soilAvg:Number((w.soil.reduce((a,b)=>a+b,0)/w.soil.length).toFixed(2)),
  grassTotal:Math.round(w.grass.reduce((a,b)=>a+b,0)),
  averageCrowding:Number(averageCrowd.toFixed(2)),
  elapsedSeconds:Number(((performance.now()-start)/1000).toFixed(2)),history},null,2));
}
