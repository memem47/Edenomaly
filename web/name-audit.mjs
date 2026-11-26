#!/usr/bin/env node
// Check that each birth-derived name remains stable and uses a unique code
// even when a phenotypic color name or ornament is shared across categories.
import {runHeadless} from './headless-runner.mjs';
import {speciesNameFromCategory,speciesEcologyCode} from './simulation.js';
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
const found=new Map(),categoryByName=new Map(),totalByName=new Map();
let peak=0,ever=0;
for(let i=0;i<runs;i++){
 const {world,summary}=runHeadless({seed:firstSeed+i,steps,interval:steps,founders:3});
 peak=Math.max(peak,summary.peakPopulation);
 for(const [category,species] of world.species){
  const name=speciesNameFromCategory(category,species.genome);
  if(name!==species.name)throw new Error('Discovery name changed during simulation');
  const code=speciesEcologyCode(category);
  // Compact names are classification-only (four kana for historical keys,
  // six kana for actual species including appearance traits).
  if(!/^[ァ-ヶ]{4}(?:[ァ-ヶ]{2})?$/.test(name))
   throw new Error('Unexpected short species name: '+name);
  // The exact classification, not the first individual's variable genome,
  // controls the name. Different categories must never collide.
  if(categoryByName.has(name)&&categoryByName.get(name)!==category)
   throw new Error('Two different categories share one species name: '+name);
  categoryByName.set(name,category);
  if(found.has(category)&&found.get(category)!==code)
   throw new Error('Ecology code changed');
  found.set(category,code);
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
