#!/usr/bin/env node
// Empirical, render-free naming audit using exactly the production Ecosystem rules.
// npm run name-audit -- --steps 1200 --runs 4
import {runHeadless} from './headless-runner.mjs';
import {speciesNameFromCategory} from './simulation.js';
const args=process.argv.slice(2);
const option=(flag,fallback)=>{
 const i=args.indexOf(flag);
 if(i<0)return fallback;
 const value=Number(args[i+1]);
 if(!Number.isSafeInteger(value)||value<1)throw new Error('Invalid '+flag);
 return value;
};
const steps=option('--steps',1200),runs=option('--runs',4),firstSeed=option('--seed',72);
if(steps>50000||runs>20)throw new RangeError('name-audit bounds exceeded');
const found=new Map(),totalByName=new Map();
let peak=0,ever=0;
for(let i=0;i<runs;i++){
 const {world,summary}=runHeadless({seed:firstSeed+i,steps,interval:steps,founders:3});
 peak=Math.max(peak,summary.peakPopulation);
 for(const [category,species] of world.species){
  const name=speciesNameFromCategory(category);
  if(name!==species.name)throw new Error('Name changed during simulation');
  if(name.length!==10||/アア$|([ァ-ヶ])\\1$/.test(name))
   throw new Error('Unnatural generated name: '+name);
  const prior=found.get(category);
  found.set(category,name);
  totalByName.set(name,(totalByName.get(name)??0)+species.total);
  ever++;
 }
 console.log('seed='+summary.seed+' steps='+summary.simulatedSteps+
  ' species='+world.species.size+' peakPopulation='+summary.peakPopulation);
}
const common=[...totalByName.entries()].sort((a,b)=>b[1]-a[1]).slice(0,20);
console.log('Naming audit:',JSON.stringify({
 runs,steps,observedClassifications:ever,distinctClassifications:found.size,
 maxPopulation:peak,mostFrequentlyBornSpecies:common
},null,2));
