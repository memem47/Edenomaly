// Compact, version-independent gameplay history for the next analysis session.
// The full numerical ecology/species CSV stays in the normal ZIP archive.
export const GAME_RUN_HISTORY_KEY='edenomaly:game-run-history:v1';
export function gameRunReport(world,session,ecologyLog,version,runId){
 const current=ecologyLog.data.runs.find(r=>r.id===ecologyLog.activeId)
  ??ecologyLog.data.runs.at(-1);
 const deaths={...world.deathCauses};
 const species=[...world.species.values()];
 const allSamples=current?.samples??[];
 const sampleStride=Math.max(1,Math.ceil(allSamples.length/250));
 return {
  schema:1,version,runId,seed:world.initialSeed,
  completed:session.finished,step:world.tick,
  score:world.runScore.total,permanentReward:session.reward,
  points:{earned:session.earned,spent:session.spent,remaining:session.points},
  deathCauses:deaths,
  infection:{cases:world.infectionCases??0,recoveries:world.infectionRecoveries??0,
   active:world.units.filter(u=>u.infection>0).length,
   treatedActions:session.interventionHistory.filter(x=>x.kind==='clinic').length},
  species:{discovered:species.length,established:world.runScore.establishedSpecies,
   everBorn:species.reduce((n,x)=>n+x.total,0)},
  interventions:session.interventionHistory.map(x=>({...x})),
  // Including the entire 50-step time-series lets failures be compared between
  // different code versions even if the browser-scoped normal log rotates.
  sampleCount:allSamples.length,
  // Keep a bounded cross-release summary. The automatically downloaded ZIP
  // retains the full 50-step ecology CSV at its original resolution.
  samples:allSamples.filter((_,i)=>i%sampleStride===0||i===allSamples.length-1).map(row=>({...row})),
  savedAt:new Date().toISOString()
 };
}
export function saveGameRunReport(storage,report){
 if(!storage)return false;
 try{
  const previous=JSON.parse(storage.getItem(GAME_RUN_HISTORY_KEY)??'[]');
  const records=Array.isArray(previous)?previous.filter(x=>x.runId!==report.runId):[];
  records.push(report);
  // Bound local storage; the ZIP export is the long-term full-fidelity copy.
  storage.setItem(GAME_RUN_HISTORY_KEY,JSON.stringify(records.slice(-12)));
  return true;
 }catch{return false;}
}
export const readGameRunHistory=storage=>{
 try{
  const data=JSON.parse(storage?.getItem(GAME_RUN_HISTORY_KEY)??'[]');
  return Array.isArray(data)?data:[];
 }catch{return [];}
};
