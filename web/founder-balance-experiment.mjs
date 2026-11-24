// Seeded experiment of the actual GameSession with player-selectable founders.
// Run: node web/founder-balance-experiment.mjs [steps] [seeds] [firstSeed] [output]
import {Ecosystem} from './simulation.js';
import {GameSession} from './game-mode.js';
import {FOUNDER_PRESETS,founderPresetGenome,randomFounderGenome} from './founder-presets.js';
import {editFounderGenome,founderCost,FOUNDER_BUDGET} from './founder-designer.js';
import {selectSite} from './location-experiment.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';

const SITES=[
 {id:'grass',terrain:0,center:[220,220],constraint:'near_water'},
 {id:'water',terrain:1,center:[200,200],constraint:'interior'},
 {id:'desert',terrain:2,center:[610,110],constraint:'interior'},
 {id:'rock',terrain:3,center:[435,345],constraint:'interior'}
];
const VARIANTS=[
 ['grass','default',{}],['grass','frugal_low',{frugality:0}],['grass','frugal_high',{frugality:1}],
 ['grass','resist_low',{resist:0}],['grass','resist_high',{resist:1}],
 ['grass','brood_low',{brood:1}],['grass','brood_high',{brood:8}],
 ['grass','hermaphrodite',{repro:1}],['grass','parthenogenesis',{repro:2}],
 ['grass','more_guard',{guard:1}],['grass','more_nesting',{nestChoice:1,parentFeeding:1}],
 ['grass','predator',{diet:1}],['water','water_gardening_low',{waterGardening:0}],
 ['water','water_gardening_high',{waterGardening:1}],
 ['desert','dry_low',{dry:0}],['desert','dry_high',{dry:1}],
 ['rock','rock_low',{rock:0}],['rock','rock_high',{rock:1}]
];
function baseGenome(w){
 let base=null;
 for(let i=0;i<70;i++){
  const g=w.gene();
  if(g.eyes>=2&&g.diet<=.28&&g.r*g.r*g.elongation<=100){base=g;break;}
 }
 return base??w.gene();
}
const finite=n=>Number.isFinite(n)?n:0;
const nround=(n,d=1)=>Number(finite(n).toFixed(d));
export function trial({seed,site,preset,variant='standard',changes={},steps=1100,policy='none'}){
 const w=new Ecosystem(seed);w.headless=true;w.headlessEventCounts={};
 const point=selectSite(w,site),base=baseGenome(w);
 let g;
 if(preset==='baseline')g=editFounderGenome(base,{});
 else if(preset==='random'){
  let state=seed+98765;
  const rand=()=>{state=(Math.imul(1664525,state)+1013904223)|0;return (state>>>0)/4294967296;};
  g=randomFounderGenome(base,rand);
 }else g=founderPresetGenome(base,preset);
 if(changes&&Object.keys(changes).length)g=editFounderGenome(g,changes);
 const cost=founderCost(base,g);
 if(cost>FOUNDER_BUDGET)throw Error('Invalid budget '+preset+'/'+variant+': '+cost);
 const sess=new GameSession(w);
 if(!sess.start(point.x,point.y,{founderGenome:g}))throw Error('Failed start '+preset+' '+site.id);
 let peak=w.units.length,at300=0,at600=0,at900=0,interventions=0;
 for(let i=0;i<steps;i++){
  if(policy==='seed'&&w.tick>0&&w.tick%150===0&&!sess.finished&&sess.canIntervene('seed',point.x,point.y)){
   if(sess.intervene('seed',point.x,point.y))interventions++;
  }
  if(policy==='clinic'&&w.tick>0&&w.tick%80===0&&!sess.finished&&sess.canIntervene('clinic',point.x,point.y)){
   if(sess.intervene('clinic',point.x,point.y))interventions++;
  }
  w.step();sess.observe();
  peak=Math.max(peak,w.units.length);
  if(w.tick===300)at300=w.units.length;
  if(w.tick===600)at600=w.units.length;
  if(w.tick===900)at900=w.units.length;
  if(sess.finished)break;
 }
 const causes={};for(const d of w.deathRecords??[]){const cause=d.cause??'unknown';causes[cause]=(causes[cause]??0)+1;}
 const ordered=Object.entries(causes).sort((a,b)=>b[1]-a[1]);
 return {seed,site:site.id,preset,variant,policy,cost,initialAquatic:g.aquatic,
  initialDiet:nround(g.diet,2),initialSize:nround(g.r,2),initialFrugality:nround(g.frugality,2),
  initialResist:nround(g.resist,2),initialBrood:g.brood,
  initialRepro:g.repro,
  extinct:sess.finished?1:0,duration:w.tick,peak,pop300:at300,pop600:at600,pop900:at900,
  population:w.units.length,eggs:w.eggs.length,matings:w.matings??0,
  births:[...w.species.values()].reduce((t,s)=>t+s.total,0)-8,
  maxGeneration:w.units.reduce((n,u)=>Math.max(n,u.generation),0),
  species:w.species.size,discoveries:w.runScore.discoveries,score:w.runScore.total,
  interventions,points:sess.points,
  deaths:w.deathRecords?.length??0,topCause:ordered[0]?.[0]??'none',
  topCauseCount:ordered[0]?.[1]??0,causes};
}
export function aggregate(items){
 const keys=['duration','extinct','peak','population','pop300','pop600','pop900',
  'eggs','births','matings','discoveries','score','deaths','interventions','cost'];
 const out={tests:items.length};
 for(const key of keys)out[key]=nround(items.reduce((s,r)=>s+r[key],0)/items.length,1);
 out.survived900=items.filter(x=>x.duration>=900&&!x.extinct).length;
 const causes={};for(const r of items)for(const [k,v] of Object.entries(r.causes))causes[k]=(causes[k]??0)+v;
 out.deathCauses=Object.entries(causes).sort((a,b)=>b[1]-a[1]).slice(0,5);
 return out;
}
export async function main(args=process.argv.slice(2)){
 const steps=Number(args[0]??1100),seeds=Number(args[1]??3),firstSeed=Number(args[2]??72),
  output=resolve(args[3]??'results/founder-balance');
 const rows=[];
 for(const site of SITES)for(const preset of ['baseline','grass','water','desert','rock','random']){
  for(let offset=0;offset<seeds;offset++)rows.push(trial({seed:firstSeed+offset,site,preset,steps}));
  const group=rows.filter(x=>x.site===site.id&&x.preset===preset&&x.variant==='standard');
  console.log('FOUNDER_GROUP '+JSON.stringify({site:site.id,preset,...aggregate(group)}));
 }
 for(const [preset,variant,changes] of VARIANTS){
  const site=SITES.find(s=>s.id===preset);
  const group=[];
  for(let offset=0;offset<seeds;offset++)group.push(trial({seed:firstSeed+offset,site,preset,variant,changes,steps}));
  rows.push(...group);
  console.log('FOUNDER_VARIANT '+JSON.stringify({site:site.id,preset,variant,changes,...aggregate(group)}));
 }
 for(const preset of ['grass','water','desert','rock']){
  const site=SITES.find(s=>s.id===preset);
  for(const policy of ['seed','clinic']){
   const group=[];
   for(let offset=0;offset<seeds;offset++)group.push(trial({seed:firstSeed+offset,site,preset,policy,steps}));
   rows.push(...group);
   console.log('FOUNDER_POLICY '+JSON.stringify({site:site.id,preset,policy,...aggregate(group)}));
  }
 }
 await mkdir(output,{recursive:true});
 await writeFile(join(output,'results.json'),JSON.stringify({steps,seeds,firstSeed,rows},null,2));
 const cols=['site','preset','variant','policy','seed','cost','duration','extinct','peak','population',
  'pop300','pop600','pop900','eggs','births','matings','discoveries','score',
  'interventions','deaths','topCause','topCauseCount'];
 await writeFile(join(output,'runs.csv'),[cols.join(','),...rows.map(r=>cols.map(k=>r[k]).join(','))].join('\n')+'\n');
 console.log('FOUNDER_TOTAL '+JSON.stringify({runs:rows.length,steps,seeds,firstSeed,output}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
 main().catch(e=>{console.error(e);process.exitCode=1;});
