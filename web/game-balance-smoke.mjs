// Focused scenario check of new game economy and ecology.
import {Ecosystem} from './simulation.js';
import {GameSession} from './game-mode.js';
import {founderPresetGenome} from './founder-presets.js';
import {selectSite} from './location-experiment.mjs';
const sites={
 grass:{id:'grass',terrain:0,center:[220,220],constraint:'near_water'},
 water:{id:'water',terrain:1,center:[200,200],constraint:'interior'},
 desert:{id:'desert',terrain:2,center:[610,110],constraint:'interior'},
 rock:{id:'rock',terrain:3,center:[435,345],constraint:'interior'}
};
const groups=[];
for(const kind of ['grass','water','desert','rock']){
 const results=[];
 for(let seed=72;seed<78;seed++){
  const w=new Ecosystem(seed);w.headless=true;
  const position=selectSite(w,sites[kind]);
  let base=null;
  for(let i=0;i<70;i++){
   const g=w.gene();
   if(g.eyes>=2&&g.diet<=.28&&g.r*g.r*g.elongation<=100){base=g;break;}
  }
  base??=w.gene();
  const founder=founderPresetGenome(base,kind),session=new GameSession(w);
  if(!session.start(position.x,position.y,{founderGenome:founder}))throw Error('failed to start '+kind);
  let peak=8,highest=0;
  for(let n=0;n<1100&&!session.finished;n++){
   w.step();session.observe();
   peak=Math.max(peak,w.units.length);
   highest=Math.max(highest,...w.units.map(u=>u.generation),0);
  }
  results.push({seed,kind,extinct:session.finished,steps:w.tick,peak,highest,
    births:[...w.species.values()].reduce((n,sp)=>n+sp.total,0)-8,
    score:w.runScore.total});
 }
 const summary={kind,runs:results.length,extinct:results.filter(r=>r.extinct).length,
  meanPeak:Math.round(results.reduce((n,r)=>n+r.peak,0)/results.length),
  meanMaxGeneration:+(results.reduce((n,r)=>n+r.highest,0)/results.length).toFixed(2),
  meanScore:Math.round(results.reduce((n,r)=>n+r.score,0)/results.length),results};
 console.log('GAME_BALANCE_SCENARIO '+JSON.stringify(summary));
 groups.push(summary);
}
// No hard threshold until observed: report statistical outcomes instead.
console.log('GAME_BALANCE_TOTAL '+JSON.stringify({cases:groups.length,runs:groups.reduce((n,g)=>n+g.runs,0)}));
