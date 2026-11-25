// Render-free, deterministic ecology experiments shared by CLI and tests.
// The simulation's exact same Ecosystem.step() rules are used in the browser.
import {performance} from 'node:perf_hooks';
import {Ecosystem,organismMorphology,lifeStageScale} from './simulation.js';
import {observeEcology,ECOLOGY_LOG_FIELDS} from './ecology-log.js';


// Trait frequencies are measured, never injected into the simulation.
// They allow observation of whether caregiving traits spread after selection.
export function evolutionaryTraitMetrics(world){
 const living=world.units.filter(u=>!u.dead);
 const adult=living.filter(u=>u.stage==='adult');
 const proportion=(group,predicate)=>group.length?
  Math.round(group.filter(predicate).length*1000/group.length)/1000:0;
 const mean=(group,metric)=>group.length?
  Math.round(group.reduce((sum,u)=>sum+metric(u),0)*100/group.length)/100:0;
 return {
  parentalCareFraction:proportion(living,u=>u.g.dna?.skillParentFeeding===1),
  nestChoiceFraction:proportion(living,u=>u.g.dna?.skillNestChoice===1),
  adultCareFraction:proportion(adult,u=>u.g.dna?.skillParentFeeding===1),
  adultNestChoiceFraction:proportion(adult,u=>u.g.dna?.skillNestChoice===1),
  meanStamina:mean(living,u=>u.g.dna?.stamina??0),
  adultMeanStamina:mean(adult,u=>u.g.dna?.stamina??0),
  parentalCalories:Math.round(living.reduce((sum,u)=>sum+(u.parentalCalories??0),0)),
  offspringCalories:Math.round(living.reduce((sum,u)=>sum+(u.receivedParentFood??0),0))
 };
}
export const HEADLESS_EVENT_TYPES=['birth','attack','defend','rival','pred','cannibal','carnivoreLearn','eggeaten','waterPlant','shore','acclimate','mate','courtFail','ill','death','hatch','mature','migration','settle'];
export const HEADLESS_COLUMNS=['seed',...ECOLOGY_LOG_FIELDS,
 ...Object.keys(evolutionaryTraitMetrics({units:[]})),
 ...HEADLESS_EVENT_TYPES.map(type=>'event_'+type),'smallBodies','juvenileBodies','largeBodies','giantBodies','p10Radius','medianRadius','p90Radius'];
const percentile=(sorted,p)=>sorted.length?sorted[Math.floor((sorted.length-1)*p)]:0;
export function bodySizeMetrics(world){
 const radii=world.units.filter(u=>!u.dead).map(u=>
  organismMorphology(u).width*lifeStageScale(u)).sort((a,b)=>a-b);
 const small=radii.filter(r=>r<=2.5).length;
 const juvenile=world.units.filter(u=>!u.dead&&u.stage==='juvenile').length;
 return {smallBodies:small,juvenileBodies:juvenile,
  largeBodies:radii.filter(r=>r>6).length,
  giantBodies:radii.filter(r=>r>18).length,
  p10Radius:+percentile(radii,.10).toFixed(2),
  medianRadius:+percentile(radii,.50).toFixed(2),
  p90Radius:+percentile(radii,.90).toFixed(2)};
}
export function runHeadless({seed=971253,steps=5000,interval=50,founders=1,
  growth=70,rainfall=25,stress=15,version='development',stopAtExtinction=true,onSample=null}={}){
 if(!Number.isSafeInteger(seed)||seed<1||seed>2147483647)throw new RangeError('seed must be 1..2147483647');
 if(!Number.isSafeInteger(steps)||steps<1||steps>10000000)throw new RangeError('steps must be 1..10000000');
 if(!Number.isSafeInteger(interval)||interval<1||interval>steps)throw new RangeError('interval must be 1..steps');
 if(!Number.isSafeInteger(founders)||founders<1||founders>6)throw new RangeError('founders must be 1..6');
 const w=new Ecosystem(seed);
 w.headless=true;w.headlessEventCounts={};
 w.growth=growth;w.rainfall=rainfall;w.stress=stress;
 w.introduce(170,130,founders);
 const rows=[],started=performance.now();
 let peak=w.units.length;
 const sample=()=>{
  const eventFields=Object.fromEntries(HEADLESS_EVENT_TYPES.map(type=>
   ['event_'+type,w.headlessEventCounts[type]??0]));
  const row={...observeEcology(w),...bodySizeMetrics(w),...evolutionaryTraitMetrics(w),...eventFields,seed,run:seed,version};
  rows.push(row);onSample?.(row,w);
 };
 sample();
 for(let i=0;i<steps;i++){
  w.step();peak=Math.max(peak,w.units.length);
  if(w.tick%interval===0||i===steps-1||(stopAtExtinction&&w.units.length===0&&w.eggs.length===0))sample();
  if(stopAtExtinction&&w.units.length===0&&w.eggs.length===0)break;
 }
 const durationMs=Math.round((performance.now()-started)*100)/100;
 const last=rows.at(-1);
 const starvationRecords=(w.deathRecords??[]).filter(d=>d.cause==='飢餓・栄養不足'||d.cause==='飢餓');
 const countStage=stage=>starvationRecords.filter(d=>d.stage===stage).length;
 const withLocalFood=starvationRecords.filter(d=>(d.nearbyEdibleFood??0)>=20).length;
 const withSuccessfulForage=starvationRecords.filter(d=>(d.foodSuccess??0)>0).length;
 const forageFailed=starvationRecords.filter(d=>(d.foodFailure??0)>Math.max(5,(d.foodSuccess??0)*2)).length;
 const nearbyFoodMean=starvationRecords.length?
  Math.round(starvationRecords.reduce((n,d)=>n+(d.nearbyEdibleFood??0),0)/starvationRecords.length*10)/10:0;
 return {world:w,rows,summary:{
  seed,version,requestedSteps:steps,simulatedSteps:w.tick,interval,founders,
  stoppedByExtinction:stopAtExtinction&&w.tick<steps&&w.units.length===0&&w.eggs.length===0,
  peakPopulation:peak,finalPopulation:w.units.length,finalEggs:w.eggs.length,
  totalBirths:last.births,totalDeaths:last.deaths,
  deathsByStarvation:last.deathStarvation,
  starvationDiagnostics:{juvenile:countStage('juvenile'),adult:countStage('adult'),withNearbyFood20:withLocalFood,everForaged:withSuccessfulForage,forageFailuresDominant:forageFailed,meanNearbyFood:nearbyFoodMean,
   onFoodTile:starvationRecords.filter(d=>(d.foodOnTile??0)>1).length,
   nearFoodWithin20:starvationRecords.filter(d=>d.nearestFoodDistance!==null&&d.nearestFoodDistance<=20).length,
   nearFoodWithin50:starvationRecords.filter(d=>d.nearestFoodDistance!==null&&d.nearestFoodDistance<=50).length,
   neverFedWithFoodOnTile:starvationRecords.filter(d=>(d.foodOnTile??0)>1&&(d.foodSuccess??0)===0).length,
   juvenileMeanDeathAge:(()=>{const a=starvationRecords.filter(d=>d.stage==='juvenile');return a.length?Math.round(a.reduce((n,d)=>n+(d.age??0),0)/a.length):0;})()},
  finalFood:last.food,finalSpecies:last.livingSpecies,
  finalEvolutionaryTraits:evolutionaryTraitMetrics(w),
  discoveries:last.discoveredSpecies,maxGeneration:last.maxGeneration,
  carnivoreDeaths:last.deathPredation,cannibalMeals:last.cannibalMeals,
  waterPlantings:last.waterPlantings,landExplorers:last.landExplorers,
  medianRadius:last.medianRadius,p90Radius:last.p90Radius,
  eventCounts:{...w.headlessEventCounts},
  durationMs,stepsPerSecond:Math.round(w.tick/(durationMs/1000||.001))
 }};
}
const escapeCsv=v=>{
 const s=String(v??'');
 return /[",\n\r]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;
};
export function headlessCSV(rows){
 return [HEADLESS_COLUMNS.join(','),...rows.map(row=>
  HEADLESS_COLUMNS.map(key=>escapeCsv(row[key])).join(','))].join('\n')+'\n';
}
