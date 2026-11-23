// Paired, reproducible screening for founder parameters.
// Run: node web/founder-sensitivity-audit.mjs [steps=600] [seeds=2]
// No assertion that insignificant effects prove a gene is dead.
import {Ecosystem} from './simulation.js';
import {FOUNDER_FIELDS,founderValueAtLevel,editFounderGenome} from './founder-designer.js';
import {founderPresetGenome} from './founder-presets.js';
import {selectSite} from './location-experiment.mjs';
import {mkdir,writeFile} from 'node:fs/promises';

const steps=Number(process.argv[2]??600),seedCount=Number(process.argv[3]??2);
if(!Number.isSafeInteger(steps)||steps<1||steps>3000||!Number.isSafeInteger(seedCount)||seedCount<1||seedCount>10)throw Error('Usage: node web/founder-sensitivity-audit.mjs [steps 600] [seeds 2]');
const scenarios=[
 {id:'grass',preset:'grass',site:{id:'grass',terrain:0,center:[220,220],constraint:'near_water'}},
 {id:'water',preset:'water',site:{id:'water',terrain:1,center:[200,200],constraint:'interior'}},
 {id:'dry',preset:'desert',site:{id:'dry',terrain:2,center:[610,110],constraint:'interior'}}
];
const metrics=['populationArea','survivalSteps','peak','finalPopulation','eggs','births','deaths','mating','infection','waterPlantings','maxGeneration','energyArea'];
function run(seed,scenario,key,level){
 const w=new Ecosystem(seed);w.headless=true;w.headlessEventCounts={};
 const position=selectSite(w,scenario.site);
 let base=null;
 for(let i=0;i<70;i++){
  const g=w.gene();
  if(g.eyes>=2&&g.diet<=.28&&g.r*g.r*g.elongation<=100){base=g;break;}
 }
 base??=w.gene();
 const initial=founderPresetGenome(base,scenario.preset);
 const genome=key===null?initial:editFounderGenome(initial,{[key]:founderValueAtLevel(key,level)});
 // Introduction uses the same founder genome editor as game mode.
 w.introduce(position.x,position.y,1,genome);
 const start=w.units.length;
 let peak=start,populationArea=0,energyArea=0,liveSteps=0;
 for(let i=0;i<steps;i++){
  w.step();
  peak=Math.max(peak,w.units.length);
  populationArea+=w.units.length;
  energyArea+=w.units.reduce((sum,u)=>sum+(u.energy??0),0);
  if(w.units.length||w.eggs.length)liveSteps=w.tick;
  else break;
 }
 const born=[...w.species.values()].reduce((n,sp)=>n+(sp.total??0),0)-start;
 return {seed,scenario:scenario.id,key:key??'control',level:level??0,position,
  populationArea,survivalSteps:liveSteps,peak,finalPopulation:w.units.length,eggs:w.eggs.length,
  births:born,deaths:Object.values(w.deathCauses).reduce((n,x)=>n+(Number(x)||0),0),
  mating:w.matings??0,infection:w.infectionCases??0,waterPlantings:w.waterPlantings??0,
  maxGeneration:Math.max(0,...w.units.map(u=>u.generation??0)),energyArea};
}
const all=[],comparisons=[];
for(const scenario of scenarios){
 for(let i=0;i<seedCount;i++){
  const seed=7201+i;
  const control=run(seed,scenario,null,null);all.push(control);
  for(const [key] of FOUNDER_FIELDS){
   const low=run(seed,scenario,key,1),high=run(seed,scenario,key,10);
   all.push(low,high);
   const diff=Object.fromEntries(metrics.map(k=>[k,high[k]-low[k]]));
   const vsControlLow=Object.fromEntries(metrics.map(k=>[k,low[k]-control[k]]));
   const vsControlHigh=Object.fromEntries(metrics.map(k=>[k,high[k]-control[k]]));
   comparisons.push({scenario:scenario.id,seed,key,diff,vsControlLow,vsControlHigh});
  }
 }
 console.log('AUDIT_SCENARIO_DONE '+scenario.id);
}
const aggregate=FOUNDER_FIELDS.map(([key,label])=>{
 const pairs=comparisons.filter(x=>x.key===key);
 const byScenario=Object.fromEntries(scenarios.map(s=>{
  const match=pairs.filter(x=>x.scenario===s.id);
  const changed=match.filter(row=>metrics.some(k=>row.diff[k]!==0));
  const avg=k=>+(match.reduce((sum,r)=>sum+r.diff[k],0)/match.length).toFixed(2);
  return [s.id,{changedPairs:changed.length,pairs:match.length,
   deltaPopulationArea:avg('populationArea'),deltaSurvivalSteps:avg('survivalSteps'),
   deltaBirths:avg('births'),deltaPeak:avg('peak'),deltaMating:avg('mating'),
   deltaInfection:avg('infection'),deltaWaterPlantings:avg('waterPlantings')}];
 }));
 return {key,label,changedPairs:pairs.filter(r=>metrics.some(k=>r.diff[k]!==0)).length,
  testedPairs:pairs.length,byScenario};
});
const output={steps,seedCount,scenarios:scenarios.map(x=>x.id),metrics,aggregate,comparisons,all};
await mkdir('reports',{recursive:true});
await writeFile('reports/founder-sensitivity-audit.json',JSON.stringify(output,null,2)+'\n');
console.log('AUDIT_AGGREGATE '+JSON.stringify(aggregate));
console.log('AUDIT_SUMMARY '+JSON.stringify({steps,seedCount,runs:all.length,zeroEffect:aggregate.filter(x=>!x.changedPairs).map(x=>x.key)}));
