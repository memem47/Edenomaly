// Repeatable infection-focused game-mode trials. No altered ecosystem rules.
import {Ecosystem} from './simulation.js';
import {GameSession} from './game-mode.js';
import {selectSite} from './location-experiment.mjs';
export function diseaseTrial(seed,treatment=false,steps=1400){
 const w=new Ecosystem(seed);w.headless=true;
 const site={id:'pond_edge',terrain:1,center:[220,200],constraint:'edge'};
 const {x,y}=selectSite(w,site),session=new GameSession(w);
 if(!session.start(x,y))throw Error('cannot start game at site');
 let peaks=w.units.length;
 for(let tick=0;tick<steps;tick++){
  if(treatment&&w.tick%35===0&&session.active&&!session.finished&&session.points>=9){
   const sick=w.units.filter(u=>!u.dead&&u.infection>0);
   if(sick.length){
    const a=sick[0];
    // Treat only when several nearby organisms are exposed, or a single
    // severe case emerges; do not give the player unlimited free interventions.
    const exposed=sick.filter(u=>(u.x-a.x)**2+(u.y-a.y)**2<65**2);
    if(exposed.length>=2||a.infection>40)
     session.intervene('clinic',a.x,a.y);
   }
  }
  w.step();session.observe();
  peaks=Math.max(peaks,w.units.length);
  if(session.finished)break;
 }
 return {seed,treatment,steps:w.tick,extinct:session.finished,
  alive:w.units.length,peak:peaks,
  diseaseDeaths:w.deathCauses['感染症']??0,totalDeaths:Object.values(w.deathCauses).reduce((a,b)=>a+b,0),
  infectionCases:w.infectionCases,recoveries:w.infectionRecoveries,
  interventions:session.interventionHistory.filter(e=>e.kind==='clinic').length,
  score:w.runScore.total};
}
export function diseaseBatch(seeds=12,steps=1400){
 const data=[];
 for(let i=0;i<seeds;i++)for(const policy of [false,true])
  data.push(diseaseTrial(72+i,policy,steps));
 const mean=(rows,key)=>+(rows.reduce((a,b)=>a+b[key],0)/rows.length).toFixed(2);
 const summary=[false,true].map(treatment=>{
  const rows=data.filter(r=>r.treatment===treatment);
  return {treatment,n:rows.length,extinct:rows.filter(r=>r.extinct).length,
   meanAlive:mean(rows,'alive'),meanInfectionCases:mean(rows,'infectionCases'),
   meanDiseaseDeaths:mean(rows,'diseaseDeaths'),
   meanRecoveries:mean(rows,'recoveries'),
   meanInterventions:mean(rows,'interventions'),
   meanSteps:mean(rows,'steps')};
 });
 return {data,summary};
}
if(process.argv[1]?.endsWith('disease-playtest.mjs')){
 const seeds=Number(process.argv[2]??12),steps=Number(process.argv[3]??1400);
 if(!Number.isInteger(seeds)||seeds<1||seeds>30||!Number.isInteger(steps)||steps<100||steps>4000)throw Error('Invalid args');
 const result=diseaseBatch(seeds,steps);
 console.log('INFECTION_TRIAL_SUMMARY '+JSON.stringify(result.summary));
 console.log('INFECTION_TRIAL_ROWS '+JSON.stringify(result.data));
}
