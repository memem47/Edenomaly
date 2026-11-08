// Reproducible game-mode location experiment without drawing.
// Compare identical RNG seeds across genuinely different starting terrain.
// Uses GameSession.start()/observe(), not a hand-built approximation of score.
import {Ecosystem,WORLD} from './simulation.js';
import {GameSession} from './game-mode.js';
import {observeEcology} from './ecology-log.js';
import {mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const SITES=[
 {id:'open_grass',terrain:0,center:[120,90],constraint:'no_water'},
 {id:'shore_grass',terrain:0,center:[220,220],constraint:'near_water'},
 {id:'deep_pond',terrain:1,center:[200,200],constraint:'interior'},
 {id:'pond_edge',terrain:1,center:[220,200],constraint:'edge'},
 {id:'dry_core',terrain:2,center:[610,110],constraint:'interior'},
 {id:'rock_core',terrain:3,center:[435,345],constraint:'interior'}
];
const nearCount=(w,cx,cy,t,r=2)=>{
 let count=0;
 for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
  if(dx===0&&dy===0)continue;
  const x=cx+dx,y=cy+dy;
  if(x>=0&&x<WORLD.columns&&y>=0&&y<WORLD.rows&&w.tiles[y*WORLD.columns+x]===t)count++;
 }
 return count;
};
export function selectSite(w,spec){
 let best=null,bestScore=Infinity;
 for(let y=2;y<WORLD.rows-2;y++)for(let x=2;x<WORLD.columns-2;x++){
  if(w.tiles[y*WORLD.columns+x]!==spec.terrain)continue;
  const water=nearCount(w,x,y,1,2);
  const same=nearCount(w,x,y,spec.terrain,1);
  const grass=nearCount(w,x,y,0,2);
  if(spec.constraint==='no_water'&&water>0)continue;
  if(spec.constraint==='near_water'&&water<2)continue;
  if(spec.constraint==='interior'&&same<6)continue;
  if(spec.constraint==='edge'&&(same<2||grass<2))continue;
  const px=(x+.5)*WORLD.cell,py=(y+.5)*WORLD.cell;
  const score=Math.hypot(px-spec.center[0],py-spec.center[1])-
   (spec.constraint==='near_water'?water*1.2:0);
  if(score<bestScore){bestScore=score;best={x:px,y:py,terrain:spec.terrain,
    adjacentWater:water,adjacentGrass:grass,sameTerrainNeighbors:same,
    localResource:w.grass[y*WORLD.columns+x]+w.waterweed[y*WORLD.columns+x]};}
 }
 if(!best)throw new Error('No viable site for '+spec.id+' seed '+w.initialSeed);
 return best;
}
function csv(rows){
 if(!rows.length)return '';
 const keys=Object.keys(rows[0]);
 return [keys.join(','),...rows.map(row=>keys.map(k=>{
  const s=String(row[k]??'');
  return /[,"\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;
 }).join(','))].join('\n')+'\n';
}
export function runGameLocation({seed,site,steps=1200,interval=100,policy='none'}){
 const w=new Ecosystem(seed);w.headless=true;w.headlessEventCounts={};
 const position=selectSite(w,site);
 const session=new GameSession(w);
 if(!session.start(position.x,position.y))throw new Error('Unable to start '+site.id);
 const founders=w.units.map(u=>({diet:u.g.diet,water:u.g.aquatic,r:u.g.r,
  frugality:u.g.frugality,temperature:u.g.idealTemp}));
 const trace=[],begin=performance.now();
 let peak=w.units.length,populationSum=0,positiveSamples=0;
 let interventionCount=0;
 const sample=()=>{
  const v=observeEcology(w),s=w.runScore;
  trace.push({seed,site:site.id,policy,step:w.tick,population:v.population,
   eggs:v.eggs,grass:v.grass,waterweed:v.waterweed,
   meanEnergy:v.meanEnergy,meanHpPercent:v.meanHpPercent,infected:v.infected,
   births:v.births,deaths:v.deaths,deathStarvation:v.deathStarvation,
   deathPredation:v.deathPredation,deathInfection:v.deathInfection,
   matings:v.matings,discoveredSpecies:v.discoveredSpecies,
   maxGeneration:v.maxGeneration,score:s.total,points:session.points,
   cannibalMeals:v.cannibalMeals,meanCarnivoryExperience:v.meanCarnivoryExperience,
   waterPlantings:v.waterPlantings});
 };
 sample();
 for(let i=0;i<steps;i++){
  // Optional resource-aware interventions, applied with the same finite
  // in-game points and canIntervene rules as a human player.
  if(policy==='resource'&&w.tick>0&&w.tick%150===0&&!session.finished){
   const water=w.tiles[w.cell(position.x,position.y)]===1;
   if(water&&session.canIntervene('rain',position.x,position.y)){
    if(session.intervene('rain',position.x,position.y))interventionCount++;
   }else if(session.canIntervene('seed',position.x,position.y)){
    if(session.intervene('seed',position.x,position.y))interventionCount++;
   }else if(session.canIntervene('rain',position.x,position.y)){
    if(session.intervene('rain',position.x,position.y))interventionCount++;
   }
  }
  w.step();session.observe();
  peak=Math.max(peak,w.units.length);
  populationSum+=w.units.length;
  if(w.units.length>0)positiveSamples++;
  if(w.tick%interval===0||i===steps-1||session.finished)sample();
  if(session.finished)break;
 }
 const final=trace.at(-1),time=performance.now()-begin;
 return {summary:{seed,site:site.id,policy,
  x:position.x,y:position.y,terrain:position.terrain,
  adjacentWater:position.adjacentWater,adjacentGrass:position.adjacentGrass,
  initialFood:Math.round(position.localResource),
  founders:founders.length,founderDiet:+(founders.reduce((t,u)=>t+u.diet,0)/founders.length).toFixed(3),
  founderAquatic:founders.filter(u=>u.water===1).length,
  steps:w.tick,extinct:session.finished?1:0,peak,
  finalPopulation:w.units.length,finalEggs:w.eggs.length,
  averagePopulation:+(populationSum/w.tick).toFixed(2),
  occupiedFraction:+(positiveSamples/w.tick).toFixed(3),
  score:w.runScore.total,points:session.points,
  interventions:interventionCount,
  births:final.births,deaths:final.deaths,
  deathStarvation:final.deathStarvation,deathPredation:final.deathPredation,
  deathInfection:final.deathInfection,matings:final.matings,
  maxGeneration:final.maxGeneration,discoveredSpecies:final.discoveredSpecies,
  carnivoryEvents:w.headlessEventCounts.carnivoreLearn??0,
  cannibalMeals:w.cannibalMeals??0,
  courtships:w.courtshipStarts,
  durationMs:Math.round(time)},trace};
}
export async function main(args=process.argv.slice(2)){
 const steps=Number(args[0]??1200),startSeed=Number(args[1]??72),
  seeds=Number(args[2]??3),out=resolve(args[3]??'results/locations'),
  policy=args[4]??'none';
 if(!Number.isSafeInteger(steps)||steps<1||steps>10000||
    !Number.isSafeInteger(startSeed)||startSeed<1||
    !Number.isSafeInteger(seeds)||seeds<1||seeds>20||
    !['none','resource'].includes(policy))throw new Error('Usage: node web/location-experiment.mjs [steps 1200] [first_seed 72] [seed_count 3] [output results/locations] [policy none|resource]');
 await mkdir(out,{recursive:true});
 const results=[],traces=[];
 for(let i=0;i<seeds;i++)for(const site of SITES){
  const item=runGameLocation({seed:startSeed+i,site,steps,policy});
  results.push(item.summary);traces.push(...item.trace);
  console.log('LOCATION_RESULT '+JSON.stringify(item.summary));
 }
 const groups=SITES.map(site=>{
  const matches=results.filter(x=>x.site===site.id);
  const avg=k=>+(matches.reduce((n,x)=>n+x[k],0)/matches.length).toFixed(2);
  return {site:site.id,tests:matches.length,extinctions:matches.filter(x=>x.extinct).length,
   meanPeak:avg('peak'),meanPopulation:avg('averagePopulation'),meanFinalPopulation:avg('finalPopulation'),
   meanScore:avg('score'),meanMating:avg('matings'),meanGeneration:avg('maxGeneration'),
   meanStarvation:avg('deathStarvation'),meanInterventions:avg('interventions')};
 });
 console.log('LOCATION_AGGREGATE '+JSON.stringify(groups));
 await writeFile(join(out,'locations-summary.csv'),csv(results));
 await writeFile(join(out,'locations-timeline.csv'),csv(traces));
 await writeFile(join(out,'locations-analysis.json'),JSON.stringify({steps,startSeed,seeds,policy,groups,results},null,2)+'\n');
 return {groups,results,traces};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url)))
 main().catch(error=>{console.error(error);process.exitCode=1;});
