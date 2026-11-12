// Gameplay-focused automated playthrough. Uses the actual game-mode
// progression, interventions and Ecosystem.step() as a real play session.
// Camera is modeled as a fixed zoomed viewport; no canvas rendering.
import {Ecosystem} from './simulation.js';
import {GameSession} from './game-mode.js';
import {selectSite} from './location-experiment.mjs';
const SITES=[
 {id:'open_grass',terrain:0,center:[120,90],constraint:'no_water'},
 {id:'pond_edge',terrain:1,center:[220,200],constraint:'edge'},
 {id:'shore_grass',terrain:0,center:[220,220],constraint:'near_water'}
];
function inside(x,y,camera,halfWidth=110,halfHeight=70){
 return Math.abs(x-camera.x)<=halfWidth&&Math.abs(y-camera.y)<=halfHeight;
}
export function playthrough({seed=72,site=SITES[0],steps=1200,policy='watch'}={}){
 const w=new Ecosystem(seed);w.headless=true;w.headlessEventCounts={};
 const pos=selectSite(w,site),session=new GameSession(w);
 if(!session.start(pos.x,pos.y))throw new Error('start failed');
 const camera={x:pos.x,y:pos.y},born=new Set(w.units.map(u=>u.id));
 const found=new Set(w.species.keys());
 const output={seed,site:site.id,policy,startX:pos.x,startY:pos.y,
  startBodies:w.units.length,steps:0,extinct:false,alive:0,eggs:0,
  peak:0,score:0,points:0,spent:0,earned:0,interventions:0,
  visibleAvg:0,offscreenAvg:0,offscreenPeak:0,firstOutsideStep:null,
  firstOffscreenBirthStep:null,offscreenBirths:0,
  offscreenDiscoveries:0,discoveries:0,established:0,
  maxGeneration:0,offscreenEstablished:0,visibleAtEnd:0,
  visibleInterventions:0,starvation:0,deathPredation:0,
  cameraMoves:0,forgottenOutside:0,
  interventionSteps:[],timeline:[]};
 let sumVisible=0,sumOutside=0,sampled=0,everOutside=new Set();
 // Existing user action "watch" = no help, "local" = help resources only
 // when visible, "adaptive" = also pan camera to the largest nearby group.
 for(let t=0;t<steps;t++){
  if(policy==='adaptive'&&w.tick>0&&w.tick%200===0){
   const off=w.units.filter(u=>!inside(u.x,u.y,camera));
   if(off.length>3&&off.length>w.units.length*.45){
    const target=off.reduce((a,u)=>({x:a.x+u.x/off.length,y:a.y+u.y/off.length}),{x:0,y:0});
    camera.x=Math.max(110,Math.min(690,target.x));
    camera.y=Math.max(70,Math.min(390,target.y));
    output.cameraMoves++;
   }
  }
  // At a practical 75 step decision interval, spend finite points on
  // a visible threatened group, not on unseen units.
  if(policy!=='watch'&&w.tick>0&&w.tick%75===0&&!session.finished){
   const visible=w.units.filter(u=>inside(u.x,u.y,camera));
   if(visible.length){
    const threatened=visible.filter(u=>u.energy<75);
    const focus=threatened.length?threatened:visible;
    const target=focus.reduce((a,u)=>({x:a.x+u.x/focus.length,y:a.y+u.y/focus.length}),{x:0,y:0});
    const food=session.localFood(target.x,target.y);
    const canSpend=threatened.length>=Math.max(1,Math.ceil(visible.length*.30))||food<80;
    if(canSpend){
     let kind='seed';
     if(!session.canIntervene(kind,target.x,target.y))kind='rain';
     if(session.canIntervene(kind,target.x,target.y)&&session.intervene(kind,target.x,target.y)){
      output.interventions++;output.visibleInterventions++;
      output.interventionSteps.push({step:w.tick,kind,food:Math.round(food),
       threatened:threatened.length,visible:visible.length,pointsAfter:session.points});
     }
    }
   }
  }
  w.step();session.observe();
  const visible=w.units.filter(u=>inside(u.x,u.y,camera));
  const off=w.units.filter(u=>!inside(u.x,u.y,camera));
  output.peak=Math.max(output.peak,w.units.length);
  output.offscreenPeak=Math.max(output.offscreenPeak,off.length);
  sumVisible+=visible.length;sumOutside+=off.length;sampled++;
  if(off.length&&output.firstOutsideStep===null)output.firstOutsideStep=w.tick;
  for(const u of off)everOutside.add(u.id);
  for(const u of w.units){
   if(!born.has(u.id)){
    born.add(u.id);
    if(!inside(u.x,u.y,camera)){
     output.offscreenBirths++;
     if(output.firstOffscreenBirthStep===null)output.firstOffscreenBirthStep=w.tick;
    }
   }
  }
  for(const [key,sp] of w.species)if(!found.has(key)){
   found.add(key);
   // Species first event does not carry a world location reliably; use
   // the first observed living member if present.
   const observed=w.units.find(u=>u.category===key);
   if(observed&&!inside(observed.x,observed.y,camera))output.offscreenDiscoveries++;
  }
  if(w.tick%200===0||session.finished){
   output.timeline.push({step:w.tick,alive:w.units.length,visible:visible.length,
    offscreen:off.length,points:session.points,discovered:w.species.size,
    established:w.runScore.establishedSpecies});
  }
  if(session.finished)break;
 }
 output.steps=w.tick;output.extinct=session.finished;
 output.alive=w.units.length;output.eggs=w.eggs.length;
 output.visibleAtEnd=w.units.filter(u=>inside(u.x,u.y,camera)).length;
 output.visibleAvg=+(sumVisible/Math.max(1,sampled)).toFixed(2);
 output.offscreenAvg=+(sumOutside/Math.max(1,sampled)).toFixed(2);
 output.forgottenOutside=everOutside.size;
 output.score=w.runScore.total;output.points=session.points;
 output.spent=session.spent;output.earned=session.earned;
 output.discoveries=w.species.size;output.established=w.runScore.establishedSpecies;
 output.maxGeneration=w.units.reduce((v,u)=>Math.max(v,u.generation),0);
 output.starvation=w.deaths?.starvation??w.deathCauses?.starvation??0;
 output.deathPredation=w.deaths?.predation??w.deathCauses?.predation??0;
 return output;
}
function aggregate(rows){
 const policies=[...new Set(rows.map(r=>r.policy))];
 const sites=[...new Set(rows.map(r=>r.site))];
 const mean=(list,k)=>+(list.reduce((a,x)=>a+(x[k]||0),0)/list.length).toFixed(2);
 return sites.flatMap(site=>policies.map(policy=>{
  const data=rows.filter(x=>x.site===site&&x.policy===policy);
  return {site,policy,n:data.length,extinctions:data.filter(x=>x.extinct).length,
   meanSteps:mean(data,'steps'),meanAlive:mean(data,'alive'),
   meanPeak:mean(data,'peak'),meanInterventions:mean(data,'interventions'),
   meanOffscreenBirths:mean(data,'offscreenBirths'),
   meanOffscreenDiscoveries:mean(data,'offscreenDiscoveries'),
   meanOffscreenPeak:mean(data,'offscreenPeak'),
   meanFirstOutsideStep:mean(data.filter(x=>x.firstOutsideStep!==null).length?
    data.filter(x=>x.firstOutsideStep!==null):[{firstOutsideStep:0}],'firstOutsideStep'),
   meanScore:mean(data,'score'),meanPoints:mean(data,'points'),
   meanEstablished:mean(data,'established')};
 }));
}
export function runGameplayTrials({seeds=[72,73,74,75],steps=1200}={}){
 const rows=[];
 for(const site of SITES)for(const seed of seeds)for(const policy of ['watch','local','adaptive']){
  const item=playthrough({seed,site,steps,policy});
  rows.push(item);
  console.log('GAMEPLAY_RESULT '+JSON.stringify(item));
 }
 const results=aggregate(rows);
 console.log('GAMEPLAY_AGGREGATE '+JSON.stringify(results));
 return {rows,groups:results};
}
if(process.argv[1]?.endsWith('gameplay-review.mjs')){
 const seeds=Number(process.argv[2]??5),steps=Number(process.argv[3]??1200);
 if(!Number.isSafeInteger(seeds)||seeds<1||seeds>20||!Number.isSafeInteger(steps)||steps<10||steps>5000)
  throw new Error('Usage: node web/gameplay-review.mjs [seeds 1..20] [steps 10..5000]');
 runGameplayTrials({seeds:Array.from({length:seeds},(_,i)=>72+i),steps});
}
